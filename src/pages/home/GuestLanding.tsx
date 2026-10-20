import "./home.css";
import "./landing/landingV2.css";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { ChoreoCoreLogo } from "../../components/ChoreoCoreLogo";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useI18n } from "../../i18n/I18nContext";
import {
  PRO_ANNUAL_PRICE_YEN_TAX_IN,
  PRO_PRICE_YEN_TAX_IN,
  PRO_TRIAL_DAYS,
} from "../../lib/commercialDisclosure";
import { isReleaseCampaignActive } from "../../lib/releaseCampaign";
import { LandingHeroVisual } from "./landing/LandingHeroVisual";
import { LANDING_FEATURE_ART } from "./landing/LandingFeatureArt";

const FLOW_STEP_KEYS = [
  "roster",
  "stage",
  "templates",
  "ai",
  "adopt",
  "move",
  "share",
] as const;

const FEATURE_KEYS = [
  "rosterSort",
  "centerDist",
  "templates300",
  "cueNotes",
  "photoImport",
  "viewLink",
  "highlight",
  "export",
  "library",
  "view3d",
  "i18n",
  "collab",
] as const;

const AUDIENCE_KEYS = ["solo", "crews", "comp", "studios", "pro"] as const;

const COMPARE_ROWS: {
  key: string;
  status: "available" | "assisted" | "designed";
}[] = [
  { key: "start", status: "available" },
  { key: "speed", status: "available" },
  { key: "form", status: "available" },
  { key: "share", status: "available" },
  { key: "collab", status: "available" },
  { key: "ai", status: "assisted" },
  { key: "ctrl", status: "available" },
];

/**
 * 未ログイン向けトップ（Landing v2）。
 * 日本語がデフォルト。他言語はヘッダーの LanguageSwitcher で切替。
 */
