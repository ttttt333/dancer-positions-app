import "./home.css";
import { Link } from "react-router-dom";
import { ChoreoCoreLogo } from "../../components/ChoreoCoreLogo";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useI18n } from "../../i18n/I18nContext";
import {
  PRO_ANNUAL_PRICE_YEN_TAX_IN,
  PRO_PRICE_YEN_TAX_IN,
} from "../../lib/commercialDisclosure";
import { isReleaseCampaignActive } from "../../lib/releaseCampaign";

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

const CAMPAIGN_PERKS = [
  "cues",
  "dancers",
  "ai",
  "cloud",
  "export",
  "share",
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
  const campaign = isReleaseCampaignActive();

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

      {campaign ? (
        <section className="home-campaign" aria-labelledby="landing-campaign-title">
          <div className="home-container home-campaign-inner">
            <p className="home-campaign-eyebrow">{t("landing.campaign.eyebrow")}</p>
            <h2 id="landing-campaign-title" className="home-display home-campaign-title">
              {t("landing.campaign.title")}
            </h2>
            <p className="home-campaign-lead">{t("landing.campaign.lead")}</p>

            <div
              className="home-campaign-pricing"
              role="group"
              aria-label={t("landing.campaign.pricingAria")}
            >
              <div className="home-campaign-price-card">
                <span className="home-campaign-price-label">
                  {t("landing.campaign.monthly")}
                </span>
                <span className="home-campaign-price-was">
                  ¥{PRO_PRICE_YEN_TAX_IN.toLocaleString()}
                </span>
                <span className="home-campaign-price-now">
                  {t("landing.campaign.freeNow")}
                </span>
              </div>
              <div className="home-campaign-price-card">
                <span className="home-campaign-price-label">
                  {t("landing.campaign.annual")}
                </span>
                <span className="home-campaign-price-was">
                  ¥{PRO_ANNUAL_PRICE_YEN_TAX_IN.toLocaleString()}
                </span>
                <span className="home-campaign-price-now">
                  {t("landing.campaign.freeNow")}
                </span>
              </div>
            </div>

            <ul className="home-campaign-perks">
              {CAMPAIGN_PERKS.map((key) => (
                <li key={key} className="home-campaign-perk">
                  <span className="home-campaign-perk-check" aria-hidden>
                    ✓
                  </span>
                  {t(`landing.campaign.perk.${key}`)}
                </li>
              ))}
            </ul>

            <div className="home-campaign-cta">
              <Link to="/register" className="home-btn home-btn--primary">
                {t("landing.campaign.cta")}
              </Link>
              <p className="home-campaign-note">{t("landing.campaign.note")}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="home-hero" aria-label={t("landing.heroAria")}>
        <div className="home-container home-hero-inner">
          <div className="home-hero-copy">
            <div className="home-trust-badge">
              <span className="home-trust-badge-icon" aria-hidden>
                ◎
              </span>
              <span>
                {campaign ? t("landing.campaign.trustBadge") : t("landing.trustBadge")}
              </span>
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

            <p className="home-hero-subcopy">
              {campaign ? t("landing.campaign.support") : t("landing.support")}
            </p>

            <div className="home-cta-group">
              <Link to="/register" className="home-btn home-btn--primary">
                {campaign ? t("landing.campaign.cta") : t("landing.ctaTry")}
              </Link>
              <Link to="/login" className="home-btn home-btn--secondary">
                {t("dashboard.login")}
              </Link>
            </div>
            <p className="home-cta-methods">{t("landing.registerMethodsHint")}</p>
          </div>

          <div className="home-app-preview">
            <div className="home-app-preview-toolbar">
              <span>{t("landing.previewToolbar")}</span>
              <span className="home-app-preview-play" aria-hidden>
                ▶
              </span>
            </div>
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
              {campaign ? t("landing.campaign.cta") : t("landing.ctaTry")}
            </Link>
          </div>
          <footer
            className="home-landing-footer"
            style={{
              marginTop: 40,
              paddingTop: 20,
              borderTop: "1px solid rgba(148,163,184,0.2)",
              display: "flex",
              flexWrap: "wrap",
              gap: "8px 16px",
              fontSize: 12,
            }}
          >
            <Link
              to="/legal/tokushoho"
              style={{ color: "#64748b", textDecoration: "underline" }}
            >
              {t("legal.tokushoho.link")}
            </Link>
          </footer>
        </div>
      </section>
    </div>
  );
}
