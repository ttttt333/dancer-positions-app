import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { ChoreographyProjectJson, Cue, DancerSpot } from "../types/choreography";
import {
  cloneFormationForNewCue,
  DEFAULT_CUE_SPAN_WITH_AUDIO_SEC,
  MIN_CUE_DURATION_SEC,
  PLACEHOLDER_TIMELINE_CAP_SEC,
  resolveCueIntervalNonOverlap,
  sortCuesByStart,
} from "../lib/cueInterval";
import {
  dancersForLayoutPreset,
  LAYOUT_PRESET_OPTIONS,
  LAYOUT_PRESET_LABELS,
  PRESET_CATEGORIES,
  type LayoutPresetId,
} from "../lib/formationLayouts";
import {
  dancersFromFormationBoxItem,
  FORMATION_BOX_CHANGE_EVENT,
  listFormationBoxItems,
} from "../lib/formationBox";
import { mergeStageSnapshotIntoProject } from "../lib/savedSpotStageSnapshot";
import { FormationBoxItemThumb } from "./FormationBoxItemThumb";

/**
 * ステージの「＋キュー」用の右側パネル。
 * - 開始時刻
 * - 人数（±）
 * - 立ち位置について（4 モード）＋名簿取り込み＋雛形／保存リストの選択（「今の立ち位置を変更」でも雛形を選べる）
 */

type AddMode = "template" | "saved" | "edit_current" | "duplicate";

type Props = {
  open: boolean;
  onClose: () => void;
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  currentTimeSec: number;
  durationSec: number;
  /** タイムライン／ステージのキュー切替で選ばれているキュー（「今の立ち位置を変更」用） */
  selectedCueId?: string | null;
  /** キュー作成後（選択・再生停止などは親で処理） */
  onCueCreated?: (cueId: string, startSec: number) => void;
  onStagePreviewChange?: (dancers: DancerSpot[] | null) => void;
  /** 名簿取り込み（ステージツールバーと同じ処理を親で実行） */
  onImportRoster?: () => void;
};

const PRESETS = LAYOUT_PRESET_OPTIONS;

function formatSec(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00.0";
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
}

function parseTimeString(raw: string): number {
  const s = raw.trim();
  if (!s) return NaN;
  if (s.includes(":")) {
    const [mRaw, sRaw = "0"] = s.split(":");
    const m = Number(mRaw);
    const sec = Number(sRaw);
    if (!Number.isFinite(m) || !Number.isFinite(sec)) return NaN;
    return m * 60 + sec;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function transferIdentitiesByOrder(
  newDancers: DancerSpot[],
  oldDancers: DancerSpot[]
): DancerSpot[] {
  return newDancers.map((nd, i) => {
    const od = oldDancers[i];
    if (!od) return nd;
    const markerBadge =
      od.crewMemberId
        ? ""
        : od.markerBadge !== undefined
          ? od.markerBadge
          : nd.markerBadge;
    const markerBadgeSource = od.crewMemberId
      ? undefined
      : od.markerBadgeSource;
    return {
      ...nd,
      id: od.id,
      label: od.label,
      colorIndex: od.colorIndex,
      crewMemberId: od.crewMemberId,
      markerBadge,
      markerBadgeSource,
      sizePx: od.sizePx ?? nd.sizePx,
      note: od.note ?? nd.note,
      heightCm: od.heightCm ?? nd.heightCm,
    };
  });
}

function activeFormationDancers(project: ChoreographyProjectJson): DancerSpot[] {
  const f = project.formations.find((x) => x.id === project.activeFormationId);
  return f ? f.dancers.map((d) => ({ ...d })) : [];
}

/** 人数 `targetN` に合わせて並びを伸縮（足りない分は横一列プリセットで補完） */
function dancersForTargetCount(
  base: DancerSpot[],
  targetN: number,
  spacing: { dancerSpacingMm?: number | null; stageWidthMm?: number | null }
): DancerSpot[] {
  if (!Number.isFinite(targetN) || targetN < 1) return [];
  if (targetN === base.length) return base.map((d) => ({ ...d }));
  if (targetN < base.length) return base.slice(0, targetN).map((d) => ({ ...d }));
  const grown = dancersForLayoutPreset(targetN, "line", {
    dancerSpacingMm: spacing.dancerSpacingMm ?? undefined,
    stageWidthMm: spacing.stageWidthMm ?? undefined,
  });
  return transferIdentitiesByOrder(grown, base);
}

const panelShellStyle: CSSProperties = {
  position: "fixed",
  top: "max(56px, calc(env(safe-area-inset-top, 0px) + 52px))",
  right: "max(12px, env(safe-area-inset-right, 0px))",
  bottom: "max(12px, env(safe-area-inset-bottom, 0px))",
  left: "max(12px, env(safe-area-inset-left, 0px))",
  width: "auto",
  maxWidth:
    "min(460px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)))",
  marginLeft: "auto",
  /** 言語スイッチャー（z40）や他オーバーレイより手前に固定し、フッターの決定が隠れないようにする */
  zIndex: 200,
  display: "flex",
  flexDirection: "column",
  pointerEvents: "auto",
};

const panelCardStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  width: "100%",
  display: "flex",
  flexDirection: "column",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "12px",
  boxShadow: "0 20px 50px rgba(0,0,0,0.55)",
  color: "#e2e8f0",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "12px 16px",
  borderBottom: "1px solid #1e293b",
  background: "#0b1220",
};

const bodyStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto",
  padding: "14px 16px 10px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const footerStyle: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "10px",
  padding: "10px 16px",
  borderTop: "1px solid #1e293b",
  background: "#0b1220",
};

const sectionLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "12px",
  fontWeight: 700,
  color: "#94a3b8",
  letterSpacing: "0.04em",
  marginBottom: "6px",
};

const sectionNumberStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  background: "#1e293b",
  color: "#e2e8f0",
  fontSize: "11px",
  fontWeight: 700,
};

const inputStyle: CSSProperties = {
  padding: "6px 8px",
  borderRadius: "6px",
  border: "1px solid #334155",
  background: "#0b1220",
  color: "#e2e8f0",
  fontSize: "13px",
  lineHeight: 1.3,
};

const btnBase: CSSProperties = {
  padding: "8px 14px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#1e293b",
  color: "#e2e8f0",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  lineHeight: 1.2,
};

const btnPrimary: CSSProperties = {
  ...btnBase,
  borderColor: "#0284c7",
  background: "#0ea5e9",
  color: "#0b1220",
};

const modeCardBase: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "4px",
  padding: "8px 10px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#0b1220",
  color: "#e2e8f0",
  fontSize: "12px",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};

/** 雛形グリッドのボタンと同系の、形の箱用コンパクトチップ */
const presetChipBase: CSSProperties = {
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "3px",
  padding: "5px 6px 6px",
  borderRadius: "8px",
  border: "1px solid #1e293b",
  background: "#0f172a",
  cursor: "pointer",
  minWidth: "52px",
  boxShadow: "none",
  transition: "border-color 0.12s, background 0.12s",
};

/** 「立ち位置について」4 モード用（従来の約半分の高さ・説明は title / aria-label） */
const addCueModePickStyle: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "8px",
  padding: "5px 10px",
  borderRadius: "7px",
  border: "1px solid #334155",
  background: "#0b1220",
  color: "#e2e8f0",
  fontSize: "12px",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  minHeight: 0,
  lineHeight: 1.25,
};

/** カテゴリグリッド用サムネイル（名簿モーダルの SpotThumb と同等） */
function SpotThumb({ dancers }: { dancers: { xPct: number; yPct: number }[] }) {
  const radius = dancers.length >= 12 ? 2.4 : dancers.length >= 6 ? 3.0 : 3.4;
  return (
    <svg
      viewBox="0 0 100 60"
      width={46}
      height={28}
      aria-hidden
      style={{ display: "block", color: "#cbd5e1" }}
    >
      <rect x="0" y="48" width="100" height="12" fill="currentColor" fillOpacity={0.14} rx="2" />
      {dancers.map((d, i) => (
        <circle
          key={i}
          cx={Math.max(4, Math.min(96, d.xPct))}
          cy={2 + (Math.max(0, Math.min(100, d.yPct)) / 100) * 56}
          r={radius}
          fill="currentColor"
          fillOpacity={0.9}
        />
      ))}
    </svg>
  );
}