export function GuestLanding() {
  const { t, locale } = useI18n();
  const campaign = isReleaseCampaignActive();

  useEffect(() => {
    const prevTitle = document.title;
    const desc = document.querySelector('meta[name="description"]');
    const prevDesc = desc?.getAttribute("content") ?? null;
    document.title = t("landing.v2.docTitle");
    desc?.setAttribute("content", t("landing.v2.docDesc"));
    return () => {
      document.title = prevTitle;
      if (desc && prevDesc != null) desc.setAttribute("content", prevDesc);
    };
  }, [t, locale]);

  return (
    <div className="home-page home-landing lv2">
      <header className="home-guest-header home-landing-header">
        <div className="home-container home-guest-header-inner">
          <Link to="/" className="home-header-brand" aria-label="CHOREO CORE">
            <ChoreoCoreLogo height={36} title="ChoreoCore" />
          </Link>
          <div className="home-guest-header-actions">
            <LanguageSwitcher variant="inline" />
            <a href="#how-it-works" className="home-landing-login">
              {t("landing.v2.navHow")}
            </a>
            <Link to="/appeal" className="home-landing-login">
              {t("home.tabAppeal")}
            </Link>
            <Link to="/login" className="home-landing-login">
              {t("dashboard.login")}
            </Link>
            <Link to="/register" className="home-landing-register-chip">
              {t("dashboard.register")}
            </Link>
          </div>
        </div>
      </header>

      <section className="lv2-hero" aria-label={t("landing.heroAria")}>
        <div className="home-container lv2-hero-inner">
          <div className="lv2-hero-copy">
            <p className="lv2-brand-mark home-display" aria-label="CHOREO CORE">
              <span className="lv2-brand-mark__choreo">CHOREO</span>
              <span className="lv2-brand-mark__core"> CORE</span>
            </p>
            <div className="lv2-hero-title-row">
              <h1 className="home-display lv2-hero-title">
                {t("landing.v2.heroTitle1")}
                <br />
                <span>{t("landing.v2.heroTitle2")}</span>
              </h1>
              <div className="lv2-hero-title-logo" aria-hidden="true">
                <ChoreoCoreLogo height={120} title="" />
              </div>
            </div>
            <p className="lv2-hero-sub">{t("landing.v2.heroSub")}</p>
            <p className="lv2-pill-row">{t("landing.v2.audience")}</p>
            <div className="lv2-cta-row">
              <Link to="/register" className="home-btn home-btn--primary lv2-btn-lg">
                {campaign ? t("landing.campaign.cta") : t("landing.v2.ctaStart")}
              </Link>
              <a href="#how-it-works" className="home-btn home-btn--secondary lv2-btn-lg">
                {t("landing.v2.ctaHow")}
              </a>
            </div>
            <p className="lv2-cta-note">
              {campaign ? t("landing.campaign.note") : t("landing.v2.ctaNote")}
            </p>
          </div>
          <LandingHeroVisual />
        </div>
      </section>

      {campaign ? (
        <section className="home-campaign lv2-campaign" aria-labelledby="landing-campaign-title">
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
                <span className="home-campaign-price-label">{t("landing.campaign.monthly")}</span>
                <span className="home-campaign-price-was">
                  ¥{PRO_PRICE_YEN_TAX_IN.toLocaleString()}
                </span>
                <span className="home-campaign-price-now">{t("landing.campaign.freeNow")}</span>
              </div>
              <div className="home-campaign-price-card">
                <span className="home-campaign-price-label">{t("landing.campaign.annual")}</span>
                <span className="home-campaign-price-was">
                  ¥{PRO_ANNUAL_PRICE_YEN_TAX_IN.toLocaleString()}
                </span>
                <span className="home-campaign-price-now">{t("landing.campaign.freeNow")}</span>
              </div>
            </div>
            <div className="home-campaign-cta">
              <Link to="/register" className="home-btn home-btn--primary">
                {t("landing.campaign.cta")}
              </Link>
              <p className="home-campaign-note">{t("landing.campaign.note")}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="lv2-section" aria-labelledby="lv2-problem-title">
        <div className="home-container">
          <p className="lv2-eyebrow">{t("landing.v2.problem.eyebrow")}</p>
          <h2 id="lv2-problem-title" className="home-display lv2-h2">
            {t("landing.v2.problem.title1")}
            <br />
            {t("landing.v2.problem.title2")}
          </h2>
          <p className="lv2-lead">{t("landing.v2.problem.body")}</p>
          <p className="lv2-contrast">
            {t("landing.v2.problem.contrastBefore")}
            <em>{t("landing.v2.problem.contrastEm")}</em>
            {t("landing.v2.problem.contrastAfter")}
          </p>
          <ul className="lv2-pitch-points">
            <li>{t("landing.v2.problem.point1")}</li>
            <li>{t("landing.v2.problem.point2")}</li>
            <li>{t("landing.v2.problem.point3")}</li>
            <li>{t("landing.v2.problem.point4")}</li>
          </ul>
        </div>
      </section>

      <section
        id="how-it-works"
        className="lv2-section lv2-section--alt"
        aria-labelledby="lv2-way-title"
      >
        <div className="home-container">
          <p className="lv2-eyebrow">{t("landing.v2.way.eyebrow")}</p>
          <h2 id="lv2-way-title" className="home-display lv2-h2">
            {t("landing.v2.way.title1")}
            <br />
            {t("landing.v2.way.title2")}
          </h2>
          <p className="lv2-lead">{t("landing.v2.way.lead")}</p>
          <div className="lv2-steps lv2-steps--seven">
            {FLOW_STEP_KEYS.map((key, i) => (
              <article key={key} className="lv2-step">
                <span className="lv2-step__n">{String(i + 1).padStart(2, "0")}</span>
                <h3>{t(`landing.v2.step.${key}.title`)}</h3>
                <p>{t(`landing.v2.step.${key}.body`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="features"
        className="lv2-section"
        aria-labelledby="lv2-features-title"
      >
        <div className="home-container">
          <p className="lv2-eyebrow">{t("landing.v2.features.eyebrow")}</p>
          <h2 id="lv2-features-title" className="home-display lv2-h2">
            {t("landing.v2.features.title1")}
          </h2>
          <p className="lv2-lead lv2-features-lead">{t("landing.v2.features.lead")}</p>
          <ul className="lv2-feature-grid">
            {FEATURE_KEYS.map((key) => {
              const Art = LANDING_FEATURE_ART[key];
              return (
                <li key={key} className="lv2-feature-item">
                  {Art ? (
                    <div className="lv2-feature-item__art">
                      <Art />
                    </div>
                  ) : null}
                  <p className="lv2-feature-item__text">{t(`landing.v2.features.${key}`)}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="lv2-section lv2-section--alt" aria-labelledby="lv2-studio-title">
        <div className="home-container">
          <p className="lv2-eyebrow">{t("landing.v2.studio.eyebrow")}</p>
          <h2 id="lv2-studio-title" className="home-display lv2-h2">
            {t("landing.v2.studio.title1")}
            <br />
            {t("landing.v2.studio.title2")}
          </h2>
          <div className="lv2-workflow">
            {(
              [
                "landing.v2.studio.w1",
                "landing.v2.studio.w2",
                "landing.v2.studio.w3",
                "landing.v2.studio.w4",
                "landing.v2.studio.w5",
              ] as const
            ).map((key) => (
              <div key={key} className="lv2-workflow__step">
                {t(key)}
              </div>
            ))}
          </div>
          <p className="lv2-lead">{t("landing.v2.studio.body")}</p>
          <p className="lv2-status">{t("landing.v2.studio.status")}</p>
        </div>
      </section>

      <section className="lv2-section lv2-section--alt" aria-labelledby="lv2-why-title">
        <div className="home-container">
          <p className="lv2-eyebrow">{t("landing.v2.why.eyebrow")}</p>
          <h2 id="lv2-why-title" className="home-display lv2-h2">
            {t("landing.v2.why.title1")}
            <br />
            {t("landing.v2.why.title2")}
          </h2>
          <div className="lv2-table-wrap">
            <table className="lv2-table">
              <thead>
                <tr>
                  <th scope="col"> </th>
                  <th scope="col">{t("landing.v2.why.colTrad")}</th>
                  <th scope="col">{t("landing.v2.why.colCc")}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{t(`landing.v2.why.row.${row.key}`)}</th>
                    <td>{t(`landing.v2.why.row.${row.key}.t`)}</td>
                    <td>
                      {t(`landing.v2.why.row.${row.key}.c`)}
                      <span className={`lv2-badge is-${row.status}`}>
                        {t(`landing.v2.badge.${row.status}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="lv2-section" aria-labelledby="lv2-who-title">
        <div className="home-container">
          <p className="lv2-eyebrow">{t("landing.v2.who.eyebrow")}</p>
          <h2 id="lv2-who-title" className="home-display lv2-h2">
            {t("landing.v2.who.title1")}
            <br />
            {t("landing.v2.who.title2")}
          </h2>
          <div className="lv2-who">
            {AUDIENCE_KEYS.map((key) => (
              <article key={key} className="lv2-who-card">
                <h3>{t(`landing.v2.who.${key}.title`)}</h3>
                <p>{t(`landing.v2.who.${key}.body`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="lv2-section lv2-section--alt" aria-labelledby="lv2-price-title">
        <div className="home-container">
          <p className="lv2-eyebrow">{t("landing.v2.price.eyebrow")}</p>
          <h2 id="lv2-price-title" className="home-display lv2-h2">
            {t("landing.v2.price.title1")}
            <br />
            {t("landing.v2.price.title2")}
          </h2>
          <div className="lv2-pricing">
            <article className="lv2-price-card">
              <h3>{t("landing.v2.price.free")}</h3>
              <p className="lv2-price-card__price">¥0</p>
              <ul>
                <li>{t("landing.v2.price.free1")}</li>
                <li>{t("landing.v2.price.free2")}</li>
                <li>{t("landing.v2.price.free3")}</li>
                <li>{t("landing.v2.price.free4")}</li>
                <li>{t("landing.v2.price.free5")}</li>
              </ul>
              <Link to="/register" className="home-btn home-btn--secondary">
                {t("landing.v2.ctaStart")}
              </Link>
            </article>
            <article className="lv2-price-card is-pro">
              <h3>{t("landing.v2.price.pro")}</h3>
              <p className="lv2-price-card__price">
                ¥{PRO_PRICE_YEN_TAX_IN.toLocaleString()}
                <span>{t("landing.v2.price.perMo")}</span>
              </p>
              <p className="lv2-price-card__alt">
                {t("landing.v2.price.orYear", {
                  price: PRO_ANNUAL_PRICE_YEN_TAX_IN.toLocaleString(),
                })}
              </p>
              <ul>
                <li>{t("landing.v2.price.pro1")}</li>
                <li>{t("landing.v2.price.pro2")}</li>
                <li>{t("landing.v2.price.pro3")}</li>
                <li>{t("landing.v2.price.pro4")}</li>
                <li>
                  {campaign
                    ? t("landing.v2.price.proCampaign")
                    : t("landing.v2.price.proTrial", { days: PRO_TRIAL_DAYS })}
                </li>
              </ul>
              <Link to="/register" className="home-btn home-btn--primary">
                {campaign ? t("landing.campaign.cta") : t("landing.v2.price.ctaCreate")}
              </Link>
            </article>
          </div>
          <p className="lv2-cta-note">{t("landing.v2.price.note")}</p>
        </div>
      </section>

      <section className="lv2-final" aria-labelledby="lv2-final-title">
        <div className="home-container">
          <h2 id="lv2-final-title" className="home-display lv2-h2">
            {t("landing.v2.final.title1")}
            <br />
            {t("landing.v2.final.title2")}
          </h2>
          <p className="lv2-lead">{t("landing.v2.final.sub")}</p>
          <div className="lv2-cta-row lv2-cta-row--center">
            <Link to="/register" className="home-btn home-btn--primary lv2-btn-lg">
              {t("landing.v2.final.ctaPrimary")}
            </Link>
            <a href="#how-it-works" className="home-btn home-btn--secondary lv2-btn-lg">
              {t("landing.v2.final.ctaSecondary")}
            </a>
          </div>
          <p className="lv2-brand-line lv2-brand-line--final">
            {t("landing.v2.brandLine")}
            <br />
            <strong>{t("landing.v2.brandLineStrong")}</strong>
          </p>
          <footer className="lv2-footer">
            <Link to="/legal/tokushoho">{t("legal.tokushoho.link")}</Link>
            <Link to="/appeal">{t("home.tabAppeal")}</Link>
            <Link to="/login">{t("dashboard.login")}</Link>
          </footer>
        </div>
      </section>
    </div>
  );
}
