import "./home.css";
import { Link } from "react-router-dom";
import { ChoreoCoreLogo } from "../../components/ChoreoCoreLogo";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useI18n } from "../../i18n/I18nContext";

/** ヒーロー直下に出す3項目（残りは詳細セクションへ） */
const HERO_BENEFITS = [
  { id: "02", icon: "◎" },
  { id: "03", icon: "⚡" },
  { id: "05", icon: "↗" },
] as const;

/** ヒーロー以外の機能詳細（既存テキストの移設） */
const DETAIL_REASONS = [
  { id: "01", icon: "◇" },
  { id: "04", icon: "▣" },
  { id: "06", icon: "♪" },
  { id: "07", icon: "↻" },
  { id: "08", icon: "▶" },
  { id: "09", icon: "○" },
  { id: "10", icon: "★" },
  { id: "11", icon: "☁" },
] as const;

const FORMATION_DOTS: Array<{ left: string; top: string; tone: "gold" | "pink" }> = [
  { left: "48%", top: "12%", tone: "gold" },
  { left: "30%", top: "32%", tone: "gold" },
  { left: "66%", top: "32%", tone: "gold" },
  { left: "14%", top: "55%", tone: "pink" },
  { left: "48%", top: "55%", tone: "gold" },
  { left: "82%", top: "55%", tone: "gold" },
  { left: "30%", top: "78%", tone: "gold" },
  { left: "66%", top: "78%", tone: "pink" },
];

const WAVE_BARS: Array<{ h: number; active?: boolean }> = [
  { h: 38 },
  { h: 55 },
  { h: 90, active: true },
  { h: 42 },
  { h: 68 },
  { h: 30 },
  { h: 74 },
  { h: 48 },
  { h: 62 },
  { h: 36 },
];

function FormationMock({ label }: { label: string }) {
  return (
    <div className="home-formation-mock" role="img" aria-label={label}>
      {FORMATION_DOTS.map((d) => (
        <span
          key={`${d.left}-${d.top}`}
          className={`home-formation-dot home-formation-dot--${d.tone}`}
          style={{ left: d.left, top: d.top }}
        />
      ))}
    </div>
  );
}

function WaveformMock() {
  return (
    <div className="home-waveform-mock" aria-hidden>
      {WAVE_BARS.map((b, i) => (
        <span
          key={i}
          className={`home-wave-bar${b.active ? " is-active" : ""}`}
          style={{ height: `${b.h}%` }}
        />
      ))}
    </div>
  );
}

/**
 * 未ログイン向けトップ（ヒーロー改善スペック準拠）。
 * ファーストビューは価値訴求3点 + アプリプレビュー。残り機能は下部へ。
 */
export function GuestLanding() {
  const { t } = useI18n();
  const headlineLines = t("landing.headline").split("\n");

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

      <section className="home-hero" aria-label={t("landing.heroAria")}>
        <div className="home-container home-hero-inner">
          <div className="home-hero-copy">
            <div className="home-trust-badge">
              <span className="home-trust-badge-icon" aria-hidden>
                ◎
              </span>
              <span>{t("landing.trustBadge")}</span>
            </div>

            <p className="home-display home-hero-brand">ChoreoCore</p>

            <h1 className="home-display home-hero-heading">
              {headlineLines.map((line, i) => (
                <span key={i}>
                  {i > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </h1>

            <p className="home-hero-subcopy">{t("landing.support")}</p>

            <div className="home-cta-group">
              <Link to="/register" className="home-btn home-btn--primary">
                {t("landing.ctaTry")}
              </Link>
              <Link to="/login" className="home-btn home-btn--secondary">
                {t("dashboard.login")}
              </Link>
            </div>
            <p className="home-cta-note">{t("landing.ctaNote")}</p>
            <p className="home-cta-methods">{t("landing.registerMethodsHint")}</p>
          </div>

          <div className="home-app-preview">
            <div className="home-app-preview-toolbar">
              <span>{t("landing.previewToolbar")}</span>
              <span className="home-app-preview-play" aria-hidden>
                ▶
              </span>
            </div>
            {/* 本番は img / video(+poster) に差し替え。未準備時は CSS モック */}
            <FormationMock label={t("landing.previewAria")} />
            <WaveformMock />
          </div>
        </div>

        <div className="home-container home-benefits-strip" role="list">
          {HERO_BENEFITS.map((b) => (
            <div key={b.id} className="home-benefit" role="listitem">
              <span className="home-benefit-icon" aria-hidden>
                {b.icon}
              </span>
              <span>{t(`landing.reason.${b.id}`)}</span>
            </div>
          ))}
        </div>
      </section>

      <section
        className="home-features-detail"
        aria-labelledby="landing-features-detail-title"
      >
        <div className="home-container">
          <h2
            id="landing-features-detail-title"
            className="home-display home-features-detail-title"
          >
            {t("landing.featuresDetailTitle")}
          </h2>
          <p className="home-features-detail-lead">{t("landing.featuresDetailLead")}</p>
          <ul className="home-features-detail-list">
            {DETAIL_REASONS.map((r) => (
              <li key={r.id} className="home-features-detail-item">
                <span className="home-features-detail-icon" aria-hidden>
                  {r.icon}
                </span>
                <span>{t(`landing.reason.${r.id}`)}</span>
              </li>
            ))}
          </ul>
          <div className="home-features-detail-cta">
            <Link to="/register" className="home-btn home-btn--primary">
              {t("landing.ctaTry")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
