import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback } from "react";
import {
  canSplitCueAtTime,
  clampTimelineHeadForCueOps,
  cloneFormationForNewCue,
  DEFAULT_CUE_SPAN_WITH_AUDIO_SEC,
  MIN_CUE_DURATION_SEC,
  resolveCueIntervalNonOverlap,
  roundPlaybackHeadSec,
  sortCuesByStart,
  trimHiSecForCueTimeline,
} from "../core/timelineController";
import { syncPlaybackHeadAfterCueEdit } from "../lib/playbackTransport";
import { listFormationBoxItemsByCount, saveFormationToBox } from "../lib/formationBox";
import { dancersForLayoutPreset } from "../lib/formationLayouts";
import type { ChoreographyProjectJson, Cue } from "../types/choreography";
import { generateId } from "../lib/generateId";

type Params = {
  project: ChoreographyProjectJson;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  durationRef: MutableRefObject<number>;
  currentTime: number;
  onSelectedCueIdsChange: Dispatch<SetStateAction<string[]>>;
  onFormationChosenFromCueList?: () => void;
  formationIdForNewCue: string;
  trimStartSec: number;
  trimEndSec: number | null;
};

export function useTimelineCueActions({
  project,
  setProject,
  durationRef,
  currentTime,
  onSelectedCueIdsChange,
  onFormationChosenFromCueList,
  formationIdForNewCue,
  trimStartSec,
  trimEndSec,
}: Params) {
  const addCueStartingAtTime = useCallback(
    (t0Raw: number) => {
      if (project.viewMode === "view") return;
      const newCueId = generateId();
      let appliedT = 0;
      setProject((p) => {
        if (p.cues.length >= 100) return p;
        const sourceF =
          p.formations.find((f) => f.id === formationIdForNewCue) ??
          p.formations[0];
        if (!sourceF) return p;
        const newFm = cloneFormationForNewCue(sourceF);
        const trimHi = trimHiSecForCueTimeline(
          p.trimEndSec,
          durationRef.current
        );
        const trimLo = p.trimStartSec;
        let t0 = Math.round(t0Raw * 100) / 100;
        t0 = Math.max(trimLo, Math.min(trimHi - 0.02, t0));
        let t1 = Math.min(
          trimHi,
          Math.round((t0 + DEFAULT_CUE_SPAN_WITH_AUDIO_SEC) * 100) / 100
        );
        if (t1 <= t0) t1 = Math.round((t0 + 0.5) * 100) / 100;
        const resolved = resolveCueIntervalNonOverlap(
          p.cues,
          newCueId,
          t0,
          t1,
          trimLo,
          trimHi
        );
        t0 = resolved.tStartSec;
        t1 = resolved.tEndSec;
        if (!Number.isFinite(t0) || !Number.isFinite(t1)) {
          t0 = trimLo;
          t1 = Math.min(
            trimHi,
            Math.round((trimLo + MIN_CUE_DURATION_SEC) * 100) / 100
          );
        }
        if (t1 < t0 + MIN_CUE_DURATION_SEC - 1e-9) {
          t1 = Math.round((t0 + MIN_CUE_DURATION_SEC) * 100) / 100;
          if (t1 > trimHi) {
            t1 = trimHi;
            t0 = Math.round(
              (Math.max(trimLo, t1 - MIN_CUE_DURATION_SEC)) * 100
            ) / 100;
          }
        }
        appliedT = t0;
        const cue: Cue = {
          id: newCueId,
          tStartSec: t0,
          tEndSec: t1,
          formationId: newFm.id,
        };
        return {
          ...p,
          formations: [...p.formations, newFm],
          cues: sortCuesByStart([...p.cues, cue]),
          activeFormationId: newFm.id,
        };
      });
      syncPlaybackHeadAfterCueEdit({
        t: appliedT,
        durationSec: durationRef.current,
        trimStartSec,
        trimEndSec,
      });
      onSelectedCueIdsChange([newCueId]);
      onFormationChosenFromCueList?.();
    },
    [
      project.viewMode,
      setProject,
      trimStartSec,
      trimEndSec,
      onFormationChosenFromCueList,
      formationIdForNewCue,
      onSelectedCueIdsChange,
      durationRef,
    ]
  );

  const removeCue = useCallback(
    (id: string) => {
      setProject((p) => ({
        ...p,
        cues: sortCuesByStart(p.cues.filter((c) => c.id !== id)),
      }));
      onSelectedCueIdsChange((prev) => prev.filter((x) => x !== id));
    },
    [setProject, onSelectedCueIdsChange]
  );

  const updateCue = useCallback(
    (id: string, patch: Partial<Cue>) => {
      setProject((p) => {
        let merged: Partial<Cue> = patch;
        if (patch.tStartSec !== undefined || patch.tEndSec !== undefined) {
          const cur = p.cues.find((c) => c.id === id);
          if (!cur) return p;
          const ns = patch.tStartSec ?? cur.tStartSec;
          const ne = patch.tEndSec ?? cur.tEndSec;
          const trimHi = trimHiSecForCueTimeline(
            p.trimEndSec,
            durationRef.current
          );
          const r = resolveCueIntervalNonOverlap(
            p.cues,
            id,
            ns,
            ne,
            p.trimStartSec,
            trimHi
          );
          merged = { ...patch, tStartSec: r.tStartSec, tEndSec: r.tEndSec };
        }
        return {
          ...p,
          cues: sortCuesByStart(
            p.cues.map((c) => (c.id === id ? { ...c, ...merged } : c))
          ),
        };
      });
    },
    [setProject, durationRef]
  );

  const duplicateCueSameSettings = useCallback(
    (source: Cue) => {
      if (project.viewMode === "view") return;
      const newCueId = generateId();
      let appliedT = Math.round(currentTime * 100) / 100;
      setProject((p) => {
        if (p.cues.length >= 100) return p;
        const srcFm = p.formations.find((f) => f.id === source.formationId);
        if (!srcFm) return p;
        const newFm = cloneFormationForNewCue(srcFm);
        const trimHi = trimHiSecForCueTimeline(
          p.trimEndSec,
          durationRef.current
        );
        const trimLo = p.trimStartSec;
        let t0 = Math.max(trimLo, Math.min(trimHi - 0.02, appliedT));
        let t1 = Math.min(trimHi, Math.round((t0 + (source.tEndSec - source.tStartSec)) * 100) / 100);
        if (t1 <= t0) t1 = Math.round((t0 + 0.5) * 100) / 100;
        const resolved = resolveCueIntervalNonOverlap(
          p.cues,
          newCueId,
          t0,
          t1,
          trimLo,
          trimHi
        );
        t0 = resolved.tStartSec;
        t1 = resolved.tEndSec;
        appliedT = t0;
        const newCue: Cue = {
          id: newCueId,
          tStartSec: t0,
          tEndSec: t1,
          formationId: newFm.id,
          name: source.name,
          note: source.note,
          ...(source.gapApproachFromPrev
            ? { gapApproachFromPrev: source.gapApproachFromPrev }
            : {}),
        };
        return {
          ...p,
          formations: [...p.formations, newFm],
          cues: sortCuesByStart([...p.cues, newCue]),
          activeFormationId: newFm.id,
        };
      });
      syncPlaybackHeadAfterCueEdit({
        t: appliedT,
        durationSec: durationRef.current,
        trimStartSec: project.trimStartSec,
        trimEndSec: project.trimEndSec,
      });
      onSelectedCueIdsChange([newCueId]);
      onFormationChosenFromCueList?.();
    },
    [
      project.viewMode,
      project.trimStartSec,
      project.trimEndSec,
      setProject,
      currentTime,
      onFormationChosenFromCueList,
      onSelectedCueIdsChange,
      durationRef,
    ]
  );

  const duplicateCueAtTimelineEnd = useCallback(
    (source: Cue) => {
      if (project.viewMode === "view") return;
      const newCueId = generateId();
      let appliedT = 0;
      setProject((p) => {
        if (p.cues.length >= 100) return p;
        const srcFm = p.formations.find((f) => f.id === source.formationId);
        if (!srcFm) return p;
        const newFm = cloneFormationForNewCue(srcFm);
        const trimHi = trimHiSecForCueTimeline(
          p.trimEndSec,
          durationRef.current
        );
        const trimLo = p.trimStartSec;
        const dur = Math.max(0.02, source.tEndSec - source.tStartSec);
        const maxEnd = p.cues.length
          ? Math.max(...p.cues.map((c) => c.tEndSec))
          : trimLo;
        let t0 = Math.round(maxEnd * 100) / 100;
        if (t0 < trimLo) t0 = trimLo;
        let t1 = Math.round((t0 + dur) * 100) / 100;
        if (t1 > trimHi) {
          t1 = trimHi;
          t0 = Math.round((t1 - dur) * 100) / 100;
        }
        if (t0 < trimLo) {
          t0 = trimLo;
          t1 = Math.round(Math.min(trimHi, t0 + dur) * 100) / 100;
        }
        const resolved = resolveCueIntervalNonOverlap(
          p.cues,
          newCueId,
          t0,
          t1,
          trimLo,
          trimHi
        );
        t0 = resolved.tStartSec;
        t1 = resolved.tEndSec;
        appliedT = t0;
        const newCue: Cue = {
          id: newCueId,
          tStartSec: t0,
          tEndSec: t1,
          formationId: newFm.id,
          name: source.name,
          note: source.note,
          ...(source.gapApproachFromPrev
            ? { gapApproachFromPrev: source.gapApproachFromPrev }
            : {}),
        };
        return {
          ...p,
          formations: [...p.formations, newFm],
          cues: sortCuesByStart([...p.cues, newCue]),
          activeFormationId: newFm.id,
        };
      });
      syncPlaybackHeadAfterCueEdit({
        t: appliedT,
        durationSec: durationRef.current,
        trimStartSec: project.trimStartSec,
        trimEndSec: project.trimEndSec,
      });
      onSelectedCueIdsChange([newCueId]);
      onFormationChosenFromCueList?.();
    },
    [
      project.viewMode,
      project.trimStartSec,
      project.trimEndSec,
      setProject,
      onFormationChosenFromCueList,
      onSelectedCueIdsChange,
      durationRef,
    ]
  );

  const duplicateCueAfterSource = useCallback(
    (source: Cue) => {
      if (project.viewMode === "view") return;
      const newCueId = generateId();
      let appliedT = 0;
      setProject((p) => {
        if (p.cues.length >= 100) return p;
        const srcFm = p.formations.find((f) => f.id === source.formationId);
        if (!srcFm) return p;
        const newFm = cloneFormationForNewCue(srcFm);
        const trimHi = trimHiSecForCueTimeline(
          p.trimEndSec,
          durationRef.current
        );
        const trimLo = p.trimStartSec;
        const dur = Math.max(0.02, source.tEndSec - source.tStartSec);
        let t0 = Math.round(source.tEndSec * 100) / 100;
        let t1 = Math.round((t0 + dur) * 100) / 100;
        if (t1 > trimHi) {
          t1 = trimHi;
          t0 = Math.round((t1 - dur) * 100) / 100;
        }
        if (t0 < trimLo) {
          t0 = trimLo;
          t1 = Math.round(Math.min(trimHi, t0 + dur) * 100) / 100;
        }
        const resolved = resolveCueIntervalNonOverlap(
          p.cues,
          newCueId,
          t0,
          t1,
          trimLo,
          trimHi
        );
        t0 = resolved.tStartSec;
        t1 = resolved.tEndSec;
        appliedT = t0;
        const newCue: Cue = {
          id: newCueId,
          tStartSec: t0,
          tEndSec: t1,
          formationId: newFm.id,
          name: source.name,
          note: source.note,
          ...(source.gapApproachFromPrev
            ? { gapApproachFromPrev: source.gapApproachFromPrev }
            : {}),
        };
        return {
          ...p,
          formations: [...p.formations, newFm],
          cues: sortCuesByStart([...p.cues, newCue]),
          activeFormationId: newFm.id,
        };
      });
      syncPlaybackHeadAfterCueEdit({
        t: appliedT,
        durationSec: durationRef.current,
        trimStartSec: project.trimStartSec,
        trimEndSec: project.trimEndSec,
      });
      onSelectedCueIdsChange([newCueId]);
      onFormationChosenFromCueList?.();
    },
    [
      project.viewMode,
      project.trimStartSec,
      project.trimEndSec,
      setProject,
      onFormationChosenFromCueList,
      onSelectedCueIdsChange,
      durationRef,
    ]
  );

  const splitCueAtPlayhead = useCallback(
    (cueId: string) => {
      if (project.viewMode === "view") return;
      const orig = project.cues.find((c) => c.id === cueId);
      if (!orig) return;
      const splitAt = clampTimelineHeadForCueOps(
        roundPlaybackHeadSec(currentTime),
        project.trimStartSec,
        project.trimEndSec,
        durationRef.current
      );
      if (
        !canSplitCueAtTime({
          splitAtSec: splitAt,
          cueStartSec: orig.tStartSec,
          cueEndSec: orig.tEndSec,
        })
      ) {
        return;
      }
      setProject((p) => {
        const origInner = p.cues.find((c) => c.id === cueId);
        if (!origInner) return p;
        if (
          !canSplitCueAtTime({
            splitAtSec: splitAt,
            cueStartSec: origInner.tStartSec,
            cueEndSec: origInner.tEndSec,
          })
        ) {
          return p;
        }
        const srcFm = p.formations.find((f) => f.id === origInner.formationId);
        if (!srcFm) return p;
        const newFm = cloneFormationForNewCue(srcFm);
        const newCue: Cue = {
          id: generateId(),
          tStartSec: splitAt,
          tEndSec: origInner.tEndSec,
          formationId: newFm.id,
          name: origInner.name,
          note: origInner.note,
          ...(origInner.gapApproachFromPrev
            ? { gapApproachFromPrev: origInner.gapApproachFromPrev }
            : {}),
        };
        const updatedCues = p.cues.map((c) =>
          c.id === cueId ? { ...c, tEndSec: splitAt } : c
        );
        return {
          ...p,
          formations: [...p.formations, newFm],
          cues: sortCuesByStart([...updatedCues, newCue]),
          activeFormationId: origInner.formationId,
        };
      });
      syncPlaybackHeadAfterCueEdit({
        t: splitAt,
        durationSec: durationRef.current,
        trimStartSec: project.trimStartSec,
        trimEndSec: project.trimEndSec,
      });
      onSelectedCueIdsChange([cueId]);
      onFormationChosenFromCueList?.();
    },
    [
      project,
      currentTime,
      setProject,
      onSelectedCueIdsChange,
      onFormationChosenFromCueList,
      durationRef,
    ]
  );

  const saveCueFormationToBoxList = useCallback(
    (cueId: string) => {
      const c = project.cues.find((x) => x.id === cueId);
      if (!c) return;
      const f = project.formations.find((x) => x.id === c.formationId);
      if (!f || f.dancers.length === 0) {
        window.alert("保存する立ち位置がありません。");
        return;
      }
      const already = listFormationBoxItemsByCount(f.dancers.length).length;
      const suggested = `${f.dancers.length}人の形 ${already + 1}`;
      const result = saveFormationToBox(suggested, f.dancers);
      if (!result.ok) {
        window.alert(result.message);
      }
    },
    [project.cues, project.formations]
  );

  const adjustFormationDancerCount = useCallback(
    (formationId: string, delta: number) => {
      if (project.viewMode === "view") return;
      setProject((p) => {
        const fm = p.formations.find((x) => x.id === formationId);
        if (!fm) return p;
        const cur = fm.dancers.length;
        const n = Math.max(1, Math.min(80, cur + delta));
        if (n === cur) return p;
        const dancers = dancersForLayoutPreset(n, "line", {
          dancerSpacingMm: p.dancerSpacingMm,
          stageWidthMm: p.stageWidthMm,
        });
        return {
          ...p,
          formations: p.formations.map((f) =>
            f.id === formationId
              ? { ...f, dancers, confirmedDancerCount: n }
              : f
          ),
        };
      });
    },
    [project.viewMode, setProject]
  );

  return {
    addCueStartingAtTime,
    removeCue,
    updateCue,
    duplicateCueSameSettings,
    duplicateCueAtTimelineEnd,
    duplicateCueAfterSource,
    splitCueAtPlayhead,
    saveCueFormationToBoxList,
    adjustFormationDancerCount,
  };
}
