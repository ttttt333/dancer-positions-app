/**
 * セクション種別ごとの隊形プリセット一括適用（ダイアログ付き）。
 */

import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { useMusicSectionOverlayStore } from "../store/musicSectionOverlayStore";
import { showAppToast } from "../store/appToastStore";
import {
  applySectionFormationPatterns,
  type SectionPatternMap,
} from "../lib/formation/sectionFormationPatterns";

type Params = {
  project: ChoreographyProjectJson | null;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  enabled?: boolean;
  publicShareView?: boolean;
};

export function useSectionFormationPatterns({
  project,
  setProject,
  enabled = true,
  publicShareView = false,
}: Params) {
  const analysis = useMusicSectionOverlayStore((s) => s.analysis);
  const [dialogOpen, setDialogOpen] = useState(false);

  const hasSections = (analysis?.sections.length ?? 0) > 0;
  const hasCues = (project?.cues.length ?? 0) > 0;
  const canOffer =
    enabled &&
    !publicShareView &&
    !!project &&
    project.viewMode !== "view" &&
    hasSections &&
    hasCues;

  const openDialog = useCallback(() => {
    if (!canOffer) return;
    setDialogOpen(true);
  }, [canOffer]);

  const dismissDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const confirmApply = useCallback(
    (map: SectionPatternMap) => {
      if (!project || !analysis?.sections.length) {
        setDialogOpen(false);
        return;
      }
      if (project.viewMode === "view") {
        setDialogOpen(false);
        return;
      }

      const { project: next, updatedFormationCount } =
        applySectionFormationPatterns(project, analysis.sections, map);

      if (updatedFormationCount === 0) {
        showAppToast({
          kind: "error",
          title: "適用できるキーフレームがありません",
          description:
            "先に AI セクションからキーフレームを配置してください。",
        });
        setDialogOpen(false);
        return;
      }

      setProject(next);
      showAppToast({
        kind: "success",
        title: "セクション隊形を適用しました",
        description: `${updatedFormationCount} 件のフォーメーションを更新しました`,
      });
      setDialogOpen(false);
    },
    [analysis, project, setProject]
  );

  return {
    canOffer,
    dialogOpen,
    sections: analysis?.sections ?? [],
    openDialog,
    dismissDialog,
    confirmApply,
  };
}
