import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import type { ChoreographyProjectJson, DancerSpot, Formation } from "../types/choreography";
import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
} from "../lib/dancerSpacing";
import {
  MARKER_DIAMETER_PX_MAX as MARKER_PX_MAX,
  MARKER_DIAMETER_PX_MIN as MARKER_PX_MIN,
} from "../lib/projectDefaults";
import { normalizeDancerFacingDeg } from "../lib/dancerColorPalette";
import { clamp, round2 } from "../lib/stageBoardModelHelpers";

export type MarkerRotateSession = {
  centerClientX: number;
  centerClientY: number;
  startPointerAngle: number;
  startFacings: Map<string, number>;
  ids: string[];
  mode: "facing" | "groupRigid";
  startPositions?: Map<string, { xPct: number; yPct: number }>;
} | null;

export type MarkerResizeSession = {
  startClientX: number;
  startClientY: number;
  startSizes: Map<string, number>;
  ids: string[];
} | null;

export type UseMarkerHandlesParams = {
  viewMode: "edit" | "view";
  stageInteractionsEnabled: boolean;
  playbackDancers: DancerSpot[] | null;
  previewDancers: DancerSpot[] | null | undefined;
  playbackOrPreview: boolean;
  selectedDancerIds: string[];
  writeFormation: Formation | undefined;
  activeFormation: Formation | undefined;
  stageMainFloorRef: RefObject<HTMLDivElement | null>;
  baseMarkerPx: number;
  setBulkHideDancerGlyphs: Dispatch<SetStateAction<boolean>>;
};

/**
 * 選択ダンサーの○サイズ・回転ハンドル（ドラフトと pointerdown）。
 * `pointermove` / `pointerup` の本体は親のグローバル effect から
 * `applyMarkerRotateMove` / `applyMarkerResizeMove` / `commitMarkerRotateUp` / `commitMarkerResizeUp` を呼ぶ。
 */
