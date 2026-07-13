import { useI18n } from "../i18n/I18nContext";
import type { ViewerAudiencePerspective } from "../lib/viewerAudiencePerspective";

type Props = {
  perspective: ViewerAudiencePerspective;
  layout?: "inline" | "stack" | "dock";
  onChange: (next: ViewerAudiencePerspective) => void;
};

/** 閲覧: 舞台側／客席側の見る向き */
export function ViewerAudiencePerspectiveSwitch({
  perspective,
  layout = "inline",
  onChange,
}: Props) {
  const { t } = useI18n();
  const isStage = perspective === "stage";

  return (
    <div
      className={[
        "choreo-viewer-perspective",
        layout === "stack" ? "choreo-viewer-perspective--stack" : "",
        layout === "dock" ? "choreo-viewer-perspective--dock" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label={t("editor.layout.viewerPerspectiveSwitchAria")}
    >
      <button
        type="button"
        className={[
          "choreo-viewer-perspective__seg",
          isStage ? "choreo-viewer-perspective__seg--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-pressed={isStage}
        title={t("editor.layout.viewerPerspectiveStageTitle")}
        onClick={() => {
          if (!isStage) onChange("stage");
        }}
      >
        {t("editor.layout.viewerPerspectiveStage")}
      </button>
      <button
        type="button"
        className={[
          "choreo-viewer-perspective__seg",
          !isStage ? "choreo-viewer-perspective__seg--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-pressed={!isStage}
        title={t("editor.layout.viewerPerspectiveAudienceTitle")}
        onClick={() => {
          if (isStage) onChange("audience");
        }}
      >
        {t("editor.layout.viewerPerspectiveAudience")}
      </button>
    </div>
  );
}
