import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nContext";
import { ChoreoCoreLogo } from "./ChoreoCoreLogo";

const DISMISS_KEY = "choreocore.viewerViralCta.dismissed";

export type ChoreoViewerViralCtaProps = {
  /** gate = メンバー選択前 / viewer = 閲覧中 */
  variant: "gate" | "viewer";
  /** 横向き閲覧（左レールあり） */
  landscape?: boolean;
};

/**
 * 生徒閲覧 URL（/view）向けバイラル CTA。
 * 1作品 → 多数の生徒に認知される口コミループ用。
 */
export function ChoreoViewerViralCta({
  variant,
  landscape = false,
}: ChoreoViewerViralCtaProps) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const registerTo = "/register?from=student-view";

  if (dismissed) {
    return (
      <Link
        to={registerTo}
        className={[
          "choreo-viewer-viral-cta",
          "choreo-viewer-viral-cta--chip",
          variant === "gate" ? "choreo-viewer-viral-cta--gate-chip" : "",
          landscape ? "choreo-viewer-viral-cta--landscape-chip" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={t("viewer.viral.cta")}
      >
        {t("viewer.viral.ctaShort")}
      </Link>
    );
  }

  return (
    <div
      className={[
        "choreo-viewer-viral-cta",
        "choreo-viewer-viral-cta--bar",
        variant === "gate" ? "choreo-viewer-viral-cta--gate" : "choreo-viewer-viral-cta--viewer",
        landscape ? "choreo-viewer-viral-cta--landscape" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="complementary"
      aria-label={t("viewer.viral.aria")}
    >
      <div className="choreo-viewer-viral-cta__brand">
        <ChoreoCoreLogo height={22} title="ChoreoCore" />
      </div>
      <p className="choreo-viewer-viral-cta__copy">
        <span className="choreo-viewer-viral-cta__line">{t("viewer.viral.line")}</span>
        <span className="choreo-viewer-viral-cta__sub">{t("viewer.viral.sub")}</span>
      </p>
      <Link to={registerTo} className="choreo-viewer-viral-cta__btn">
        {t("viewer.viral.cta")}
      </Link>
      {variant === "viewer" ? (
        <button
          type="button"
          className="choreo-viewer-viral-cta__dismiss"
          aria-label={t("viewer.viral.dismiss")}
          onClick={dismiss}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
