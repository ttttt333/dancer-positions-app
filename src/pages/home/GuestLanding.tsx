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
  { key: "cues", icon: "layers" },
  { key: "dancers", icon: "crew" },
  { key: "ai", icon: "star" },
  { key: "cloud", icon: "share" },
  { key: "export", icon: "layers" },
  { key: "share", icon: "share" },
] as const;

const BRAND_FEATURES = [
  { key: "fast", icon: "star" },
  { key: "crew", icon: "crew" },
  { key: "share", icon: "share" },
  { key: "templates", icon: "layers" },
] as const;

function BrandFeatureIcon({ name }: { name: (typeof BRAND_FEATURES)[number]["icon"] }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 32 32",
    fill: "none",
    "aria-hidden": true as const,
  };
  if (name === "star") {
    return (
      <svg {...common}>
        <path
          d="M16 3.5 L18.2 13.2 L28 16 L18.2 18.8 L16 28.5 L13.8 18.8 L4 16 L13.8 13.2 Z"
          stroke="#e8c547"
          strokeWidth="1.6"
          fill="rgba(232,197,71,0.12)"
        />
      </svg>
    );
  }
  if (name === "crew") {
    return (
      <svg {...common}>
        <circle cx="16" cy="10" r="3.2" stroke="#e8c547" strokeWidth="1.6" />
        <circle cx="8.5" cy="12" r="2.4" stroke="#e8c547" strokeWidth="1.5" />
        <circle cx="23.5" cy="12" r="2.4" stroke="#e8c547" strokeWidth="1.5" />
        <path
          d="M8 24c0-3.2 3.2-5.5 8-5.5s8 2.3 8 5.5"
          stroke="#e8c547"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M5 23c.4-2.2 2.2-3.6 4.6-4"
          stroke="#e8c547"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M27 23c-.4-2.2-2.2-3.6-4.6-4"
          stroke="#e8c547"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (name === "share") {
    return (
      <svg {...common}>
        <circle cx="8" cy="16" r="3" stroke="#e8c547" strokeWidth="1.6" />
        <circle cx="24" cy="9" r="3" stroke="#e8c547" strokeWidth="1.6" />
        <circle cx="24" cy="23" r="3" stroke="#e8c547" strokeWidth="1.6" />
        <path d="M11 14.5 21 10.5M11 17.5 21 21.5" stroke="#e8c547" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="7" y="14" width="14" height="11" rx="2" stroke="#e8c547" strokeWidth="1.6" />
      <rect x="10" y="10" width="14" height="11" rx="2" stroke="#e8c547" strokeWidth="1.6" />
      <rect x="13" y="6" width="14" height="11" rx="2" stroke="#e8c547" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * 未ログイン向けトップ。
 * ファーストビューで CHOREO CORE の文字とブランド写真を見せる。
 */
export function GuestLanding() {
  const { t } = useI18n();
  const headlineLines = t("landing.headline").split("\n");
  const campaign = isReleaseCampaignActive();

  return (
    <div className="home-page home-landing">
      <header className="home-guest-header home-landing-header">
        <div className="home-container home-guest-header-inner">
          <Link to="/" className="home-header-brand" aria-label="CHOREO CORE">
            <ChoreoCoreLogo height={40} title="ChoreoCore" withWordmark />
          </Link>
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

      <section className="home-brand-hero" aria-label="CHOREO CORE">
        <div className="home-container home-brand-hero-inner">
          <img
            className="home-brand-hero-mark"
            src="/brand/app-icon.png"
            alt=""
            width={88}
            height={88}
          />
          <p className="home-wordmark home-brand-hero-wordmark">
            <span className="home-wordmark-choreo">CHOREO</span>
            <span className="home-wordmark-core"> CORE</span>
          </p>
          <p className="home-brand-hero-tag">{t("landing.brand.tagline")}</p>
          <p className="home-brand-hero-jp">{t("landing.brand.slogan")}</p>
        </div>
      </section>

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
              {CAMPAIGN_PERKS.map((p) => (
                <li key={p.key} className="home-campaign-perk">
                  <span className="home-campaign-perk-icon">
                    <BrandFeatureIcon name={p.icon} />
                  </span>
                  {t(`landing.campaign.perk.${p.key}`)}
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
              <img
                src="/brand/app-icon.png"
                alt=""
                width={22}
                height={22}
                className="home-trust-badge-img"
              />
              <span>
                {campaign ? t("landing.campaign.trustBadge") : t("landing.trustBadge")}
              </span>
            </div>

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

          <div className="home-app-preview home-app-preview--photo">
            <img
              src="/brand/identity-sheet.png"
              alt={t("landing.previewAria")}
              className="home-app-preview-photo"
            />
          </div>
        </div>

        <div className="home-container home-brand-features" role="list">
          {BRAND_FEATURES.map((f) => (
            <div key={f.key} className="home-brand-feature" role="listitem">
              <span className="home-brand-feature-icon">
                <BrandFeatureIcon name={f.icon} />
              </span>
              <strong>{t(`landing.brand.feature.${f.key}.title`)}</strong>
              <span>{t(`landing.brand.feature.${f.key}.body`)}</span>
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
                <img
                  src="/brand/app-icon.png"
                  alt=""
                  className="home-features-detail-mark"
                  width={28}
                  height={28}
                />
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
