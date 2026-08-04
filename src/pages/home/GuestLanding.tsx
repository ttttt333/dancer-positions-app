import "./home.css";
import { Link } from "react-router-dom";
import { ChoreoCoreLogo } from "../../components/ChoreoCoreLogo";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { btnAccent, btnSecondary } from "../../components/stageButtonStyles";
import { useI18n } from "../../i18n/I18nContext";

const REASONS: Array<{ id: string; mark: string }> = [
  { id: "01", mark: "01" },
  { id: "02", mark: "02" },
  { id: "03", mark: "03" },
  { id: "04", mark: "04" },
  { id: "05", mark: "05" },
  { id: "06", mark: "06" },
  { id: "07", mark: "07" },
  { id: "08", mark: "08" },
  { id: "09", mark: "09" },
  { id: "10", mark: "10" },
  { id: "11", mark: "11" },
];

const STAGE_DOTS: Array<{ x: number; y: number; color: string }> = [
  { x: 22, y: 38, color: "#38bdf8" },
  { x: 38, y: 52, color: "#f472b6" },
  { x: 55, y: 34, color: "#a3e635" },
  { x: 68, y: 58, color: "#fbbf24" },
  { x: 48, y: 68, color: "#c084fc" },
  { x: 78, y: 42, color: "#fb7185" },
];

/**
 * 未ログイン向けトップ: ヒーロー + できること。
 * PC / スマホで読みやすいレスポンシブ構成。
 */
export function GuestLanding() {
  const { t } = useI18n();

  return (
    <div className="home-page">
      <header className="home-guest-header">
        <div className="home-container home-guest-header-inner">
          <ChoreoCoreLogo height={36} title="ChoreoCore" />
          <div className="home-guest-header-actions">
            <LanguageSwitcher variant="inline" />
            <Link
              to="/login"
              style={{
                ...btnSecondary,
                textDecoration: "none",
                padding: "8px 12px",
                fontSize: 13,
              }}
            >
              {t("dashboard.login")}
            </Link>
            <Link
              to="/register"
              style={{
                ...btnAccent,
                textDecoration: "none",
                padding: "8px 12px",
                fontSize: 13,
              }}
            >
              {t("dashboard.register")}
            </Link>
          </div>
        </div>
      </header>

      <section className="home-hero" aria-label={t("landing.heroAria")}>
        <div className="home-hero-bg" aria-hidden />
        <div className="home-container home-hero-inner">
          <div className="home-hero-copy">
            <div className="home-hero-brand">
              <ChoreoCoreLogo height={56} title="ChoreoCore" />
            </div>
            <h1 className="home-display home-hero-title">{t("landing.headline")}</h1>
            <p className="home-hero-support">{t("landing.support")}</p>
            <div className="home-hero-ctas">
              <Link
                to="/register"
                style={{
                  ...btnAccent,
                  textDecoration: "none",
                  padding: "14px 22px",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                {t("landing.ctaTry")}
              </Link>
              <Link
                to="/register"
                style={{
                  ...btnSecondary,
                  textDecoration: "none",
                  padding: "14px 22px",
                  fontSize: 15,
                }}
              >
                {t("landing.ctaRegister")}
              </Link>
            </div>
          </div>

          <div className="home-hero-stage" aria-hidden>
            <div className="home-hero-stage-label-top">舞台裏</div>
            <div className="home-hero-dots">
              {STAGE_DOTS.map((d) => (
                <span
                  key={`${d.x}-${d.y}`}
                  className="home-hero-dot"
                  style={{ left: `${d.x}%`, top: `${d.y}%`, background: d.color }}
                />
              ))}
            </div>
            <div className="home-hero-stage-label-bottom">客席</div>
          </div>
        </div>
      </section>

      <section className="home-features" aria-labelledby="landing-reasons-title">
        <div className="home-container">
          <h2 id="landing-reasons-title" className="home-display home-features-title">
            {t("landing.reasonsTitle")}
          </h2>
          <p className="home-features-lead">{t("landing.reasonsLead")}</p>
          <ul className="home-features-grid">
            {REASONS.map((r) => (
              <li key={r.id} className="home-feature-item">
                <span className="home-display home-feature-mark" aria-hidden>
                  {r.mark}
                </span>
                <div>
                  <p className="home-feature-body" style={{ margin: 0 }}>
                    {t(`landing.reason.${r.id}`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="home-features-cta">
            <Link
              to="/register"
              style={{
                ...btnAccent,
                textDecoration: "none",
                display: "inline-flex",
                padding: "14px 22px",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {t("landing.ctaRegister")}
            </Link>
            <p style={{ margin: "10px 0 0", color: "#a8a29e", fontSize: 12, lineHeight: 1.6 }}>
              {t("landing.registerMethodsHint")}
            </p>
          </div>
          <div className="home-guest-locale-mobile">
            <LanguageSwitcher variant="inline" />
          </div>
        </div>
      </section>
    </div>
  );
}