export function useMarkerHandles({
  viewMode,
  stageInteractionsEnabled,
  playbackDancers,
  previewDancers,
  playbackOrPreview,
  selectedDancerIds,
  writeFormation,
  activeFormation,
  stageMainFloorRef,
  baseMarkerPx,
  setBulkHideDancerGlyphs,
}: UseMarkerHandlesParams) {
  const markerResizeRef = useRef<MarkerResizeSession>(null);
  const markerRotateRef = useRef<MarkerRotateSession>(null);
  const markerFacingDraftRef = useRef<Map<string, number> | null>(null);
  const markerGroupPosDraftRef = useRef<Map<
    string,
    { xPct: number; yPct: number }
  > | null>(null);

  const [markerDiamDraft, setMarkerDiamDraft] = useState<Map<
    string,
    number
  > | null>(null);
  const [markerFacingDraft, setMarkerFacingDraft] = useState<Map<
    string,
    number
  > | null>(null);
  const [markerGroupPosDraft, setMarkerGroupPosDraft] = useState<Map<
    string,
    { xPct: number; yPct: number }
  > | null>(null);
  const [groupRotateGuideDeltaDeg, setGroupRotateGuideDeltaDeg] = useState<
    number | null
  >(null);

  const selectionBox = useMemo(() => {
    if (playbackOrPreview) return null;
    if (viewMode === "view") return null;
    const ids = selectedDancerIds;
    if (ids.length < 2) return null;
    const ds = (
      writeFormation?.dancers ??
      activeFormation?.dancers ??
      []
    ).filter((x) => ids.includes(x.id));
    if (ds.length < 2) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const d of ds) {
      const ox = markerGroupPosDraft?.get(d.id)?.xPct ?? d.xPct;
      const oy = markerGroupPosDraft?.get(d.id)?.yPct ?? d.yPct;
      if (ox < x0) x0 = ox;
      if (oy < y0) y0 = oy;
      if (ox > x1) x1 = ox;
      if (oy > y1) y1 = oy;
    }
    if (
      !Number.isFinite(x0) ||
      !Number.isFinite(y0) ||
      !Number.isFinite(x1) ||
      !Number.isFinite(y1)
    )
      return null;
    return { x0, y0, x1, y1 };
  }, [
    selectedDancerIds,
    writeFormation,
    activeFormation,
    playbackOrPreview,
    viewMode,
    markerGroupPosDraft,
  ]);

  const effectiveMarkerPx = useCallback(
    (d: DancerSpot) => {
      const draft = markerDiamDraft?.get(d.id);
      if (typeof draft === "number" && Number.isFinite(draft)) {
        return Math.max(
          MARKER_PX_MIN,
          Math.min(MARKER_PX_MAX, Math.round(draft)),
        );
      }
      if (typeof d.sizePx === "number" && Number.isFinite(d.sizePx)) {
        return Math.max(
          MARKER_PX_MIN,
          Math.min(MARKER_PX_MAX, Math.round(d.sizePx)),
        );
      }
      return baseMarkerPx;
    },
    [markerDiamDraft, baseMarkerPx],
  );

  const effectiveFacingDeg = useCallback(
    (d: DancerSpot): number => {
      const fd = markerFacingDraft?.get(d.id);
      if (typeof fd === "number" && Number.isFinite(fd)) return fd;
      const raw =
        typeof d.facingDeg === "number" && Number.isFinite(d.facingDeg)
          ? d.facingDeg
          : 0;
      return raw;
    },
    [markerFacingDraft],
  );

  const handlePointerDownMarkerResize = useCallback(
    (e: ReactPointerEvent) => {
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
      const dancers = writeFormation?.dancers ?? activeFormation?.dancers ?? [];
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
    },
    [
      viewMode,
      playbackDancers,
      previewDancers,
      stageInteractionsEnabled,
      selectedDancerIds,
      writeFormation,
      activeFormation,
      baseMarkerPx,
    ],
  );

  const handlePointerDownMarkerRotate = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
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
      const rotateHandleEl = e.currentTarget;
      const floorEl = stageMainFloorRef.current;
      if (!floorEl) return;
      const rect = floorEl.getBoundingClientRect();
      const dancers = writeFormation?.dancers ?? activeFormation?.dancers ?? [];
      let centerClientX: number;
      let centerClientY: number;
      const groupRigid = selectedDancerIds.length >= 2 && selectionBox != null;
      if (groupRigid) {
        const cxPct = (selectionBox!.x0 + selectionBox!.x1) / 2;
        const cyPct = (selectionBox!.y0 + selectionBox!.y1) / 2;
        centerClientX = rect.left + (cxPct / 100) * rect.width;
        centerClientY = rect.top + (cyPct / 100) * rect.height;
      } else {
        const primaryId = selectedDancerIds[0]!;
        const primary = dancers.find((x) => x.id === primaryId);
        if (!primary) return;
        centerClientX = rect.left + (primary.xPct / 100) * rect.width;
        centerClientY = rect.top + (primary.yPct / 100) * rect.height;
      }
      const hr = rotateHandleEl.getBoundingClientRect();
      const handleCenterX = hr.left + hr.width / 2;
      const handleCenterY = hr.top + hr.height / 2;
      const startPointerAngle = Math.atan2(
        handleCenterY - centerClientY,
        handleCenterX - centerClientX,
      );
      const startFacings = new Map<string, number>();
      const startPositions = new Map<string, { xPct: number; yPct: number }>();
      for (const id of selectedDancerIds) {
        const d = dancers.find((x) => x.id === id);
        if (!d) continue;
        const cur =
          typeof d.facingDeg === "number" && Number.isFinite(d.facingDeg)
            ? d.facingDeg
            : 0;
        startFacings.set(id, normalizeDancerFacingDeg(cur));
        if (groupRigid) {
          startPositions.set(id, { xPct: d.xPct, yPct: d.yPct });
        }
      }
      if (startFacings.size === 0) return;
      try {
        rotateHandleEl.setPointerCapture(e.pointerId);
      } catch {
        /* capture 不可時も window の pointermove で回転は継続 */
      }
      markerRotateRef.current = {
        centerClientX,
        centerClientY,
        startPointerAngle,
        startFacings,
        ids: [...selectedDancerIds],
        mode: groupRigid ? "groupRigid" : "facing",
        ...(groupRigid ? { startPositions } : {}),
      };
      const initFacing = new Map(startFacings);
      markerFacingDraftRef.current = initFacing;
      setMarkerFacingDraft(initFacing);
      if (groupRigid) {
        const initPos = new Map(startPositions);
        markerGroupPosDraftRef.current = initPos;
        setMarkerGroupPosDraft(initPos);
        setBulkHideDancerGlyphs(true);
        setGroupRotateGuideDeltaDeg(0);
      } else {
        markerGroupPosDraftRef.current = null;
        setMarkerGroupPosDraft(null);
        setBulkHideDancerGlyphs(false);
        setGroupRotateGuideDeltaDeg(null);
      }
    },
    [
      viewMode,
      playbackDancers,
      previewDancers,
      stageInteractionsEnabled,
      selectedDancerIds,
      selectionBox,
      stageMainFloorRef,
      writeFormation,
      activeFormation,
      setBulkHideDancerGlyphs,
    ],
  );

  const applyMarkerRotateMove = useCallback((e: PointerEvent): boolean => {
    const rot = markerRotateRef.current;
    if (!rot) return false;
    const curAngle = Math.atan2(
      e.clientY - rot.centerClientY,
      e.clientX - rot.centerClientX,
    );
    let deltaRad = curAngle - rot.startPointerAngle;
    while (deltaRad > Math.PI) deltaRad -= 2 * Math.PI;
    while (deltaRad < -Math.PI) deltaRad += 2 * Math.PI;
    const deltaDeg = (deltaRad * 180) / Math.PI;
    const cos = Math.cos(deltaRad);
    const sin = Math.sin(deltaRad);
    const draft = new Map<string, number>();
    for (const id of rot.ids) {
      const s = rot.startFacings.get(id) ?? 0;
      draft.set(id, normalizeDancerFacingDeg(s + deltaDeg));
    }
    markerFacingDraftRef.current = draft;
    setMarkerFacingDraft(draft);
    if (rot.mode === "groupRigid") {
      setGroupRotateGuideDeltaDeg(deltaDeg);
    }
    if (
      rot.mode === "groupRigid" &&
      rot.startPositions &&
      rot.startPositions.size > 0
    ) {
      const floor = stageMainFloorRef.current;
      if (floor) {
        const r = floor.getBoundingClientRect();
        const w = r.width;
        const h = r.height;
        if (w > 0 && h > 0) {
          const draftPos = new Map<string, { xPct: number; yPct: number }>();
          for (const id of rot.ids) {
            const s = rot.startPositions.get(id);
            if (!s) continue;
            const px0 = r.left + (s.xPct / 100) * w;
            const py0 = r.top + (s.yPct / 100) * h;
            const vx = px0 - rot.centerClientX;
            const vy = py0 - rot.centerClientY;
            const px1 = rot.centerClientX + vx * cos - vy * sin;
            const py1 = rot.centerClientY + vx * sin + vy * cos;
            const nxPct = clamp(
              ((px1 - r.left) / w) * 100,
              DANCER_STAGE_POSITION_PCT_LO,
              DANCER_STAGE_POSITION_PCT_HI,
            );
            const nyPct = clamp(
              ((py1 - r.top) / h) * 100,
              DANCER_STAGE_POSITION_PCT_LO,
              DANCER_STAGE_POSITION_PCT_HI,
            );
            draftPos.set(id, {
              xPct: round2(nxPct),
              yPct: round2(nyPct),
            });
          }
          markerGroupPosDraftRef.current = draftPos;
          setMarkerGroupPosDraft(draftPos);
        }
      }
    }
    return true;
  }, [stageMainFloorRef]);

  const applyMarkerResizeMove = useCallback((e: PointerEvent): boolean => {
    const m = markerResizeRef.current;
    if (!m) return false;
    const dx = e.clientX - m.startClientX;
    const dy = e.clientY - m.startClientY;
    const delta = (dx + dy) / 2;
    const draft = new Map<string, number>();
    for (const [id, s0] of m.startSizes) {
      const next = Math.round(
        clamp(s0 + delta, MARKER_PX_MIN, MARKER_PX_MAX),
      );
      draft.set(id, next);
    }
    setMarkerDiamDraft(draft);
    return true;
  }, []);

  const commitMarkerRotateUp = useCallback(
    ({
      setProject,
      formationIdForWrites,
    }: {
      setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
      formationIdForWrites: string | null;
    }) => {
      const rotUp = markerRotateRef.current;
      const facingDraftSnap = markerFacingDraftRef.current;
      const posDraftSnap = markerGroupPosDraftRef.current;
      if (
        formationIdForWrites &&
        rotUp &&
        facingDraftSnap &&
        facingDraftSnap.size > 0
      ) {
        let facingChanged = false;
        for (const id of rotUp.ids) {
          const a = normalizeDancerFacingDeg(rotUp.startFacings.get(id) ?? 0);
          const b = normalizeDancerFacingDeg(facingDraftSnap.get(id) ?? a);
          if (a !== b) {
            facingChanged = true;
            break;
          }
        }
        let posChanged = false;
        if (
          rotUp.mode === "groupRigid" &&
          rotUp.startPositions &&
          posDraftSnap &&
          posDraftSnap.size > 0
        ) {
          for (const id of rotUp.ids) {
            const a = rotUp.startPositions.get(id);
            const b = posDraftSnap.get(id);
            if (a && b && (a.xPct !== b.xPct || a.yPct !== b.yPct)) {
              posChanged = true;
              break;
            }
          }
        }
        if (facingChanged || posChanged) {
          setProject((p) => ({
            ...p,
            formations: p.formations.map((f) =>
              f.id === formationIdForWrites
                ? {
                    ...f,
                    dancers: f.dancers.map((x) => {
                      if (!rotUp.ids.includes(x.id)) return x;
                      let next: DancerSpot = { ...x };
                      if (posDraftSnap?.has(x.id)) {
                        const pr = posDraftSnap.get(x.id)!;
                        next = { ...next, xPct: pr.xPct, yPct: pr.yPct };
                      }
                      if (facingDraftSnap.has(x.id)) {
                        const deg = normalizeDancerFacingDeg(
                          facingDraftSnap.get(x.id)!,
                        );
                        const { facingDeg, ...rest } = next;
                        void facingDeg;
                        next =
                          deg === 0
                            ? (rest as DancerSpot)
                            : { ...rest, facingDeg: deg };
                      }
                      return next;
                    }),
                  }
                : f,
            ),
          }));
        }
      }
      markerRotateRef.current = null;
      markerFacingDraftRef.current = null;
      markerGroupPosDraftRef.current = null;
      setMarkerFacingDraft(null);
      setMarkerGroupPosDraft(null);
    },
    [],
  );

  const commitMarkerResizeUp = useCallback(
    ({
      setProject,
      formationIdForWrites,
      markerDiamDraftNow,
    }: {
      setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
      formationIdForWrites: string | null;
      markerDiamDraftNow: Map<string, number> | null;
    }) => {
      const m = markerResizeRef.current;
      if (
        formationIdForWrites &&
        m &&
        markerDiamDraftNow &&
        markerDiamDraftNow.size > 0
      ) {
        const changed = [...markerDiamDraftNow.entries()].some(
          ([id, v]) => m.startSizes.get(id) !== v,
        );
        if (changed) {
          const nextSizes = new Map(markerDiamDraftNow);
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
                : f,
            ),
          }));
        }
      }
      markerResizeRef.current = null;
      setMarkerDiamDraft(null);
    },
    [],
  );

  const resetMarkerHandles = useCallback(() => {
    markerResizeRef.current = null;
    markerRotateRef.current = null;
    markerFacingDraftRef.current = null;
    markerGroupPosDraftRef.current = null;
    setMarkerDiamDraft(null);
    setMarkerFacingDraft(null);
    setMarkerGroupPosDraft(null);
    setGroupRotateGuideDeltaDeg(null);
  }, []);

  return {
    markerResizeRef,
    markerRotateRef,
    markerFacingDraftRef,
    markerGroupPosDraftRef,
    markerDiamDraft,
    markerFacingDraft,
    markerGroupPosDraft,
    groupRotateGuideDeltaDeg,
    setGroupRotateGuideDeltaDeg,
    selectionBox,
    effectiveMarkerPx,
    effectiveFacingDeg,
    handlePointerDownMarkerResize,
    handlePointerDownMarkerRotate,
    applyMarkerRotateMove,
    applyMarkerResizeMove,
    commitMarkerRotateUp,
    commitMarkerResizeUp,
    resetMarkerHandles,
  };
}
