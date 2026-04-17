import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ChoreographyProjectJson,
  DancerSpot,
  SetPiece,
} from "../types/choreography";
import { audienceRotationDeg } from "../lib/projectDefaults";
import {
  formatMeterCmLabel,
  formatStageMmSummary,
  mmToMeterCm,
} from "../lib/stageDimensions";

const DANCER_LABEL_MAX = 8;
/** ドラッグ中、この y% 以上で下端ゴミ箱 UI を出す（客席＝下が大きい y） */
const TRASH_REVEAL_Y_PCT = 88;

const DANCER_PALETTE = [
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#fb923c",
  "#2dd4bf",
  "#e879f9",
  /** 写真の既定マルに近い白 */
  "#f8fafc",
] as const;

type Props = {
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  playbackDancers: DancerSpot[] | null;
  /**
   * 一時停止時など、再生補間より優先して見せるフォーメーション（ページめくり閲覧用）。
   * 再生中は親が null にする想定。
   */
  browseFormationDancers?: DancerSpot[] | null;
  /** キュー追加ウィザード等のプレビュー（最優先で表示・ドラッグ不可） */
  previewDancers?: DancerSpot[] | null;
  /**
   * 再生補間表示中はダンサーがクリック不可のため、ステージ（客席帯以外）をクリックしたときに
   * 親で「選択中フォーメーションのドラッグ調整」へ切り替える。
   */
  onRequestLayoutEditFromStage?: () => void;
  /** 立ち位置の書き込み先。未指定なら project.activeFormationId */
  editFormationId?: string | null;
  /** false のときダンサー操作不可（キュー未選択など） */
  stageInteractionsEnabled?: boolean;
  /** 再生中の補間済み大道具（親が計算） */
  playbackSetPieces?: SetPiece[] | null;
  /** 一時停止時の大道具（親が計算） */
  browseSetPieces?: SetPiece[] | null;
  /** 再生中にステージ床（ダンサー以外）を押したら停止（§5） */
  isPlaying?: boolean;
  onStopPlaybackRequest?: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function resolveSetPieceFill(p: SetPiece): string {
  const c = p.fillColor?.trim();
  if (c && /^#[0-9a-fA-F]{6}$/i.test(c)) return c.toLowerCase();
  return "#475569";
}

function setPieceKindJa(kind: SetPiece["kind"]): string {
  if (kind === "ellipse") return "円・楕円";
  if (kind === "triangle") return "三角";
  return "矩形";
}

/** §10 大道具矩形のリサイズ（ハンドル別） */
type SetPieceResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
/** 複数選択されたダンサー群を囲む枠のリサイズハンドル */
type GroupBoxHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const MIN_SET_PIECE_W_PCT = 2.5;
const MIN_SET_PIECE_H_PCT = 2.5;

const MARKER_PX_MIN = 20;
const MARKER_PX_MAX = 120;

const GROUP_BOX_HANDLES: readonly {
  h: GroupBoxHandle;
  cursor: string;
  pos: CSSProperties;
}[] = [
  { h: "nw", cursor: "nwse-resize", pos: { left: 0, top: 0, transform: "translate(-50%, -50%)" } },
  { h: "n", cursor: "ns-resize", pos: { left: "50%", top: 0, transform: "translate(-50%, -50%)" } },
  { h: "ne", cursor: "nesw-resize", pos: { right: 0, top: 0, transform: "translate(50%, -50%)" } },
  { h: "e", cursor: "ew-resize", pos: { right: 0, top: "50%", transform: "translate(50%, -50%)" } },
  { h: "se", cursor: "nwse-resize", pos: { right: 0, bottom: 0, transform: "translate(50%, 50%)" } },
  { h: "s", cursor: "ns-resize", pos: { left: "50%", bottom: 0, transform: "translate(-50%, 50%)" } },
  { h: "sw", cursor: "nesw-resize", pos: { left: 0, bottom: 0, transform: "translate(-50%, 50%)" } },
  { h: "w", cursor: "ew-resize", pos: { left: 0, top: "50%", transform: "translate(-50%, -50%)" } },
];

/** 群リサイズのハンドル方向からスケーリング係数と不動点（アンカー）を求める */
function groupScaleForHandle(
  handle: GroupBoxHandle,
  startBox: { x0: number; y0: number; x1: number; y1: number },
  newX: number,
  newY: number,
  keepAspect: boolean
): { sx: number; sy: number; ax: number; ay: number } {
  const wx = Math.max(0.01, startBox.x1 - startBox.x0);
  const wy = Math.max(0.01, startBox.y1 - startBox.y0);
  /** 画面上の端 → スケール対象の辺を動かす。反対辺はアンカー（固定） */
  let ax = (startBox.x0 + startBox.x1) / 2;
  let ay = (startBox.y0 + startBox.y1) / 2;
  let sx = 1;
  let sy = 1;
  const touchesN = handle.includes("n");
  const touchesS = handle.includes("s");
  const touchesW = handle.includes("w");
  const touchesE = handle.includes("e");
  if (touchesE) {
    ax = startBox.x0;
    sx = Math.max(0.05, (newX - startBox.x0) / wx);
  } else if (touchesW) {
    ax = startBox.x1;
    sx = Math.max(0.05, (startBox.x1 - newX) / wx);
  }
  if (touchesS) {
    ay = startBox.y0;
    sy = Math.max(0.05, (newY - startBox.y0) / wy);
  } else if (touchesN) {
    ay = startBox.y1;
    sy = Math.max(0.05, (startBox.y1 - newY) / wy);
  }
  if (!touchesE && !touchesW) sx = keepAspect ? sy : 1;
  if (!touchesN && !touchesS) sy = keepAspect ? sx : 1;
  if (keepAspect && (touchesE || touchesW) && (touchesN || touchesS)) {
    const s = Math.max(sx, sy);
    sx = s;
    sy = s;
  }
  return { sx, sy, ax, ay };
}

function applySetPieceResizePct(
  handle: SetPieceResizeHandle,
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number,
  dxPct: number,
  dyPct: number
): { xPct: number; yPct: number; wPct: number; hPct: number } {
  let nx = xPct;
  let ny = yPct;
  let nw = wPct;
  let nh = hPct;
  if (handle.includes("n")) {
    const nya = clamp(ny + dyPct, 0, ny + nh - MIN_SET_PIECE_H_PCT);
    nh = ny + nh - nya;
    ny = nya;
  }
  if (handle.includes("s")) {
    nh = clamp(nh + dyPct, MIN_SET_PIECE_H_PCT, 100 - ny);
  }
  if (handle.includes("w")) {
    const nxa = clamp(nx + dxPct, 0, nx + nw - MIN_SET_PIECE_W_PCT);
    nw = nx + nw - nxa;
    nx = nxa;
  }
  if (handle.includes("e")) {
    nw = clamp(nw + dxPct, MIN_SET_PIECE_W_PCT, 100 - nx);
  }
  return { xPct: nx, yPct: ny, wPct: nw, hPct: nh };
}

type SnapMode = "free" | "grid" | "fine";

export function StageBoard({
  project,
  setProject,
  playbackDancers,
  browseFormationDancers = null,
  previewDancers = null,
  onRequestLayoutEditFromStage,
  editFormationId = null,
  stageInteractionsEnabled = true,
  playbackSetPieces = null,
  browseSetPieces = null,
  isPlaying = false,
  onStopPlaybackRequest,
}: Props) {
  const {
    formations,
    activeFormationId,
    snapGrid,
    gridStep,
    audienceEdge,
    stageWidthMm,
    stageDepthMm,
    sideStageMm,
    backStageMm,
    centerFieldGuideIntervalMm,
    viewMode,
    dancerMarkerDiameterPx,
    hanamichiEnabled: hanamichiEnabledRaw,
    hanamichiDepthPct: hanamichiDepthRaw,
  } = project;
  const hanamichiEnabled = hanamichiEnabledRaw ?? false;
  const hanamichiDepthPct = Math.min(36, Math.max(8, hanamichiDepthRaw ?? 14));

  const baseMarkerPx = Math.max(
    MARKER_PX_MIN,
    Math.min(MARKER_PX_MAX, Math.round(dancerMarkerDiameterPx ?? 44))
  );
  /** サイズドラッグ中は draft 値を即時反映して手応えを出す（ドラッグ終了時に確定） */

  /** メイン床（%座標・PNG のダンサー領域）。サイド/バック分割時は中央セルのみ */
  const stageMainFloorRef = useRef<HTMLDivElement>(null);
  const trashDockRef = useRef<HTMLDivElement>(null);
  const stageContextMenuRef = useRef<HTMLDivElement>(null);
  const trashHotRef = useRef(false);
  const dragRef = useRef<{
    dancerId: string;
    offsetXPx: number;
    offsetYPx: number;
  } | null>(null);
  const setPieceDragRef = useRef<
    | {
        mode: "move";
        pieceId: string;
        offsetXPx: number;
        offsetYPx: number;
      }
    | {
        mode: "resize";
        pieceId: string;
        handle: SetPieceResizeHandle;
        start: { xPct: number; yPct: number; wPct: number; hPct: number };
        startClientX: number;
        startClientY: number;
        floorWpx: number;
        floorHpx: number;
      }
    | null
  >(null);

  const [editingDancerId, setEditingDancerId] = useState<string | null>(null);
  /**
   * ステージ上で選択中のダンサー ID（複数可）。
   * - 1 件なら Alt+矢印で微移動できる（従来の microNudgeDancerId の役割）。
   * - 2 件以上ならステージに枠が出て、8 ハンドルで群全体を比率スケールできる。
   * - 1 件以上なら代表ダンサーの右下に小さなハンドルが出て、○の直径を変更できる。
   */
  const [selectedDancerIds, setSelectedDancerIds] = useState<string[]>([]);
  const [selectedSetPieceId, setSelectedSetPieceId] = useState<string | null>(null);
  /** ドラッグ中のマーキー（範囲選択の四角）。pct 座標で親床内を示す */
  const [marquee, setMarquee] = useState<{
    startXPct: number;
    startYPct: number;
    curXPct: number;
    curYPct: number;
  } | null>(null);
  const marqueeSessionRef = useRef<
    | {
        startClientX: number;
        startClientY: number;
        startXPct: number;
        startYPct: number;
        floorWpx: number;
        floorHpx: number;
        additive: boolean;
        baseIds: string[];
        movedPx: number;
      }
    | null
  >(null);
  /** 複数ダンサー選択時の群移動／群スケール操作セッション */
  const groupDragRef = useRef<
    | {
        mode: "move";
        ids: string[];
        startPositions: Map<string, { xPct: number; yPct: number }>;
        startClientX: number;
        startClientY: number;
        floorWpx: number;
        floorHpx: number;
      }
    | {
        mode: "scale";
        handle: GroupBoxHandle;
        ids: string[];
        startBox: { x0: number; y0: number; x1: number; y1: number };
        startPositions: Map<string, { xPct: number; yPct: number }>;
        startClientX: number;
        startClientY: number;
        floorWpx: number;
        floorHpx: number;
      }
    | null
  >(null);
  /**
   * 代表ダンサーの右下ハンドルで、選択中のダンサー群の○サイズ（px）を変更するセッション。
   * 開始時点の各ダンサーのサイズを覚えておき、ポインタ移動量に応じて全員を同じ差分で動かす。
   */
  const markerResizeRef = useRef<
    | {
        startClientX: number;
        startClientY: number;
        startSizes: Map<string, number>;
        ids: string[];
      }
    | null
  >(null);
  /** サイズドラッグ中は選択中ダンサー ID → 仮の直径 px を保持してライブプレビュー */
  const [markerDiamDraft, setMarkerDiamDraft] = useState<Map<
    string,
    number
  > | null>(null);

  /** ダンサー 1 人分の実効サイズ（px）。draft > 個別 sizePx > プロジェクト共通、の順で解決。 */
  const effectiveMarkerPx = useCallback(
    (d: DancerSpot) => {
      const draft = markerDiamDraft?.get(d.id);
      if (typeof draft === "number" && Number.isFinite(draft)) {
        return Math.max(MARKER_PX_MIN, Math.min(MARKER_PX_MAX, Math.round(draft)));
      }
      if (typeof d.sizePx === "number" && Number.isFinite(d.sizePx)) {
        return Math.max(MARKER_PX_MIN, Math.min(MARKER_PX_MAX, Math.round(d.sizePx)));
      }
      return baseMarkerPx;
    },
    [markerDiamDraft, baseMarkerPx]
  );

  /** ゴミ箱ドロップゾーン上でダンサーをドラッグ中 */
  const [trashHot, setTrashHot] = useState(false);
  /** マルを下端付近まで下げたときだけゴミ箱 UI を出す */
  const [trashUiVisible, setTrashUiVisible] = useState(false);
  const trashRevealActiveRef = useRef(false);
  /** ステージ上の右クリックメニュー（ダンサー / 大道具） */
  const [stageContextMenu, setStageContextMenu] = useState<
    | { kind: "dancer"; clientX: number; clientY: number; dancerId: string }
    | { kind: "setPiece"; clientX: number; clientY: number; pieceId: string }
    | null
  >(null);
  const [editingLabelDraft, setEditingLabelDraft] = useState("");
  const skipLabelCommitRef = useRef(false);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const formationIdForWrites =
    editFormationId != null && formations.some((f) => f.id === editFormationId)
      ? editFormationId
      : activeFormationId;

  useEffect(() => {
    setEditingDancerId(null);
    setSelectedDancerIds([]);
    setStageContextMenu(null);
    setSelectedSetPieceId(null);
    setMarquee(null);
    marqueeSessionRef.current = null;
    groupDragRef.current = null;
    markerResizeRef.current = null;
    setMarkerDiamDraft(null);
  }, [formationIdForWrites]);

  useEffect(() => {
    if (!stageContextMenu) return;
    const close = (e: PointerEvent) => {
      const el = stageContextMenuRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      setStageContextMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStageContextMenu(null);
    };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [stageContextMenu]);

  useLayoutEffect(() => {
    if (!editingDancerId) return;
    const el = labelInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editingDancerId]);

  const activeFormation = useMemo(
    () => formations.find((f) => f.id === activeFormationId),
    [formations, activeFormationId]
  );

  const writeFormation = useMemo(
    () => formations.find((f) => f.id === formationIdForWrites),
    [formations, formationIdForWrites]
  );

  const displayDancers =
    previewDancers ??
    playbackDancers ??
    browseFormationDancers ??
    activeFormation?.dancers ??
    [];

  const displaySetPieces: SetPiece[] =
    previewDancers != null && previewDancers.length > 0
      ? writeFormation?.setPieces ?? []
      : playbackSetPieces ??
        browseSetPieces ??
        writeFormation?.setPieces ??
        [];

  const playbackOrPreview = Boolean(playbackDancers || previewDancers);
  const setPiecesEditable =
    viewMode !== "view" &&
    stageInteractionsEnabled &&
    !playbackOrPreview;

  const updateActiveFormation = useCallback(
    (updater: (f: NonNullable<typeof writeFormation>) => NonNullable<typeof writeFormation>) => {
      if (
        !writeFormation ||
        viewMode === "view" ||
        stageInteractionsEnabled === false
      )
        return;
      setProject((p) => ({
        ...p,
        formations: p.formations.map((f) =>
          f.id === formationIdForWrites ? updater(f) : f
        ),
      }));
    },
    [writeFormation, formationIdForWrites, setProject, viewMode, stageInteractionsEnabled]
  );

  const removeDancerById = useCallback(
    (dancerId: string) => {
      if (
        !writeFormation ||
        viewMode === "view" ||
        stageInteractionsEnabled === false
      )
        return;
      updateActiveFormation((f) => ({
        ...f,
        dancers: f.dancers.filter((x) => x.id !== dancerId),
      }));
      setSelectedDancerIds((ids) => ids.filter((id) => id !== dancerId));
      setEditingDancerId((id) => (id === dancerId ? null : id));
      setStageContextMenu(null);
    },
    [writeFormation, updateActiveFormation, viewMode, stageInteractionsEnabled]
  );

  const removeSetPieceById = useCallback(
    (pieceId: string) => {
      if (!writeFormation || viewMode === "view" || stageInteractionsEnabled === false)
        return;
      updateActiveFormation((f) => ({
        ...f,
        setPieces: (f.setPieces ?? []).filter((x) => x.id !== pieceId),
      }));
      setSelectedSetPieceId((id) => (id === pieceId ? null : id));
      setStageContextMenu(null);
    },
    [writeFormation, updateActiveFormation, viewMode, stageInteractionsEnabled]
  );

  const handlePointerDownSetPiece = (
    e: ReactPointerEvent,
    piece: SetPiece
  ) => {
    if (e.button !== 0) return;
    if (!setPiecesEditable) return;
    setSelectedSetPieceId(piece.id);
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const el = stageMainFloorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const leftPx = r.left + (piece.xPct / 100) * r.width;
    const topPx = r.top + (piece.yPct / 100) * r.height;
    setPieceDragRef.current = {
      mode: "move",
      pieceId: piece.id,
      offsetXPx: e.clientX - leftPx,
      offsetYPx: e.clientY - topPx,
    };
  };

  const handlePointerDownSetPieceResize = (
    e: ReactPointerEvent,
    piece: SetPiece,
    handle: SetPieceResizeHandle
  ) => {
    if (e.button !== 0) return;
    if (!setPiecesEditable) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedSetPieceId(piece.id);
    const el = stageMainFloorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPieceDragRef.current = {
      mode: "resize",
      pieceId: piece.id,
      handle,
      start: {
        xPct: piece.xPct,
        yPct: piece.yPct,
        wPct: piece.wPct,
        hPct: piece.hPct,
      },
      startClientX: e.clientX,
      startClientY: e.clientY,
      floorWpx: r.width,
      floorHpx: r.height,
    };
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if (t instanceof HTMLElement && t.isContentEditable) return;
      if (!selectedSetPieceId || !setPiecesEditable) return;
      e.preventDefault();
      removeSetPieceById(selectedSetPieceId);
      setSelectedSetPieceId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedSetPieceId, setPiecesEditable, removeSetPieceById]);

  const setTrashHotIfChanged = useCallback((v: boolean) => {
    if (trashHotRef.current === v) return;
    trashHotRef.current = v;
    setTrashHot(v);
  }, []);

  const hitTrashDropZone = useCallback((clientX: number, clientY: number) => {
    if (!trashRevealActiveRef.current) return false;
    const dock = trashDockRef.current;
    if (dock) {
      const r = dock.getBoundingClientRect();
      return (
        clientX >= r.left &&
        clientX <= r.right &&
        clientY >= r.top &&
        clientY <= r.bottom
      );
    }
    const floor = stageMainFloorRef.current;
    if (!floor) return false;
    const r = floor.getBoundingClientRect();
    const boxW = Math.min(118, Math.max(92, r.width * 0.34));
    const boxH = 76;
    const left = r.left + (r.width - boxW) / 2;
    const top = r.bottom - boxH - 10;
    return (
      clientX >= left &&
      clientX <= left + boxW &&
      clientY >= top &&
      clientY <= r.bottom - 4
    );
  }, []);

  const quantizeCoord = useCallback(
    (v: number, mode: SnapMode) => {
      const c = clamp(v, 2, 98);
      if (mode === "free" || !snapGrid) return round2(c);
      const step =
        mode === "fine" ? Math.max(0.25, gridStep / 4) : gridStep;
      return round2(clamp(Math.round(c / step) * step, 2, 98));
    },
    [snapGrid, gridStep]
  );

  const pxToPct = useCallback(
    (clientX: number, clientY: number, shiftKey: boolean) => {
      const el = stageMainFloorRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const xPct = ((clientX - r.left) / r.width) * 100;
      const yPct = ((clientY - r.top) / r.height) * 100;
      const mode: SnapMode = snapGrid ? (shiftKey ? "fine" : "grid") : "free";
      return {
        xPct: quantizeCoord(xPct, mode),
        yPct: quantizeCoord(yPct, mode),
      };
    },
    [snapGrid, quantizeCoord]
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = setPieceDragRef.current;
      if (!d) return;
      if (d.mode === "move") {
        const next = pxToPct(
          e.clientX - d.offsetXPx,
          e.clientY - d.offsetYPx,
          e.shiftKey
        );
        if (!next) return;
        updateActiveFormation((f) => {
          const pieces = [...(f.setPieces ?? [])];
          const idx = pieces.findIndex((x) => x.id === d.pieceId);
          if (idx < 0) return f;
          const p = pieces[idx];
          const nx = clamp(next.xPct, 0, 100 - p.wPct);
          const ny = clamp(next.yPct, 0, 100 - p.hPct);
          pieces[idx] = { ...p, xPct: round2(nx), yPct: round2(ny) };
          return { ...f, setPieces: pieces };
        });
        return;
      }
      const dxPct = ((e.clientX - d.startClientX) / d.floorWpx) * 100;
      const dyPct = ((e.clientY - d.startClientY) / d.floorHpx) * 100;
      const snapDim = (v: number) => {
        let c = clamp(v, 0, 100);
        if (snapGrid) {
          const step = e.shiftKey
            ? Math.max(0.25, gridStep / 4)
            : gridStep;
          c = clamp(Math.round(c / step) * step, 0, 100);
        }
        return round2(c);
      };
      const raw = applySetPieceResizePct(
        d.handle,
        d.start.xPct,
        d.start.yPct,
        d.start.wPct,
        d.start.hPct,
        dxPct,
        dyPct
      );
      let xPct = snapDim(raw.xPct);
      let yPct = snapDim(raw.yPct);
      let wPct = snapDim(raw.wPct);
      let hPct = snapDim(raw.hPct);
      wPct = Math.max(MIN_SET_PIECE_W_PCT, Math.min(wPct, 100 - xPct));
      hPct = Math.max(MIN_SET_PIECE_H_PCT, Math.min(hPct, 100 - yPct));
      xPct = clamp(xPct, 0, 100 - wPct);
      yPct = clamp(yPct, 0, 100 - hPct);
      updateActiveFormation((f) => {
        const pieces = [...(f.setPieces ?? [])];
        const idx = pieces.findIndex((x) => x.id === d.pieceId);
        if (idx < 0) return f;
        const p = pieces[idx];
        pieces[idx] = {
          ...p,
          xPct,
          yPct,
          wPct,
          hPct,
        };
        return { ...f, setPieces: pieces };
      });
    };
    const onUp = () => {
      setPieceDragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [pxToPct, snapGrid, gridStep, updateActiveFormation]);

  const handlePointerDownDancer = (
    e: ReactPointerEvent,
    dancerId: string,
    xPct: number,
    yPct: number
  ) => {
    if (e.button !== 0) return;
    if (editingDancerId) return;
    if (
      viewMode === "view" ||
      playbackDancers ||
      previewDancers ||
      !stageInteractionsEnabled
    )
      return;
    if (e.altKey && stageMainFloorRef.current) {
      const floor = stageMainFloorRef.current;
      const stack = document
        .elementsFromPoint(e.clientX, e.clientY)
        .filter(
          (n): n is HTMLElement =>
            n instanceof HTMLElement &&
            typeof n.dataset.dancerId === "string" &&
            n.dataset.dancerId !== "" &&
            floor.contains(n)
        )
        .map((n) => n.dataset.dancerId!);
      const uniq = [...new Set(stack)];
      if (uniq.length > 1) {
        const i0 = uniq.indexOf(dancerId);
        const next = uniq[(i0 + 1) % uniq.length];
        setSelectedDancerIds([next]);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    e.stopPropagation();

    /** Shift / Cmd / Ctrl クリックは「追加選択のトグル」だけで、ドラッグは始めない */
    const toggleOnly = e.shiftKey || e.metaKey || e.ctrlKey;
    let nextSelection: string[];
    if (toggleOnly) {
      nextSelection = selectedDancerIds.includes(dancerId)
        ? selectedDancerIds.filter((id) => id !== dancerId)
        : [...selectedDancerIds, dancerId];
      setSelectedDancerIds(nextSelection);
      return;
    }
    if (selectedDancerIds.includes(dancerId)) {
      /** すでに選択中 → 現在の選択を保ったまま、その全員をドラッグで一括移動 */
      nextSelection = selectedDancerIds;
    } else {
      /** 未選択のダンサーを押した場合はその 1 人だけ選択しなおす */
      nextSelection = [dancerId];
      setSelectedDancerIds(nextSelection);
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const el = stageMainFloorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + (xPct / 100) * r.width;
    const cy = r.top + (yPct / 100) * r.height;
    if (nextSelection.length <= 1) {
      dragRef.current = {
        dancerId,
        offsetXPx: e.clientX - cx,
        offsetYPx: e.clientY - cy,
      };
      return;
    }
    /** 複数選択の一括移動: 各ダンサーの初期位置を覚えておき、差分だけ一斉に動かす */
    const dancers =
      writeFormation?.dancers ?? activeFormation?.dancers ?? [];
    const startPositions = new Map<string, { xPct: number; yPct: number }>();
    for (const id of nextSelection) {
      const d = dancers.find((x) => x.id === id);
      if (d) startPositions.set(id, { xPct: d.xPct, yPct: d.yPct });
    }
    groupDragRef.current = {
      mode: "move",
      ids: nextSelection,
      startPositions,
      startClientX: e.clientX,
      startClientY: e.clientY,
      floorWpx: r.width,
      floorHpx: r.height,
    };
  };

  /** 複数選択の bounding box リサイズ開始 */
  const handlePointerDownGroupBoxHandle = (
    e: ReactPointerEvent,
    handle: GroupBoxHandle,
    startBox: { x0: number; y0: number; x1: number; y1: number }
  ) => {
    if (e.button !== 0) return;
    if (
      viewMode === "view" ||
      playbackDancers ||
      previewDancers ||
      !stageInteractionsEnabled
    )
      return;
    if (selectedDancerIds.length < 2) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const el = stageMainFloorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dancers =
      writeFormation?.dancers ?? activeFormation?.dancers ?? [];
    const startPositions = new Map<string, { xPct: number; yPct: number }>();
    for (const id of selectedDancerIds) {
      const d = dancers.find((x) => x.id === id);
      if (d) startPositions.set(id, { xPct: d.xPct, yPct: d.yPct });
    }
    groupDragRef.current = {
      mode: "scale",
      handle,
      ids: [...selectedDancerIds],
      startBox: { ...startBox },
      startPositions,
      startClientX: e.clientX,
      startClientY: e.clientY,
      floorWpx: r.width,
      floorHpx: r.height,
    };
  };

  /**
   * 代表ダンサーの右下ハンドル → 選択中のダンサー全員の○サイズ（px）を変える。
   * 選択が 1 件ならそのダンサーだけ、複数件なら全員が同じ差分ずつ変化する。
   */
  const handlePointerDownMarkerResize = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    if (
      viewMode === "view" ||
      playbackDancers ||
      previewDancers ||
      !stageInteractionsEnabled
    )
      return;
    if (selectedDancerIds.length < 1) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const dancers =
      writeFormation?.dancers ?? activeFormation?.dancers ?? [];
    const startSizes = new Map<string, number>();
    for (const id of selectedDancerIds) {
      const d = dancers.find((x) => x.id === id);
      if (!d) continue;
      const cur =
        typeof d.sizePx === "number" && Number.isFinite(d.sizePx)
          ? Math.round(d.sizePx)
          : baseMarkerPx;
      startSizes.set(id, cur);
    }
    if (startSizes.size === 0) return;
    markerResizeRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startSizes,
      ids: [...selectedDancerIds],
    };
    setMarkerDiamDraft(new Map(startSizes));
  };

  /** 空ステージを押したら範囲選択を始める（および選択のクリア） */
  const handlePointerDownFloor = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (
      viewMode === "view" ||
      playbackDancers ||
      previewDancers ||
      !stageInteractionsEnabled
    )
      return;
    /** ダンサー／大道具／ハンドル／ゴミ箱以外の床面のときだけ反応 */
    const target = e.target as HTMLElement;
    if (target.closest("[data-dancer-id]")) return;
    if (target.closest("[data-set-piece-id]")) return;
    if (target.closest("[data-group-box-handle]")) return;
    if (target.closest("[data-marker-resize-handle]")) return;
    const el = stageMainFloorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const xPct = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
    const yPct = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    marqueeSessionRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startXPct: xPct,
      startYPct: yPct,
      floorWpx: r.width,
      floorHpx: r.height,
      additive,
      baseIds: additive ? [...selectedDancerIds] : [],
      movedPx: 0,
    };
    if (!additive) setSelectedDancerIds([]);
    setSelectedSetPieceId(null);
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      /** 1: 単一ダンサーのドラッグ（ゴミ箱削除付き） */
      const d = dragRef.current;
      if (d) {
        const next = pxToPct(
          e.clientX - d.offsetXPx,
          e.clientY - d.offsetYPx,
          e.shiftKey
        );
        if (!next) return;
        const reveal = next.yPct >= TRASH_REVEAL_Y_PCT;
        if (reveal !== trashRevealActiveRef.current) {
          trashRevealActiveRef.current = reveal;
          setTrashUiVisible(reveal);
        }
        const overTrash = hitTrashDropZone(e.clientX, e.clientY);
        setTrashHotIfChanged(overTrash);
        if (overTrash) return;
        updateActiveFormation((f) => ({
          ...f,
          dancers: f.dancers.map((x) =>
            x.id === d.dancerId
              ? { ...x, xPct: next.xPct, yPct: next.yPct }
              : x
          ),
        }));
        return;
      }
      /** 2: 複数選択の一括移動 */
      const g = groupDragRef.current;
      if (g && g.mode === "move") {
        const dxPct = ((e.clientX - g.startClientX) / g.floorWpx) * 100;
        const dyPct = ((e.clientY - g.startClientY) / g.floorHpx) * 100;
        const idSet = new Set(g.ids);
        updateActiveFormation((f) => ({
          ...f,
          dancers: f.dancers.map((x) => {
            if (!idSet.has(x.id)) return x;
            const s = g.startPositions.get(x.id);
            if (!s) return x;
            const nx = clamp(s.xPct + dxPct, 2, 98);
            const ny = clamp(s.yPct + dyPct, 2, 98);
            return { ...x, xPct: round2(nx), yPct: round2(ny) };
          }),
        }));
        setTrashHotIfChanged(false);
        return;
      }
      /** 3: 複数選択の群スケール（枠のハンドル） */
      if (g && g.mode === "scale") {
        const el = stageMainFloorRef.current;
        if (!el) return;
        const rr = el.getBoundingClientRect();
        const curXPct = clamp(((e.clientX - rr.left) / rr.width) * 100, 0, 100);
        const curYPct = clamp(((e.clientY - rr.top) / rr.height) * 100, 0, 100);
        /**
         * コーナーハンドルは既定で比率（アスペクト保持）スケール。
         * 辺ハンドルは 1 軸のみ。Shift を押すと挙動を反転（コーナーでも 1 軸・辺でも比率保持）。
         */
        const isCorner =
          g.handle === "ne" ||
          g.handle === "nw" ||
          g.handle === "se" ||
          g.handle === "sw";
        const keepAspect = e.shiftKey ? !isCorner : isCorner;
        const { sx, sy, ax, ay } = groupScaleForHandle(
          g.handle,
          g.startBox,
          curXPct,
          curYPct,
          keepAspect
        );
        const idSet = new Set(g.ids);
        updateActiveFormation((f) => ({
          ...f,
          dancers: f.dancers.map((x) => {
            if (!idSet.has(x.id)) return x;
            const s = g.startPositions.get(x.id);
            if (!s) return x;
            const nx = clamp(ax + (s.xPct - ax) * sx, 2, 98);
            const ny = clamp(ay + (s.yPct - ay) * sy, 2, 98);
            return { ...x, xPct: round2(nx), yPct: round2(ny) };
          }),
        }));
        setTrashHotIfChanged(false);
        return;
      }
      /** 4: 代表ダンサー右下の○サイズハンドル（選択中の全員に同じ差分を適用） */
      const m = markerResizeRef.current;
      if (m) {
        const dx = e.clientX - m.startClientX;
        const dy = e.clientY - m.startClientY;
        /** 右下方向に引っ張ると大きく、左上に引くと小さくなる */
        const delta = (dx + dy) / 2;
        const draft = new Map<string, number>();
        for (const [id, s0] of m.startSizes) {
          const next = Math.round(clamp(s0 + delta, MARKER_PX_MIN, MARKER_PX_MAX));
          draft.set(id, next);
        }
        setMarkerDiamDraft(draft);
        setTrashHotIfChanged(false);
        return;
      }
      /** 5: マーキー（範囲選択） */
      const mq = marqueeSessionRef.current;
      if (mq) {
        const el = stageMainFloorRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const curXPct = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
        const curYPct = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);
        mq.movedPx = Math.max(
          mq.movedPx,
          Math.hypot(e.clientX - mq.startClientX, e.clientY - mq.startClientY)
        );
        setMarquee({
          startXPct: mq.startXPct,
          startYPct: mq.startYPct,
          curXPct,
          curYPct,
        });
        setTrashHotIfChanged(false);
        return;
      }
      setTrashHotIfChanged(false);
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (d && hitTrashDropZone(e.clientX, e.clientY)) {
        removeDancerById(d.dancerId);
      }
      dragRef.current = null;
      /** 群ドラッグ終了 */
      groupDragRef.current = null;
      /** ○サイズ確定（選択中の各ダンサーに `sizePx` を保存する） */
      const m = markerResizeRef.current;
      if (m && markerDiamDraft && markerDiamDraft.size > 0) {
        const changed = [...markerDiamDraft.entries()].some(
          ([id, v]) => m.startSizes.get(id) !== v
        );
        if (changed) {
          const nextSizes = new Map(markerDiamDraft);
          setProject((p) => ({
            ...p,
            formations: p.formations.map((f) =>
              f.id === formationIdForWrites
                ? {
                    ...f,
                    dancers: f.dancers.map((x) => {
                      const v = nextSizes.get(x.id);
                      if (typeof v !== "number") return x;
                      return { ...x, sizePx: v };
                    }),
                  }
                : f
            ),
          }));
        }
      }
      markerResizeRef.current = null;
      setMarkerDiamDraft(null);
      /** マーキー完了 → 範囲内のダンサーを選択 */
      const mq = marqueeSessionRef.current;
      if (mq) {
        const el = stageMainFloorRef.current;
        if (el) {
          const r = el.getBoundingClientRect();
          const endXPct = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
          const endYPct = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);
          const minX = Math.min(mq.startXPct, endXPct);
          const maxX = Math.max(mq.startXPct, endXPct);
          const minY = Math.min(mq.startYPct, endYPct);
          const maxY = Math.max(mq.startYPct, endYPct);
          const dragged = mq.movedPx > 3;
          if (dragged) {
            const dancersNow =
              writeFormation?.dancers ?? activeFormation?.dancers ?? [];
            const hit = dancersNow
              .filter(
                (x) =>
                  x.xPct >= minX &&
                  x.xPct <= maxX &&
                  x.yPct >= minY &&
                  x.yPct <= maxY
              )
              .map((x) => x.id);
            const combined = mq.additive
              ? Array.from(new Set([...mq.baseIds, ...hit]))
              : hit;
            setSelectedDancerIds(combined);
          }
        }
        marqueeSessionRef.current = null;
        setMarquee(null);
      }
      setTrashHotIfChanged(false);
      trashRevealActiveRef.current = false;
      setTrashUiVisible(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [
    pxToPct,
    updateActiveFormation,
    hitTrashDropZone,
    removeDancerById,
    setTrashHotIfChanged,
    markerDiamDraft,
    setProject,
    writeFormation,
    activeFormation,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (viewMode === "view") return;
      if (playbackDancers || previewDancers) return;
      if (editingDancerId) return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        setSelectedDancerIds([]);
        setMarquee(null);
        marqueeSessionRef.current = null;
        return;
      }
      /** 選択中が 1 件以上なら Alt+矢印で微移動。複数選択時は群全体を動かす。 */
      if (!e.altKey || selectedDancerIds.length === 0) return;
      const dk = e.key;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(dk)) return;
      e.preventDefault();
      const stepPx = e.shiftKey ? 0.05 : 0.25;
      const afterSnap = (nx: number, ny: number) => {
        const mode: SnapMode = snapGrid ? "fine" : "free";
        return {
          xPct: quantizeCoord(nx, mode),
          yPct: quantizeCoord(ny, mode),
        };
      };
      const idSet = new Set(selectedDancerIds);
      updateActiveFormation((f) => ({
        ...f,
        dancers: f.dancers.map((x) => {
          if (!idSet.has(x.id)) return x;
          let nx = x.xPct;
          let ny = x.yPct;
          if (dk === "ArrowLeft") nx -= stepPx;
          if (dk === "ArrowRight") nx += stepPx;
          if (dk === "ArrowUp") ny -= stepPx;
          if (dk === "ArrowDown") ny += stepPx;
          const q = afterSnap(nx, ny);
          return { ...x, xPct: q.xPct, yPct: q.yPct };
        }),
      }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    viewMode,
    playbackDancers,
    previewDancers,
    editingDancerId,
    selectedDancerIds,
    snapGrid,
    quantizeCoord,
    updateActiveFormation,
  ]);

  /** 客席の辺に応じた向きに、さらに 180° 回して「舞台の正面」を反対側から見る */
  const rot = (audienceRotationDeg(audienceEdge) + 180) % 360;

  const tapStageToEditLayout =
    viewMode === "edit" &&
    !!playbackDancers &&
    !previewDancers &&
    typeof onRequestLayoutEditFromStage === "function";

  const handleTapOverlayPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!tapStageToEditLayout || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onRequestLayoutEditFromStage();
  };

  const Wmm = stageWidthMm != null && stageWidthMm > 0 ? stageWidthMm : 0;
  const Dmm = stageDepthMm != null && stageDepthMm > 0 ? stageDepthMm : 0;
  const Smm = sideStageMm != null && sideStageMm > 0 ? sideStageMm : 0;
  const Bmm = backStageMm != null && backStageMm > 0 ? backStageMm : 0;
  const hasStageDims = Wmm > 0 && Dmm > 0;
  const outerWmm = Wmm + 2 * Smm;
  const outerDmm = Dmm + Bmm;
  const stageAspectRatio = hasStageDims ? `${outerWmm} / ${outerDmm}` : "4 / 3";
  const showShell = hasStageDims && (Smm > 0 || Bmm > 0);

  /** センターに近い順に k=1,2,3…（左右の線は同じ番号）。xp は SVG / 観客席帯ラベル共通 */
  const guideLineDrawMarks = useMemo(() => {
    const interval = centerFieldGuideIntervalMm;
    if (interval == null || interval <= 0 || Wmm <= 0) return [];
    const half = Wmm / 2;
    const marks: { xp: number; k: number }[] = [];
    let k = 1;
    const maxPairs = 200;
    while (k * interval <= half + 1e-9 && k <= maxPairs) {
      const deltaPct = (k * interval / Wmm) * 100;
      for (const x of [50 - deltaPct, 50 + deltaPct]) {
        const xr = Number.isFinite(x)
          ? Math.min(100, Math.max(0, Math.round(x * 2) / 2))
          : x;
        marks.push({ xp: xr + 0.5, k });
      }
      k++;
    }
    return marks;
  }, [centerFieldGuideIntervalMm, Wmm]);

  const stripShellStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as const,
    fontSize: "10px",
    lineHeight: 1.35,
    color: "#64748b",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #0f172a 100%)",
    border: "1px solid rgba(71,85,105,0.35)",
    minWidth: 0,
    minHeight: 0,
    padding: "4px",
  };

  const mainFloorStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    background:
      "linear-gradient(180deg, #1e293b 0%, #0f172a 55%, #020617 100%)",
  };

  const mmLabel = (xPct: number, yPct: number) => {
    if (stageWidthMm == null || stageDepthMm == null) return null;
    const xMm = Math.round((xPct / 100) * stageWidthMm);
    const yMm = Math.round((yPct / 100) * stageDepthMm);
    return `${xMm} × ${yMm} mm`;
  };

  const showTrashDrop =
    viewMode === "edit" &&
    !playbackDancers &&
    !previewDancers &&
    trashUiVisible;

  /** 選択中ダンサーを囲む bounding box（pct 単位）。2 件以上で表示。 */
  const selectionBox = useMemo(() => {
    if (playbackOrPreview) return null;
    if (viewMode === "view") return null;
    const ids = selectedDancerIds;
    if (ids.length < 2) return null;
    const ds = (writeFormation?.dancers ?? activeFormation?.dancers ?? []).filter(
      (x) => ids.includes(x.id)
    );
    if (ds.length < 2) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const d of ds) {
      if (d.xPct < x0) x0 = d.xPct;
      if (d.yPct < y0) y0 = d.yPct;
      if (d.xPct > x1) x1 = d.xPct;
      if (d.yPct > y1) y1 = d.yPct;
    }
    if (
      !Number.isFinite(x0) ||
      !Number.isFinite(y0) ||
      !Number.isFinite(x1) ||
      !Number.isFinite(y1)
    )
      return null;
    return { x0, y0, x1, y1 };
  }, [selectedDancerIds, writeFormation, activeFormation, playbackOrPreview, viewMode]);

  /** 選択中の代表ダンサー（先頭）の座標。○サイズハンドルをその右下に置く。 */
  const primarySelectedDancer = useMemo(() => {
    if (playbackOrPreview) return null;
    if (viewMode === "view") return null;
    if (!stageInteractionsEnabled) return null;
    if (selectedDancerIds.length < 1) return null;
    const ds = writeFormation?.dancers ?? activeFormation?.dancers ?? [];
    const id = selectedDancerIds[0]!;
    return ds.find((x) => x.id === id) ?? null;
  }, [
    selectedDancerIds,
    writeFormation,
    activeFormation,
    playbackOrPreview,
    viewMode,
    stageInteractionsEnabled,
  ]);

  let contextMenuStyle: CSSProperties | null = null;
  if (stageContextMenu) {
    const pad = 8;
    const mw = 132;
    const mh = 52;
    const maxL =
      typeof window !== "undefined" ? window.innerWidth - mw - pad : stageContextMenu.clientX;
    const maxT =
      typeof window !== "undefined" ? window.innerHeight - mh - pad : stageContextMenu.clientY;
    contextMenuStyle = {
      position: "fixed",
      left: Math.max(pad, Math.min(stageContextMenu.clientX, maxL)),
      top: Math.max(pad, Math.min(stageContextMenu.clientY, maxT)),
      zIndex: 10000,
      minWidth: `${mw}px`,
      padding: "6px",
      borderRadius: "10px",
      border: "1px solid #475569",
      background: "#0f172a",
      boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
    };
  }

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", minHeight: 0 }}>
      {previewDancers && previewDancers.length > 0 && (
        <div
          style={{
            fontSize: "11px",
            color: "#64748b",
            textAlign: "center",
            letterSpacing: "0.05em",
          }}
        >
          <div
            style={{
              color: "#c4b5fd",
              fontWeight: 600,
            }}
          >
            フォーメーション案プレビュー
          </div>
        </div>
      )}
      {stageWidthMm != null && stageDepthMm != null && (
        <div
          style={{
            fontSize: "10px",
            color: "#94a3b8",
            textAlign: "center",
            lineHeight: 1.45,
          }}
        >
          {formatStageMmSummary(stageWidthMm, stageDepthMm)}
          {(Smm > 0 || Bmm > 0 || (centerFieldGuideIntervalMm != null && centerFieldGuideIntervalMm > 0)) && (
            <div style={{ marginTop: "4px", fontSize: "9px", color: "#64748b" }}>
              {Smm > 0 && <>サイド各 {formatMeterCmLabel(Smm)} · </>}
              {Bmm > 0 && <>バック {formatMeterCmLabel(Bmm)} · </>}
              {centerFieldGuideIntervalMm != null && centerFieldGuideIntervalMm > 0 && (() => {
                const u = mmToMeterCm(centerFieldGuideIntervalMm);
                return (
                  <>
                    センターからの場ミリ {u.m} m {u.cm} cm（{centerFieldGuideIntervalMm} mm）
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
      <div
        style={{
          flex: 1,
          minHeight: "280px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "640px",
            aspectRatio: stageAspectRatio,
            transform: `rotate(${rot}deg)`,
            transformOrigin: "center center",
            transition: "transform 0.2s ease, aspect-ratio 0.2s ease",
          }}
        >
          <div
            id="stage-export-root"
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              borderRadius: "12px",
              border: "1px solid #334155",
              overflow: "hidden",
              touchAction: "none",
              boxShadow: previewDancers?.length
                ? "0 0 0 2px rgba(167,139,250,0.65), 0 12px 40px rgba(0,0,0,0.35)"
                : undefined,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                position: "relative",
                overflow: "hidden",
                display: showShell ? "grid" : "block",
                ...(showShell
                  ? {
                      gridTemplateRows: Bmm > 0 ? `${Bmm}fr ${Dmm}fr` : `${Dmm}fr`,
                      gridTemplateColumns: Smm > 0 ? `${Smm}fr ${Wmm}fr ${Smm}fr` : `${Wmm}fr`,
                      background: "#020617",
                    }
                  : {
                      background:
                        "linear-gradient(180deg, #1e293b 0%, #0f172a 55%, #020617 100%)",
                    }),
              }}
            >
            {showShell && Bmm > 0 && (
              <div
                style={{
                  ...stripShellStyle,
                  gridColumn: "1 / -1",
                  gridRow: 1,
                  borderBottom: "1px solid #334155",
                }}
              >
                バックステージ
                <br />
                {formatMeterCmLabel(Bmm)}
              </div>
            )}
            {showShell && Smm > 0 && (
              <div
                style={{
                  ...stripShellStyle,
                  gridColumn: 1,
                  gridRow: Bmm > 0 ? 2 : 1,
                  borderRight: "1px solid #334155",
                }}
              >
                サイド
                <br />
                {formatMeterCmLabel(Smm)}
              </div>
            )}
            <div
              ref={stageMainFloorRef}
              onPointerDownCapture={(e) => {
                if (!isPlaying || !onStopPlaybackRequest || e.button !== 0) return;
                const el = e.target as HTMLElement;
                if (el.closest("button")) return;
                e.preventDefault();
                onStopPlaybackRequest();
              }}
              onPointerDown={handlePointerDownFloor}
              style={{
                ...mainFloorStyle,
                background: showShell
                  ? (mainFloorStyle.background as string)
                  : "transparent",
                ...(showShell
                  ? {
                      gridColumn: Smm > 0 ? 2 : 1,
                      gridRow: Bmm > 0 ? 2 : 1,
                      ...(Smm === 0 && Bmm > 0 ? { gridColumn: "1 / -1" } : {}),
                    }
                  : { position: "relative", width: "100%", height: "100%" }),
              }}
            >
            {snapGrid && (
              <svg
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  opacity: 0.35,
                }}
                preserveAspectRatio="none"
              >
                {Array.from(
                  { length: Math.floor(100 / gridStep) + 1 },
                  (_, i) => i * gridStep
                ).map((g) => (
                  <g key={g}>
                    <line
                      x1={`${g}%`}
                      y1="0%"
                      x2={`${g}%`}
                      y2="100%"
                      stroke="#475569"
                      strokeWidth="0.5"
                    />
                    <line
                      x1="0%"
                      y1={`${g}%`}
                      x2="100%"
                      y2={`${g}%`}
                      stroke="#475569"
                      strokeWidth="0.5"
                    />
                  </g>
                ))}
              </svg>
            )}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 2,
              }}
              aria-hidden
            >
              <line
                x1="50"
                y1="0"
                x2="50"
                y2="100"
                stroke="rgba(248, 250, 252, 0.28)"
                strokeWidth="0.35"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1="0"
                y1="50"
                x2="100"
                y2="50"
                stroke="rgba(248, 250, 252, 0.28)"
                strokeWidth="0.35"
                vectorEffect="non-scaling-stroke"
              />
              {guideLineDrawMarks.map(({ xp, k }, i) => (
                <line
                  key={`gm-${i}-${k}-${xp}`}
                  x1={xp}
                  y1="0"
                  x2={xp}
                  y2="100"
                  stroke="rgba(251, 191, 36, 0.72)"
                  strokeWidth="0.4"
                  strokeDasharray="1.6 1.6"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: "14%",
                background:
                  "linear-gradient(180deg, transparent, rgba(15,23,42,0.85))",
                borderTop: "1px solid rgba(71,85,105,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                color: "#64748b",
                pointerEvents: "none",
                zIndex: 3,
              }}
            >
              観客席
            </div>
            {guideLineDrawMarks.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: "14%",
                  pointerEvents: "none",
                  zIndex: 4,
                }}
                aria-hidden
              >
                {guideLineDrawMarks.map(({ xp, k }, i) => (
                  <span
                    key={`glabel-${i}-${k}-${xp}`}
                    style={{
                      position: "absolute",
                      left: `${xp}%`,
                      top: "2px",
                      transform: "translateX(-50%)",
                      fontSize: "9px",
                      fontWeight: 700,
                      color: "#fef3c7",
                      textShadow:
                        "0 0 3px rgba(15,23,42,0.95), 0 1px 1px rgba(0,0,0,0.75)",
                      lineHeight: 1,
                      fontFamily: "system-ui, sans-serif",
                    }}
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}
            {displaySetPieces.map((p) => {
              const fill = resolveSetPieceFill(p);
              const selectedSp =
                selectedSetPieceId === p.id && setPiecesEditable;
              const resizeHandles: {
                h: SetPieceResizeHandle;
                cursor: string;
                pos: CSSProperties;
              }[] = [
                { h: "nw", cursor: "nwse-resize", pos: { left: 0, top: 0, transform: "translate(-50%, -50%)" } },
                { h: "n", cursor: "ns-resize", pos: { left: "50%", top: 0, transform: "translate(-50%, -50%)" } },
                { h: "ne", cursor: "nesw-resize", pos: { right: 0, top: 0, transform: "translate(50%, -50%)" } },
                { h: "e", cursor: "ew-resize", pos: { right: 0, top: "50%", transform: "translate(50%, -50%)" } },
                { h: "se", cursor: "nwse-resize", pos: { right: 0, bottom: 0, transform: "translate(50%, 50%)" } },
                { h: "s", cursor: "ns-resize", pos: { left: "50%", bottom: 0, transform: "translate(-50%, 50%)" } },
                { h: "sw", cursor: "nesw-resize", pos: { left: 0, bottom: 0, transform: "translate(-50%, 50%)" } },
                { h: "w", cursor: "ew-resize", pos: { left: 0, top: "50%", transform: "translate(-50%, -50%)" } },
              ];
              return (
                <div
                  key={p.id}
                  data-set-piece-id={p.id}
                  style={{
                    position: "absolute",
                    left: `${p.xPct}%`,
                    top: `${p.yPct}%`,
                    width: `${p.wPct}%`,
                    height: `${p.hPct}%`,
                    zIndex: selectedSp ? 5 : 2,
                    boxSizing: "border-box",
                    pointerEvents: setPiecesEditable ? "auto" : "none",
                  }}
                >
                  <button
                    type="button"
                    aria-label={p.label?.trim() ? p.label : "大道具"}
                    title={
                      setPiecesEditable
                        ? [
                            p.label?.trim() ||
                              `大道具（${setPieceKindJa(p.kind)}）`,
                            "ドラッグで移動",
                            "角・辺のハンドルでリサイズ（§10）",
                            snapGrid ? "Shift+ドラッグで細かいグリッド" : null,
                            "Delete / Backspace で削除",
                            "右クリックで削除メニュー",
                            "ダブルクリックでキュー間ギャップの補間 ON/OFF",
                            p.interpolateInGaps ? "（補間: ON）" : "（補間: OFF）",
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : undefined
                    }
                    tabIndex={setPiecesEditable ? 0 : -1}
                    onPointerDown={(e) => handlePointerDownSetPiece(e, p)}
                    onContextMenu={(e) => {
                      if (
                        viewMode === "view" ||
                        playbackOrPreview ||
                        !setPiecesEditable
                      )
                        return;
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedSetPieceId(p.id);
                      setStageContextMenu({
                        kind: "setPiece",
                        clientX: e.clientX,
                        clientY: e.clientY,
                        pieceId: p.id,
                      });
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!setPiecesEditable) return;
                      updateActiveFormation((f) => ({
                        ...f,
                        setPieces: (f.setPieces ?? []).map((x) =>
                          x.id === p.id
                            ? { ...x, interpolateInGaps: !x.interpolateInGaps }
                            : x
                        ),
                      }));
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      border:
                        selectedSp
                          ? "2px solid rgba(251, 191, 36, 0.92)"
                          : p.interpolateInGaps
                            ? "1px solid rgba(45, 212, 191, 0.72)"
                            : "1px solid rgba(148, 163, 184, 0.55)",
                      borderRadius: p.kind === "ellipse" ? "999px" : 6,
                      background: "rgba(15, 23, 42, 0.2)",
                      boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.2)",
                      cursor: setPiecesEditable ? "grab" : "default",
                      padding: 0,
                      margin: 0,
                      boxSizing: "border-box",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      justifyContent: "flex-end",
                      textAlign: "left",
                      color: "#f1f5f9",
                      fontSize: "10px",
                      lineHeight: 1.25,
                      fontWeight: 600,
                      overflow: "hidden",
                      userSelect: "none",
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 18,
                        pointerEvents: "none",
                      }}
                    >
                      {p.kind === "triangle" ? (
                        <div
                          style={{
                            position: "absolute",
                            left: "8%",
                            right: "8%",
                            top: "6%",
                            bottom: "10%",
                            clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
                            WebkitClipPath:
                              "polygon(50% 0%, 0% 100%, 100% 100%)",
                            background: fill,
                            opacity: 0.92,
                          }}
                        />
                      ) : p.kind === "ellipse" ? (
                        <div
                          style={{
                            position: "absolute",
                            left: "6%",
                            right: "6%",
                            top: "6%",
                            bottom: "6%",
                            borderRadius: "50%",
                            background: fill,
                            opacity: 0.92,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            position: "absolute",
                            left: "6%",
                            right: "6%",
                            top: "6%",
                            bottom: "6%",
                            borderRadius: 5,
                            background: fill,
                            opacity: 0.92,
                          }}
                        />
                      )}
                    </div>
                    <span
                      style={{
                        position: "relative",
                        zIndex: 1,
                        padding: "2px 6px 4px",
                        textShadow:
                          "0 0 4px rgba(15,23,42,0.95), 0 1px 2px rgba(0,0,0,0.8)",
                        alignSelf: "flex-start",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.label?.trim() ? p.label : "大道具"}
                    </span>
                  </button>
                  {selectedSp
                    ? resizeHandles.map(({ h, cursor, pos }) => (
                        <div
                          key={h}
                          role="presentation"
                          aria-hidden
                          title={`リサイズ（${h}）`}
                          onPointerDown={(e) =>
                            handlePointerDownSetPieceResize(e, p, h)
                          }
                          style={{
                            position: "absolute",
                            width: 11,
                            height: 11,
                            borderRadius: 2,
                            background: "rgba(251, 191, 36, 0.95)",
                            border: "1px solid #0f172a",
                            zIndex: 6,
                            boxSizing: "border-box",
                            touchAction: "none",
                            cursor,
                            ...pos,
                          }}
                        />
                      ))
                    : null}
                </div>
              );
            })}
            {marquee && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: `${Math.min(marquee.startXPct, marquee.curXPct)}%`,
                  top: `${Math.min(marquee.startYPct, marquee.curYPct)}%`,
                  width: `${Math.abs(marquee.curXPct - marquee.startXPct)}%`,
                  height: `${Math.abs(marquee.curYPct - marquee.startYPct)}%`,
                  border: "1px dashed rgba(129, 140, 248, 0.95)",
                  background: "rgba(99, 102, 241, 0.12)",
                  pointerEvents: "none",
                  zIndex: 7,
                  boxSizing: "border-box",
                }}
              />
            )}
            {selectionBox && (
              <div
                aria-label="選択中のダンサー"
                data-group-box
                style={{
                  position: "absolute",
                  left: `${selectionBox.x0}%`,
                  top: `${selectionBox.y0}%`,
                  width: `${Math.max(0.01, selectionBox.x1 - selectionBox.x0)}%`,
                  height: `${Math.max(0.01, selectionBox.y1 - selectionBox.y0)}%`,
                  border: "1px dashed rgba(167, 139, 250, 0.9)",
                  borderRadius: 4,
                  background: "rgba(99, 102, 241, 0.07)",
                  pointerEvents: "none",
                  zIndex: 6,
                  boxSizing: "border-box",
                }}
              >
                {GROUP_BOX_HANDLES.map(({ h, cursor, pos }) => (
                  <div
                    key={h}
                    data-group-box-handle={h}
                    role="presentation"
                    aria-hidden
                    title={`群のリサイズ（${h}）${
                      h === "n" || h === "s" || h === "e" || h === "w"
                        ? "・Shift で比率保持"
                        : "・Shift で 1 軸のみ"
                    }`}
                    onPointerDown={(e) =>
                      handlePointerDownGroupBoxHandle(e, h, selectionBox)
                    }
                    style={{
                      position: "absolute",
                      width: 11,
                      height: 11,
                      borderRadius: 2,
                      background: "rgba(167, 139, 250, 0.95)",
                      border: "1px solid #0f172a",
                      zIndex: 7,
                      boxSizing: "border-box",
                      touchAction: "none",
                      pointerEvents: "auto",
                      cursor,
                      ...pos,
                    }}
                  />
                ))}
              </div>
            )}
            {displayDancers.map((d) => {
              const dMarkerPx = effectiveMarkerPx(d);
              const dLabelFontPx = Math.max(
                10,
                Math.min(22, Math.round(14 * (dMarkerPx / 44)))
              );
              return (
              <button
                key={d.id}
                type="button"
                data-dancer-id={d.id}
                title={
                  !playbackOrPreview
                    ? [
                        mmLabel(d.xPct, d.yPct),
                        "ダブルクリックで名前編集",
                        "右クリックで削除メニュー",
                        "下端へ寄せるとゴミ箱が出ます。そこへドロップで削除",
                        "Shift / Cmd / Ctrl+クリックで複数選択に追加",
                        "空のステージをドラッグで範囲選択",
                        snapGrid ? "Shift+ドラッグで細かいグリッドにスナップ" : null,
                        "Alt+矢印で微移動（Shift+Altでさらに細かく）",
                        "Alt+クリックで重なった印の背面へ切替（§10）",
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : mmLabel(d.xPct, d.yPct) || undefined
                }
                onPointerDown={(e) =>
                  handlePointerDownDancer(e, d.id, d.xPct, d.yPct)
                }
                onContextMenu={(e) => {
                  if (
      viewMode === "view" ||
      playbackDancers ||
      previewDancers ||
      !stageInteractionsEnabled
    )
      return;
                  e.preventDefault();
                  e.stopPropagation();
                  setStageContextMenu({
                    kind: "dancer",
                    clientX: e.clientX,
                    clientY: e.clientY,
                    dancerId: d.id,
                  });
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (
                    viewMode === "view" ||
                    playbackDancers ||
                    previewDancers ||
                    !stageInteractionsEnabled
                  )
                    return;
                  setEditingLabelDraft(
                    (d.label?.trim() ? d.label : "?").slice(0, DANCER_LABEL_MAX)
                  );
                  setEditingDancerId(d.id);
                }}
                style={{
                  position: "absolute",
                  left: `${d.xPct}%`,
                  top: `${d.yPct}%`,
                  transform: playbackOrPreview
                    ? "translate3d(-50%, -50%, 0)"
                    : "translate(-50%, -50%)",
                  willChange: playbackOrPreview ? "transform" : undefined,
                  width: `${dMarkerPx}px`,
                  height: `${dMarkerPx}px`,
                  borderRadius: "50%",
                  border:
                    editingDancerId === d.id
                      ? "2px solid rgba(99,102,241,0.95)"
                      : selectedDancerIds.includes(d.id)
                        ? selectedDancerIds.length >= 2
                          ? "2px solid rgba(167,139,250,0.95)"
                          : "2px solid rgba(251,191,36,0.92)"
                        : "2px solid rgba(255,255,255,0.35)",
                  backgroundColor:
                    DANCER_PALETTE[d.colorIndex % DANCER_PALETTE.length],
                  color: "#0f172a",
                  fontWeight: 700,
                  fontSize: `${dLabelFontPx}px`,
                  cursor:
                    editingDancerId === d.id
                      ? "default"
                      : viewMode === "view" ||
                          playbackDancers ||
                          previewDancers ||
                          !stageInteractionsEnabled
                        ? "default"
                        : "grab",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
                  padding: 0,
                  userSelect: "none",
                  zIndex: 4,
                  pointerEvents:
                    viewMode === "view" ||
                    playbackDancers ||
                    previewDancers ||
                    !stageInteractionsEnabled
                      ? "none"
                      : "auto",
                }}
              >
                {editingDancerId === d.id ? (
                  <input
                    ref={labelInputRef}
                    type="text"
                    value={editingLabelDraft}
                    maxLength={DANCER_LABEL_MAX}
                    aria-label="ダンサー名"
                    onChange={(e) =>
                      setEditingLabelDraft(e.target.value.slice(0, DANCER_LABEL_MAX))
                    }
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => {
                      if (skipLabelCommitRef.current) {
                        skipLabelCommitRef.current = false;
                        setEditingDancerId(null);
                        return;
                      }
                      if (viewMode === "view") {
                        setEditingDancerId(null);
                        return;
                      }
                      const label =
                        editingLabelDraft.trim().slice(0, DANCER_LABEL_MAX) || "?";
                      const dancerId = d.id;
                      setProject((p) => {
                        const fid = formationIdForWrites;
                        const form = p.formations.find((f) => f.id === fid);
                        const spot = form?.dancers.find((x) => x.id === dancerId);
                        if (!form || !spot) return p;
                        const cmid = spot.crewMemberId;
                        let crews = p.crews;
                        if (cmid) {
                          crews = p.crews.map((crew) => ({
                            ...crew,
                            members: crew.members.map((m) =>
                              m.id === cmid ? { ...m, label } : m
                            ),
                          }));
                        }
                        return {
                          ...p,
                          crews,
                          formations: p.formations.map((f) =>
                            f.id === fid
                              ? {
                                  ...f,
                                  dancers: f.dancers.map((x) =>
                                    x.id === dancerId ? { ...x, label } : x
                                  ),
                                }
                              : f
                          ),
                        };
                      });
                      setEditingDancerId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                      if (e.key === "Escape") {
                        skipLabelCommitRef.current = true;
                        setEditingDancerId(null);
                      }
                    }}
                    style={{
                      width: `${Math.max(28, Math.round(dMarkerPx * 0.82))}px`,
                      padding: "0 2px",
                      margin: 0,
                      border: "none",
                      borderRadius: "4px",
                      background: "rgba(255,255,255,0.92)",
                      color: "#0f172a",
                      fontSize: `${Math.max(9, Math.min(14, dLabelFontPx - 2))}px`,
                      fontWeight: 700,
                      textAlign: "center",
                      lineHeight: 1.1,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                ) : (
                  d.label || "?"
                )}
              </button>
              );
            })}
            {primarySelectedDancer && !marquee && (() => {
              const pMarkerPx = effectiveMarkerPx(primarySelectedDancer);
              const tip =
                selectedDancerIds.length >= 2
                  ? `選択中の ${selectedDancerIds.length} 人の ○ サイズを一括変更（現 ${pMarkerPx}px・ドラッグで変更）`
                  : `○のサイズ（${pMarkerPx}px）・ドラッグで変更`;
              return (
              <div
                data-marker-resize-handle
                role="presentation"
                aria-hidden
                title={tip}
                onPointerDown={handlePointerDownMarkerResize}
                style={{
                  position: "absolute",
                  left: `${primarySelectedDancer.xPct}%`,
                  top: `${primarySelectedDancer.yPct}%`,
                  /** ○の右下 45° 外側にオフセット（pMarkerPx/2 + ちょい余白） */
                  transform: `translate(calc(${pMarkerPx * 0.35}px), calc(${
                    pMarkerPx * 0.35
                  }px))`,
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: "#fbbf24",
                  border: "1px solid #0f172a",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
                  cursor: "nwse-resize",
                  touchAction: "none",
                  zIndex: 9,
                  pointerEvents: "auto",
                  boxSizing: "border-box",
                }}
              />
              );
            })()}
            {tapStageToEditLayout && (
              <div
                role="presentation"
                title="クリックすると選択中のフォーメーションをドラッグで調整できます"
                onPointerDown={handleTapOverlayPointerDown}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 8,
                  cursor: "pointer",
                  background: "transparent",
                }}
              />
            )}
            </div>
            {showShell && Smm > 0 && (
              <div
                style={{
                  ...stripShellStyle,
                  gridColumn: 3,
                  gridRow: Bmm > 0 ? 2 : 1,
                  borderLeft: "1px solid #334155",
                }}
              >
                サイド
                <br />
                {formatMeterCmLabel(Smm)}
              </div>
            )}
            {showTrashDrop && (
              <div
                ref={trashDockRef}
                role="region"
                aria-label="ダンサーの印をここにドラッグして離すと削除されます"
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: "10px",
                  transform: "translateX(-50%)",
                  zIndex: 30,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  width: "min(118px, 34%)",
                  minHeight: "64px",
                  padding: "8px 6px",
                  borderRadius: "10px",
                  border: `2px dashed ${
                    trashHot ? "rgba(248,113,113,0.95)" : "rgba(100,116,139,0.8)"
                  }`,
                  background: trashHot
                    ? "rgba(127,29,29,0.62)"
                    : "rgba(15,23,42,0.88)",
                  color: "#e2e8f0",
                  fontSize: "9px",
                  lineHeight: 1.3,
                  textAlign: "center",
                  pointerEvents: "none",
                  boxShadow: "0 4px 18px rgba(0,0,0,0.4)",
                  userSelect: "none",
                }}
              >
                <span style={{ fontSize: "22px", lineHeight: 1 }} aria-hidden>
                  🗑
                </span>
                <span>ドラッグ＆ドロップで削除</span>
              </div>
            )}
            </div>
            {hanamichiEnabled ? (
              <div
                style={{
                  flex: "0 0 auto",
                  height: `${hanamichiDepthPct}%`,
                  minHeight: 28,
                  maxHeight: "42%",
                  borderTop: "1px solid rgba(71, 85, 105, 0.55)",
                  background: "linear-gradient(180deg, #0f172a, #020617)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  color: "#64748b",
                  letterSpacing: "0.14em",
                  userSelect: "none",
                }}
              >
                花道
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    {stageContextMenu && contextMenuStyle && (
      <div ref={stageContextMenuRef} style={contextMenuStyle}>
        <button
          type="button"
          style={{
            ...btnSecondary,
            width: "100%",
            borderColor: "#7f1d1d",
            color: "#fecaca",
            fontWeight: 600,
          }}
          onClick={() => {
            if (stageContextMenu.kind === "dancer") {
              removeDancerById(stageContextMenu.dancerId);
            } else {
              removeSetPieceById(stageContextMenu.pieceId);
            }
          }}
        >
          削除
        </button>
      </div>
    )}
    </>
  );
}

export const btnPrimary: CSSProperties = {
  padding: "8px 14px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #4f46e5, #ec4899)",
  color: "white",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
};

export const btnSecondary: CSSProperties = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #475569",
  backgroundColor: "#0f172a",
  color: "#e2e8f0",
  fontSize: "13px",
  cursor: "pointer",
};
