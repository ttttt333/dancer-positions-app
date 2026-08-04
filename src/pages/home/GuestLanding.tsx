import "./home.css";
import { Link } from "react-router-dom";
import { ChoreoCoreLogo } from "../../components/ChoreoCoreLogo";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useI18n } from "../../i18n/I18nContext";

const REASONS: Array<{ id: string; icon: string }> = [
  { id: "01", icon: "◇" },
  { id: "02", icon: "◎" },
  { id: "03", icon: "⚡" },
  { id: "04", icon: "▣" },
  { id: "05", icon: "◎" },
  { id: "06", icon: "♪" },
  { id: "07", icon: "↻" },
  { id: "08", icon: "▶" },
  { id: "09", icon: "○" },
  { id: "10", icon: "★" },
  { id: "11", icon: "☁" },
];

const STAGE_DOTS: Array<{ x: number; y: number; color: string; delay: string }> = [
  { x: 18, y: 36, color: "#38bdf8", delay: "0s" },
  { x: 32, y: 54, color: "#f472b6", delay: "0.4s" },
  { x: 48, y: 30, color: "#a3e635", delay: "0.8s" },
  { x: 62, y: 58, color: "#fbbf24", delay: "1.1s" },
  { x: 44, y: 68, color: "#e879f9", delay: "0.2s" },
  { x: 74, y: 40, color: "#fb7185", delay: "1.5s" },
  { x: 28, y: 44, color: "#67e8f9", delay: "0.6s" },
  { x: 56, y: 46, color: "#fde68a", delay: "1.3s" },
];

/**
 * 未ログイン向けトップ: 1ビューポートにブランド・価値・登録導線を収める。
 */
export function GuestLanding() {
  const { t } = useI18n();

  return (
    <div className="home-page home-landing">
      <header className="home-guest-header home-landing-header">
        <div className="home-container home-guest-header-inner">
          <ChoreoCoreLogo height={32} title="ChoreoCore" />
          <div className="home-guest-header-actions">
            <LanguageSwitcher variant="inline" />
            <Link to="/login" className="home-landing-login">
              {t("dashboard.login")}
            </Link>
            <Link to="/register" className="home-landing-register-chip">
              {t("dashboard.register")}
            </Link>
          </div>
        </div>
      </header>

      <main className="home-landing-fold" aria-label={t("landing.heroAria")}>
        <div className="home-landing-bg" aria-hidden>
          <div className="home-landing-stage">
            <span className="home-landing-stage-label is-top">舞台裏</span>
            <div className="home-landing-dots">
              {STAGE_DOTS.map((d) => (
                <span
                  key={`${d.x}-${d.y}`}
                  className="home-landing-dot"
                  style={{
                    left: `${d.x}%`,
                    top: `${d.y}%`,
                    background: d.color,
                    animationDelay: d.delay,
                  }}
                />
              ))}
            </div>
            <span className="home-landing-stage-label is-bottom">客席</span>
          </div>
        </div>

        <div className="home-container home-landing-inner">
          <div className="home-landing-intro">
            <p className="home-display home-landing-brand">ChoreoCore</p>
            <h1 className="home-display home-landing-title">{t("landing.headline")}</h1>
            <p className="home-landing-support">{t("landing.support")}</p>
            <div className="home-landing-ctas">
              <Link to="/register" className="home-landing-cta-primary">
                {t("landing.ctaTry")}
              </Link>
              <Link to="/login" className="home-landing-cta-secondary">
                {t("dashboard.login")}
              </Link>
            </div>
            <p className="home-landing-hint">{t("landing.registerMethodsHint")}</p>
          </div>

          <section className="home-landing-reasons" aria-labelledby="landing-reasons-title">
            <div className="home-landing-reasons-head">
              <h2 id="landing-reasons-title" className="home-display home-landing-reasons-title">
                {t("landing.reasonsTitle")}
              </h2>
              <p className="home-landing-reasons-lead">{t("landing.reasonsLead")}</p>
            </div>
            <ul className="home-landing-reasons-list">
              {REASONS.map((r, i) => (
                <li
                  key={r.id}
                  className="home-landing-reason"
                  style={{ animationDelay: `${0.05 * i}s` }}
                >
                  <span className="home-landing-reason-icon" aria-hidden>
                    {r.icon}
                  </span>
                  <span className="home-landing-reason-text">{t(`landing.reason.${r.id}`)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
