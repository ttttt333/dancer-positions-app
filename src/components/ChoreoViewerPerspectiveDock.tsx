import { useCallback } from "react";
import { useI18n } from "../i18n/I18nContext";
import { useViewerChromeStore } from "../store/viewerChromeStore";
import { ViewerAudiencePerspectiveSwitch } from "./ViewerAudiencePerspectiveSwitch";

type Props = {
  landscapeMode: boolean;
  onPerspectiveChange?: () => void;
};

/** 閲覧: ステージ右の固定ドック（舞台／客席の見る向き） */
export function ChoreoViewerPerspectiveDock({
  landscapeMode,
  onPerspectiveChange,
}: Props) {
  const { t } = useI18n();
  const perspective = useViewerChromeStore((s) => s.audiencePerspective);
  const setAudiencePerspective = useViewerChromeStore((s) => s.setAudiencePerspective);

  const handleChange = useCallback(
    (next: typeof perspective) => {
      setAudiencePerspective(next);
      onPerspectiveChange?.();
    },
    [onPerspectiveChange, setAudiencePerspective]
  );

  return (
    <aside
      className={[
        "choreo-viewer-chrome-dock",
        landscapeMode ? "choreo-viewer-chrome-dock--landscape" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={t("editor.layout.viewerPerspectiveDockAria")}
    >
      <ViewerAudiencePerspectiveSwitch
        perspective={perspective}
        layout="dock"
        onChange={handleChange}
      />
    </aside>
  );
}