export function AddCueWithFormationDialog({
  open,
  onClose,
  project,
  setProject,
  currentTimeSec,
  durationSec,
  selectedCueId = null,
  onCueCreated,
  onStagePreviewChange,
  onImportRoster,
}: Props) {
  const { viewMode } = project;
  const trimLo = project.trimStartSec;
  const timelineCap =
    durationSec > 0 ? durationSec : PLACEHOLDER_TIMELINE_CAP_SEC;
  const trimHi = project.trimEndSec ?? timelineCap;

  const initialCount = useMemo(() => {
    const f = project.formations.find((x) => x.id === project.activeFormationId);
    const n = f?.dancers.length ?? 6;
    return Math.max(1, Math.min(30, n));
  }, [project.formations, project.activeFormationId]);

  const [count, setCount] = useState(initialCount);
  /** 開いた直後は未選択（ステップ3）。ユーザーがモードを選ぶまでプレビュー・確定はできない */
  const [addMode, setAddMode] = useState<AddMode | null>(null);
  const [templatePresetId, setTemplatePresetId] = useState<LayoutPresetId | null>(null);
  const [savedBoxId, setSavedBoxId] = useState<string | null>(null);
  const [savedSlotId, setSavedSlotId] = useState<string | null>(null);

  const removeSavedSpotLayout = useCallback(
    (slotId: string, slotName: string) => {
      if (viewMode === "view") return;
      if (!window.confirm(`「${slotName}」を立ち位置リストから削除しますか？`)) return;
      setProject((p) => ({
        ...p,
        savedSpotLayouts: p.savedSpotLayouts.filter((s) => s.id !== slotId),
      }));
      setSavedSlotId((cur) => (cur === slotId ? null : cur));
    },
    [viewMode, setProject]
  );

  const [timeMode, setTimeMode] = useState<"now" | "custom">("now");
  const [customTimeStr, setCustomTimeStr] = useState(() =>
    formatSec(Math.max(trimLo, Math.min(trimHi, currentTimeSec)))
  );

  const [boxRev, setBoxRev] = useState(0);
  const boxItems = useMemo(() => listFormationBoxItems(), [boxRev, open]);
  /** 保存リストから選んだときは人数 UI をいじらせず、保存時の人数に合わせる */
  const savedLayoutLocked =
    addMode === "saved" && (savedSlotId != null || savedBoxId != null);

  useEffect(() => {
    if (!open || addMode !== "saved") return;
    if (savedSlotId) {
      const slot = project.savedSpotLayouts.find((s) => s.id === savedSlotId);
      if (slot) {
        setCount(Math.max(1, Math.min(30, slot.dancers.length)));
      }
      return;
    }
    if (savedBoxId) {
      const item = boxItems.find((b) => b.id === savedBoxId);
      if (item) {
        setCount(Math.max(1, Math.min(30, item.dancerCount)));
      }
    }
  }, [
    open,
    addMode,
    savedSlotId,
    savedBoxId,
    project.savedSpotLayouts,
    boxItems,
  ]);

  useEffect(() => {
    const handler = () => setBoxRev((r) => r + 1);
    window.addEventListener(FORMATION_BOX_CHANGE_EVENT, handler);
    return () => window.removeEventListener(FORMATION_BOX_CHANGE_EVENT, handler);
  }, []);

  /** カテゴリごとのプリセットサムネイル（count と spacing に依存） */
  const presetCategoryPreviews = useMemo(
    () =>
      PRESET_CATEGORIES.map((cat) => ({
        ...cat,
        items: cat.ids.map((id) => ({
          id,
          label: LAYOUT_PRESET_LABELS[id] ?? id,
          dancers: dancersForLayoutPreset(Math.max(1, count), id, {
            dancerSpacingMm: project.dancerSpacingMm ?? undefined,
            stageWidthMm: project.stageWidthMm ?? undefined,
          }),
        })),
      })),
    [count, project.dancerSpacingMm, project.stageWidthMm]
  );

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setCount(initialCount);
      setAddMode(null);
      setTemplatePresetId(null);
      setSavedBoxId(null);
      setSavedSlotId(null);
      setTimeMode("now");
      setCustomTimeStr(formatSec(Math.max(trimLo, Math.min(trimHi, currentTimeSec))));
      setBoxRev((r) => r + 1);
    }
    wasOpenRef.current = open;
  }, [open, initialCount, currentTimeSec, trimLo, trimHi]);

  useEffect(() => {
    if (
      (addMode === "template" || addMode === "edit_current") &&
      templatePresetId == null &&
      PRESETS[0]
    ) {
      setTemplatePresetId(PRESETS[0].id);
    }
  }, [addMode, templatePresetId]);

  const closeAndCleanup = useCallback(() => {
    onStagePreviewChange?.(null);
    onClose();
  }, [onClose, onStagePreviewChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeAndCleanup();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as EventListenerOptions);
  }, [open, closeAndCleanup]);

  const spacingOpts = useMemo(
    () => ({
      dancerSpacingMm: project.dancerSpacingMm,
      stageWidthMm: project.stageWidthMm,
    }),
    [project.dancerSpacingMm, project.stageWidthMm]
  );

  const buildDancers = useCallback((): DancerSpot[] => {
    if (addMode == null) return [];
    const active = activeFormationDancers(project);
    switch (addMode) {
      case "duplicate":
        return dancersForTargetCount(active, count, spacingOpts);
      case "edit_current": {
        if (!templatePresetId) return [];
        const cue = selectedCueId
          ? project.cues.find((c) => c.id === selectedCueId)
          : undefined;
        const fid = cue?.formationId;
        const baseDancers = fid
          ? (project.formations.find((f) => f.id === fid)?.dancers ?? []).map(
              (d) => ({ ...d })
            )
          : active;
        const raw = dancersForLayoutPreset(count, templatePresetId, {
          dancerSpacingMm: spacingOpts.dancerSpacingMm ?? undefined,
          stageWidthMm: spacingOpts.stageWidthMm ?? undefined,
        });
        return transferIdentitiesByOrder(raw, baseDancers);
      }
      case "template": {
        if (!templatePresetId) return [];
        const raw = dancersForLayoutPreset(count, templatePresetId, {
          dancerSpacingMm: spacingOpts.dancerSpacingMm ?? undefined,
          stageWidthMm: spacingOpts.stageWidthMm ?? undefined,
        });
        return transferIdentitiesByOrder(raw, active);
      }
      case "saved": {
        if (savedBoxId) {
          const item = boxItems.find((b) => b.id === savedBoxId);
          if (!item) return [];
          /** 形の箱は保存時の人数・名簿・座標をそのまま優先 */
          return dancersFromFormationBoxItem(item).map((d) => ({ ...d }));
        }
        if (savedSlotId) {
          const slot = project.savedSpotLayouts.find((s) => s.id === savedSlotId);
          if (!slot) return [];
          /** プロジェクト保存スロットは人数・メンバー・座標をスナップショットどおり */
          return slot.dancers.map((d) => ({ ...d }));
        }
        return [];
      }
      default:
        return [];
    }
  }, [
    addMode,
    count,
    templatePresetId,
    savedBoxId,
    savedSlotId,
    selectedCueId,
    project,
    boxItems,
    spacingOpts,
    project.savedSpotLayouts,
  ]);

  useEffect(() => {
    if (!open) {
      onStagePreviewChange?.(null);
      return;
    }
    const d = buildDancers();
    onStagePreviewChange?.(d.length > 0 ? d : null);
    return () => {
      onStagePreviewChange?.(null);
    };
  }, [open, buildDancers, onStagePreviewChange]);

  const canConfirm = useMemo(() => {
    if (viewMode === "view") return false;
    if (addMode == null) return false;
    if (addMode === "saved" && !savedBoxId && !savedSlotId) return false;
    if ((addMode === "template" || addMode === "edit_current") && !templatePresetId)
      return false;
    return buildDancers().length > 0;
  }, [viewMode, addMode, selectedCueId, savedBoxId, savedSlotId, templatePresetId, buildDancers]);

  /** クリック直前の最新値で確定可否を見る（クロージャが古いと押しても無反応になるのを防ぐ） */
  const canConfirmRef = useRef(canConfirm);
  canConfirmRef.current = canConfirm;

  const handleConfirm = useCallback(() => {
    if (!canConfirmRef.current) return;
    if (addMode == null) return;

    /**
     * 「今の立ち位置を変更」
     * - 選択中キューがある: 新規キューは作らず、そのキューのフォーメーションだけ置き換える
     * - 選択中キューがない（例: 追加直後）: 変更先が無いので、このまま新規キュー追加へフォールバック
     */
    if (addMode === "edit_current" && selectedCueId) {
      const cueId = selectedCueId;
      const dancers = buildDancers();
      if (dancers.length === 0) return;
      setProject((p) => {
        const cue = p.cues.find((c) => c.id === cueId);
        if (!cue) return p;
        const fid = cue.formationId;
        return {
          ...p,
          formations: p.formations.map((f) =>
            f.id === fid
              ? {
                  ...f,
                  dancers,
                  confirmedDancerCount: dancers.length,
                }
              : f
          ),
          activeFormationId: fid,
        };
      });
      onStagePreviewChange?.(null);
      onClose();
      return;
    }

    if (project.cues.length >= 100) {
      window.alert("キューの上限（100）に達しています。");
      return;
    }

    let t0Raw =
      timeMode === "now" ? currentTimeSec : parseTimeString(customTimeStr);
    if (!Number.isFinite(t0Raw)) {
      window.alert("時刻の形式が正しくありません（例: 0:12.5 または 12.5）");
      return;
    }
    t0Raw = Math.max(trimLo, Math.min(trimHi - 0.02, t0Raw));

    const dancers = buildDancers();
    if (dancers.length === 0) return;

    const newCueId = crypto.randomUUID();
    const newFmId = crypto.randomUUID();
    let appliedT = 0;

    setProject((p) => {
      if (p.cues.length >= 100) return p;
      const base = p.formations.find((x) => x.id === p.activeFormationId) ?? p.formations[0];
      const baseTemplate = base
        ? cloneFormationForNewCue(base)
        : {
            id: crypto.randomUUID(),
            name: "フォーメーション",
            dancers: [] as DancerSpot[],
            setPieces: [],
          };
      const newFm = {
        ...baseTemplate,
        id: newFmId,
        dancers,
        confirmedDancerCount: dancers.length,
      };

      const d = durationSec > 0 ? durationSec : PLACEHOLDER_TIMELINE_CAP_SEC;
      const hi = p.trimEndSec ?? d;
      const lo = p.trimStartSec;
      let t0 = Math.round(t0Raw * 100) / 100;
      t0 = Math.max(lo, Math.min(hi - 0.02, t0));
      let t1 = Math.min(
        hi,
        Math.round((t0 + DEFAULT_CUE_SPAN_WITH_AUDIO_SEC) * 100) / 100
      );
      if (t1 <= t0) t1 = Math.round((t0 + 0.5) * 100) / 100;
      const resolved = resolveCueIntervalNonOverlap(p.cues, newCueId, t0, t1, lo, hi);
      t0 = resolved.tStartSec;
      t1 = resolved.tEndSec;
      if (!Number.isFinite(t0) || !Number.isFinite(t1)) {
        t0 = lo;
        t1 = Math.min(hi, Math.round((lo + MIN_CUE_DURATION_SEC) * 100) / 100);
      }
      if (t1 < t0 + MIN_CUE_DURATION_SEC - 1e-9) {
        t1 = Math.round((t0 + MIN_CUE_DURATION_SEC) * 100) / 100;
        if (t1 > hi) {
          t1 = hi;
          t0 = Math.round((Math.max(lo, t1 - MIN_CUE_DURATION_SEC)) * 100) / 100;
        }
      }
      appliedT = t0;

      const cue: Cue = {
        id: newCueId,
        tStartSec: t0,
        tEndSec: t1,
        formationId: newFm.id,
      };

      let proj: ChoreographyProjectJson = {
        ...p,
        formations: [...p.formations, newFm],
        cues: sortCuesByStart([...p.cues, cue]),
        activeFormationId: newFm.id,
      };
      if (addMode === "saved" && savedSlotId) {
        const slot = p.savedSpotLayouts.find((s) => s.id === savedSlotId);
        if (slot?.stageSnapshot) {
          proj = mergeStageSnapshotIntoProject(proj, slot.stageSnapshot);
        }
      }
      return proj;
    });

    onStagePreviewChange?.(null);
    onCueCreated?.(newCueId, appliedT);
    onClose();
  }, [
    project.cues.length,
    timeMode,
    currentTimeSec,
    customTimeStr,
    trimLo,
    trimHi,
    buildDancers,
    setProject,
    durationSec,
    addMode,
    onStagePreviewChange,
    onCueCreated,
    onClose,
    savedSlotId,
    selectedCueId,
  ]);

  if (!open) return null;

  const dancers = buildDancers();
  const dancerCountPreview = dancers.length;

  const bumpCount = (delta: number) => {
    setCount((c) => Math.max(1, Math.min(30, c + delta)));
  };

  const modeCards: {
    mode: AddMode;
    title: string;
    desc: string;
  }[] = [
    {
      mode: "template",
      title: "雛形から選ぶ",
      desc: "定番プリセットから人数分を配置",
    },
    {
      mode: "saved",
      title: "保存したリストから選ぶ",
      desc: "形の箱・プロジェクトに保存した並びから選びます",
    },
    {
      mode: "edit_current",
      title: "今の立ち位置を変更",
      desc: "選択中のキューのみ：雛形で立ち位置を置き換え、名簿の並び順はいまの形から引き継ぎます（新しいキューは追加しません）",
    },
    {
      mode: "duplicate",
      title: "今の立ち位置を複製",
      desc: "人数に合わせてコピー（増減は横一列で補完）",
    },
  ];

  return (
    <div style={panelShellStyle} role="dialog" aria-modal="false" aria-label="新しいキューを追加">
      <div style={panelCardStyle}>
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              aria-hidden
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: "8px",
                background: "rgba(14,116,144,0.25)",
                color: "#7dd3fc",
                fontSize: "18px",
                fontWeight: 700,
              }}
            >
              ＋
            </span>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <strong style={{ fontSize: "15px" }}>新しいキュー</strong>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                ステージ上部からのみ表示（タイムライン側のボタンはありません）
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAndCleanup}
            aria-label="閉じる"
            title="閉じる（Esc）"
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              background: "transparent",
              border: "1px solid #334155",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            ✕
          </button>
        </div>

        <div style={bodyStyle}>
          <section>
            <div style={sectionLabelStyle}>
              <span style={sectionNumberStyle}>1</span>
              開始時刻
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px 18px",
                alignItems: "center",
                paddingLeft: "26px",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="add-cue-time-mode"
                  checked={timeMode === "now"}
                  onChange={() => setTimeMode("now")}
                />
                現在の再生位置
                <span
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    color: "#7dd3fc",
                    fontSize: "12px",
                  }}
                >
                  （{formatSec(Math.max(trimLo, Math.min(trimHi, currentTimeSec)))}）
                </span>
              </label>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="add-cue-time-mode"
                  checked={timeMode === "custom"}
                  onChange={() => setTimeMode("custom")}
                />
                指定
                <input
                  type="text"
                  value={customTimeStr}
                  placeholder="0:00.0"
                  onChange={(e) => setCustomTimeStr(e.target.value)}
                  onFocus={() => setTimeMode("custom")}
                  style={{
                    ...inputStyle,
                    width: "80px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                />
              </label>
            </div>
          </section>

          <section>
            <div style={sectionLabelStyle}>
              <span style={sectionNumberStyle}>2</span>
              人数
            </div>
            <div
              style={{
                paddingLeft: "26px",
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <button
                type="button"
                aria-label="人数を減らす"
                disabled={viewMode === "view" || count <= 1 || savedLayoutLocked}
                onClick={() => bumpCount(-1)}
                style={{
                  ...btnBase,
                  padding: "6px 14px",
                  fontSize: "18px",
                  lineHeight: 1,
                  minWidth: "40px",
                }}
              >
                −
              </button>
              <span
                style={{
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 800,
                  fontSize: "20px",
                  color: "#f1f5f9",
                  minWidth: "2.2em",
                  textAlign: "center",
                }}
              >
                {count}
              </span>
              <button
                type="button"
                aria-label="人数を増やす"
                disabled={viewMode === "view" || count >= 30 || savedLayoutLocked}
                onClick={() => bumpCount(1)}
                style={{
                  ...btnBase,
                  padding: "6px 14px",
                  fontSize: "18px",
                  lineHeight: 1,
                  minWidth: "40px",
                }}
              >
                ＋
              </button>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                1〜30 人
                {savedLayoutLocked ? (
                  <span style={{ marginLeft: "8px", color: "#38bdf8" }}>
                    （保存した並びの人数に固定）
                  </span>
                ) : null}
              </span>
            </div>
          </section>

          <section>
            <div style={{ ...sectionLabelStyle, marginBottom: "4px" }}>
              <span style={{ ...sectionNumberStyle, width: 18, height: 18, fontSize: "10px" }}>3</span>
              立ち位置について
            </div>
            <div
              style={{
                paddingLeft: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              {modeCards.map(({ mode, title, desc }) => {
                const active = addMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    title={desc}
                    aria-label={`${title}。${desc}`}
                    onClick={() => {
                      setAddMode(mode);
                      if (mode !== "saved") {
                        setSavedBoxId(null);
                        setSavedSlotId(null);
                      }
                      if (
                        (mode === "template" || mode === "edit_current") &&
                        !templatePresetId &&
                        PRESETS[0]
                      ) {
                        setTemplatePresetId(PRESETS[0].id);
                      }
                    }}
                    style={{
                      ...addCueModePickStyle,
                      borderColor: active ? "#38bdf8" : "#334155",
                      borderWidth: active ? 2 : 1,
                      background: active ? "#0e7490" : "#0b1220",
                      color: active ? "#ecfeff" : "#e2e8f0",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "12px",
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {title}
                    </span>
                  </button>
                );
              })}
              {onImportRoster ? (
                <button
                  type="button"
                  title="CSV / TSV などを選び、新しい名簿として取り込みます（ステージ上部の名簿取り込みと同じ）"
                  aria-label="名簿取り込み。CSV や TSV を選び新しい名簿として追加します"
                  disabled={viewMode === "view"}
                  onClick={() => {
                    onClose();
                    queueMicrotask(() => onImportRoster());
                  }}
                  style={{
                    ...addCueModePickStyle,
                    borderColor: "#334155",
                    borderWidth: 1,
                    background: "#0b1220",
                    color: "#e2e8f0",
                    marginTop: "2px",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "12px",
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    名簿取り込み
                  </span>
                </button>
              ) : null}
            </div>
          </section>

          {addMode === "template" || addMode === "edit_current" ? (
            <section>
              <div style={sectionLabelStyle}>
                <span style={sectionNumberStyle}>4</span>
                雛形（プリセット）
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingLeft: "4px" }}>
                {presetCategoryPreviews.map((cat) => (
                  <div key={cat.label}>
                    {/* カテゴリラベル */}
                    <div
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#64748b",
                        letterSpacing: "0.04em",
                        marginBottom: "5px",
                        paddingLeft: "2px",
                      }}
                    >
                      {cat.label}
                    </div>
                    {/* プリセットグリッド */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                      {cat.items.map((item) => {
                        const active = templatePresetId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setTemplatePresetId(item.id)}
                            title={item.label}
                            style={{
                              flexShrink: 0,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "3px",
                              padding: "5px 6px 6px",
                              borderRadius: "8px",
                              border: active ? "2px solid #6366f1" : "1px solid #1e293b",
                              background: active ? "#1e1b4b" : "#0f172a",
                              cursor: "pointer",
                              minWidth: "52px",
                              maxWidth: "76px",
                              boxShadow: active ? "0 0 0 1px rgba(99,102,241,0.5)" : "none",
                              transition: "border-color 0.12s, background 0.12s",
                            }}
                          >
                            <SpotThumb dancers={item.dancers} />
                            <span
                              style={{
                                fontSize: "9.5px",
                                color: "#cbd5e1",
                                width: "100%",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                lineHeight: 1.2,
                                textAlign: "center",
                              }}
                            >
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {addMode === "saved" ? (
            <section>
              <div style={sectionLabelStyle}>
                <span style={sectionNumberStyle}>4</span>
                保存したリスト
              </div>
              <div
                style={{
                  paddingLeft: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "6px", fontWeight: 600 }}>
                    形の箱
                  </div>
                  {boxItems.length === 0 ? (
                    <span style={{ fontSize: "11px", color: "#64748b" }}>保存された形がありません</span>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {boxItems.map((item) => {
                        const active = savedBoxId === item.id && savedSlotId === null;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSavedBoxId(item.id);
                              setSavedSlotId(null);
                            }}
                            title={`${item.name}（${item.dancerCount}人）`}
                            style={{
                              ...presetChipBase,
                              borderColor: active ? "#38bdf8" : "#334155",
                              borderWidth: active ? 2 : 1,
                              background: active ? "#0e7490" : "#0b1220",
                              maxWidth: 120,
                            }}
                          >
                            <FormationBoxItemThumb item={item} width={44} />
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: "100%",
                              }}
                            >
                              {item.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "6px", fontWeight: 600 }}>
                    プロジェクトに保存した並び
                  </div>
                  {project.savedSpotLayouts.length === 0 ? (
                    <span style={{ fontSize: "11px", color: "#64748b" }}>スロットに保存されていません</span>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {project.savedSpotLayouts.map((slot) => {
                        const active = savedSlotId === slot.id;
                        return (
                          <div
                            key={slot.id}
                            style={{
                              display: "flex",
                              gap: "6px",
                              alignItems: "stretch",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSavedSlotId(slot.id);
                                setSavedBoxId(null);
                              }}
                              style={{
                                ...modeCardBase,
                                flex: 1,
                                minWidth: 0,
                                padding: "8px 10px",
                                borderColor: active ? "#38bdf8" : "#334155",
                                borderWidth: active ? 2 : 1,
                                background: active ? "#0e7490" : "#0b1220",
                                textAlign: "left",
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{slot.name}</span>
                              <span style={{ fontSize: "10px", opacity: 0.85, display: "block" }}>
                                {slot.dancers.length} 人 · 保存時 {slot.savedAtCount ?? slot.dancers.length} 人
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={viewMode === "view"}
                              title="この保存をリストから削除"
                              aria-label={`${slot.name} を削除`}
                              onClick={() => removeSavedSpotLayout(slot.id, slot.name)}
                              style={{
                                ...btnBase,
                                flexShrink: 0,
                                padding: "6px 10px",
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "#fecaca",
                                borderColor: "#7f1d1d",
                                background: "#450a0a",
                                alignSelf: "stretch",
                              }}
                            >
                              削除
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <div style={footerStyle}>
          <span style={{ marginRight: "auto", fontSize: "11px", color: "#64748b", minWidth: 0 }}>
            {dancerCountPreview > 0 ? (
              <>
                プレビュー <strong style={{ color: "#cbd5e1" }}>{dancerCountPreview} 人</strong>
                {(addMode === "template" || addMode === "edit_current") && templatePresetId ? (
                  <> · {LAYOUT_PRESET_LABELS[templatePresetId]}</>
                ) : null}
              </>
            ) : (
              "条件を選んでください"
            )}
          </span>
          <div
            style={{
              display: "flex",
              flexWrap: "nowrap",
              alignItems: "center",
              gap: "10px",
              flexShrink: 0,
            }}
          >
            <button type="button" onClick={closeAndCleanup} style={btnBase}>
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              aria-label={
                addMode === "edit_current" && selectedCueId
                  ? "決定して選択中キューの立ち位置を反映"
                  : "キューを追加"
              }
              style={{
                ...btnPrimary,
                opacity: !canConfirm ? 0.45 : 1,
                cursor: !canConfirm ? "not-allowed" : "pointer",
                minWidth:
                  addMode === "edit_current" && selectedCueId ? "88px" : undefined,
              }}
            >
              {addMode === "edit_current" && selectedCueId ? "決定" : "追加する"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
