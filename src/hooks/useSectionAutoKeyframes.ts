/**
 * AI セクション解析完了 → タイムラインへ自動キーフレーム（キュー）配置。
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { useMusicSectionOverlayStore } from "../store/musicSectionOverlayStore";
import { showAppToast } from "../store/appToastStore";
import {
  applySectionKeyframesToProject,
  generateAutoKeyframes,
  projectAllowsSilentAutoKeyframes,
} from "../lib/formation/generateAutoKeyframes";
import { isDegenerateSectionLayout } from "../lib/audioAnalysis/cleanseSections";

type Params = {
  project: ChoreographyProjectJson | null;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  enabled?: boolean;
  publicShareView?: boolean;
};

function sectionsSignature(
  sections: Array<{ startTime: number; endTime: number; type: string }>
): string {
  return sections
    .map((s) => `${s.type}:${s.startTime.toFixed(2)}-${s.endTime.toFixed(2)}`)
    .join("|");
}

export function useSectionAutoKeyframes({
  project,
  setProject,
  enabled = true,
  publicShareView = false,
}: Params) {
  const analysis = useMusicSectionOverlayStore((s) => s.analysis);
  const analyzing = useMusicSectionOverlayStore((s) => s.analyzing);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingOffer, setPendingOffer] = useState(false);
  const appliedSigRef = useRef<string | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  const hasSections = (analysis?.sections.length ?? 0) > 0;
  const canOffer =
    enabled &&
    !publicShareView &&
    !!project &&
    project.viewMode !== "view" &&
    hasSections;

  const applyFromAnalysis = useCallback(
    (opts?: { force?: boolean }): boolean => {
      const p = projectRef.current;
      const a = useMusicSectionOverlayStore.getState().analysis;
      if (!p || !a?.sections.length) return false;
      if (p.viewMode === "view") return false;
      if (!opts?.force && !projectAllowsSilentAutoKeyframes(p)) {
        return false;
      }
      const duration =
        a.duration > 0
          ? a.duration
          : Math.max(0, ...p.cues.map((c) => c.tEndSec), 60);
      if (isDegenerateSectionLayout(a.sections, duration)) {
        return false;
      }

      const seed =
        p.formations.find((f) => f.id === p.activeFormationId) ??
        p.formations[0];
      if (!seed) return false;

      const slice = generateAutoKeyframes({
        sections: a.sections,
        seedFormation: seed,
        durationSec: duration,
        existingKeyframes: p.cues,
        trimStartSec: p.trimStartSec,
        trimEndSec: p.trimEndSec,
      });
      if (slice.cues.length === 0) return false;

      setProject((prev) => applySectionKeyframesToProject(prev, slice));
      appliedSigRef.current = sectionsSignature(a.sections);
      setPendingOffer(false);
      showAppToast({
        kind: "success",
        title: "セクション頭にキーフレームを配置しました",
        description: `${slice.cues.length} 本のキューをタイムラインに追加しました`,
      });
      return true;
    },
    [setProject]
  );

  // 解析完了時: 初期タイムラインなら自動、それ以外はオファー
  useEffect(() => {
    if (!enabled || publicShareView) return;
    if (analyzing) return;
    if (!analysis?.sections.length) return;
    const p = projectRef.current;
    if (!p || p.viewMode === "view") return;

    const sig = sectionsSignature(analysis.sections);
    if (appliedSigRef.current === sig) return;

    if (projectAllowsSilentAutoKeyframes(p)) {
      if (isDegenerateSectionLayout(analysis.sections, analysis.duration || 1)) {
        return;
      }
      applyFromAnalysis({ force: true });
      return;
    }
    setPendingOffer(true);
  }, [analysis, analyzing, enabled, publicShareView, applyFromAnalysis]);

  const requestApplyAiSectionKeyframes = useCallback(() => {
    if (!canOffer) return;
    const p = projectRef.current;
    if (!p) return;
    if (projectAllowsSilentAutoKeyframes(p)) {
      applyFromAnalysis({ force: true });
      return;
    }
    setConfirmOpen(true);
  }, [applyFromAnalysis, canOffer]);

  const confirmApplyAiSectionKeyframes = useCallback(() => {
    applyFromAnalysis({ force: true });
    setConfirmOpen(false);
  }, [applyFromAnalysis]);

  const dismissConfirm = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  const dismissPendingOffer = useCallback(() => {
    setPendingOffer(false);
  }, []);

  return {
    canOffer,
    pendingOffer,
    confirmOpen,
    requestApplyAiSectionKeyframes,
    confirmApplyAiSectionKeyframes,
    dismissConfirm,
    dismissPendingOffer,
  };
}
