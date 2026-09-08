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

const FLOW_STEP_KEYS = [
  "music",
  "structure",
  "formation",
  "transition",
  "feasibility",
  "refine",
] as const;

const STRUCTURE_CUES = [
  { t: "00:00", label: "INTRO" },
  { t: "00:12", label: "VERSE" },
  { t: "00:32", label: "PRE-CHORUS" },
  { t: "00:48", label: "CHORUS" },
  { t: "01:18", label: "BREAK" },
  { t: "01:32", label: "CHORUS" },
  { t: "01:58", label: "OUTRO" },
] as const;

const CANDIDATES = [
  { id: "A", layout: "sym", traits: ["sym1", "sym2", "sym3"] },
  { id: "B", layout: "depth", traits: ["depth1", "depth2", "depth3"] },
  { id: "C", layout: "wide", traits: ["wide1", "wide2", "wide3"] },
] as const;

const AUDIENCE_KEYS = ["solo", "crews", "comp", "studios", "pro"] as const;

const COMPARE_ROWS: {
  key: string;
  status: "available" | "assisted" | "designed";
}[] = [
  { key: "start", status: "available" },
  { key: "struct", status: "assisted" },
  { key: "form", status: "available" },
  { key: "trans", status: "available" },
  { key: "stage", status: "available" },
  { key: "space", status: "designed" },
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
            <ChoreoCoreLogo height={40} title="ChoreoCore" withWordmark />
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
            <p className="lv2-eyebrow">{t("landing.v2.eyebrow")}</p>
            <h1 className="home-display lv2-hero-title">
              {t("landing.v2.heroTitle1")}
              <br />
              <span>{t("landing.v2.heroTitle2")}</span>
            </h1>
            <p className="lv2-hero-sub">{t("landing.v2.heroSub")}</p>
            <p className="lv2-hero-jp">{t("landing.v2.heroTag")}</p>
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
            <p className="lv2-brand-line">
              {t("landing.v2.brandLine")}{" "}
              <strong>{t("landing.v2.brandLineStrong")}</strong>
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
          <div className="lv2-compare-flow">
            <div className="lv2-flow-col">
              <h3>{t("landing.v2.problem.tradTitle")}</h3>
              <ol>
                <li>{t("landing.v2.problem.trad1")}</li>
                <li>{t("landing.v2.problem.trad2")}</li>
                <li>{t("landing.v2.problem.trad3")}</li>
                <li>{t("landing.v2.problem.trad4")}</li>
                <li>{t("landing.v2.problem.trad5")}</li>
              </ol>
            </div>
            <div className="lv2-flow-col is-accent">
              <h3>{t("landing.v2.problem.ccTitle")}</h3>
              <ol>
                <li>{t("landing.v2.problem.cc1")}</li>
                <li>{t("landing.v2.problem.cc2")}</li>
                <li>{t("landing.v2.problem.cc3")}</li>
                <li>{t("landing.v2.problem.cc4")}</li>
                <li>{t("landing.v2.problem.cc5")}</li>
              </ol>
            </div>
          </div>
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
          <p className="lv2-pillars">{t("landing.v2.way.pillars")}</p>
          <div className="lv2-steps">
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

      <section className="lv2-section" aria-labelledby="lv2-structure-title">
        <div className="home-container lv2-split">
          <div>
            <p className="lv2-eyebrow">{t("landing.v2.structure.eyebrow")}</p>
            <h2 id="lv2-structure-title" className="home-display lv2-h2">
              {t("landing.v2.structure.title1")}
              <br />
              {t("landing.v2.structure.title2")}
            </h2>
            <p className="lv2-lead">{t("landing.v2.structure.body")}</p>
            <p className="lv2-status">{t("landing.v2.structure.status")}</p>
          </div>
          <div className="lv2-structure-panel" aria-hidden>
            <ul className="lv2-structure-list">
              {STRUCTURE_CUES.map((c) => (
                <li key={`${c.t}-${c.label}`}>
                  <time>{c.t}</time>
                  <span>{c.label}</span>
                </li>
              ))}
            </ul>
            <div className="lv2-state-track">
              <div>
                <strong>FORMATION A</strong>
                <i />
              </div>
              <div className="is-trans">
                <strong>TRANSITION</strong>
                <i />
              </div>
              <div>
                <strong>FORMATION B</strong>
                <i />
              </div>
              <div className="is-trans">
                <strong>TRANSITION</strong>
                <i />
              </div>
              <div>
                <strong>FORMATION C</strong>
                <i />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lv2-section lv2-section--alt" aria-labelledby="lv2-trans-title">
        <div className="home-container lv2-split">
          <div className="lv2-arrival" aria-hidden>
            <div className="lv2-arrival__beat">
              <span>{t("landing.v2.trans.beat")}</span>
              <div className="lv2-arrival__line" />
              <strong>{t("landing.v2.trans.sectionChange")}</strong>
            </div>
            <div className="lv2-arrival__path">
              <span>{t("landing.v2.trans.move")}</span>
              <span>→</span>
              <span className="is-on">{t("landing.v2.trans.transition")}</span>
              <span>→</span>
              <span>{t("landing.v2.trans.arrival")}</span>
              <span>→</span>
              <span className="is-hit">{t("landing.v2.trans.hit")}</span>
            </div>
            <p className="lv2-arrival__note">{t("landing.v2.trans.note")}</p>
          </div>
          <div>
            <p className="lv2-eyebrow">{t("landing.v2.trans.eyebrow")}</p>
            <h2 id="lv2-trans-title" className="home-display lv2-h2">
              {t("landing.v2.trans.title1")}
              <br />
              {t("landing.v2.trans.title2")}
            </h2>
            <p className="lv2-lead">{t("landing.v2.trans.body")}</p>
            <p className="lv2-status">{t("landing.v2.trans.status")}</p>
          </div>
        </div>
      </section>

      <section className="lv2-section" aria-labelledby="lv2-ai-title">
        <div className="home-container">
          <p className="lv2-eyebrow">{t("landing.v2.ai.eyebrow")}</p>
          <h2 id="lv2-ai-title" className="home-display lv2-h2">
            {t("landing.v2.ai.title1")}
            <br />
            {t("landing.v2.ai.title2")}
          </h2>
          <p className="lv2-lead">{t("landing.v2.ai.body")}</p>
          <div className="lv2-ai-flow">
            <span>{t("landing.v2.ai.flow1")}</span>
            <span>→</span>
            <span>{t("landing.v2.ai.flow2")}</span>
            <span>→</span>
            <span>{t("landing.v2.ai.flow3")}</span>
          </div>
          <div className="lv2-candidates">
            {CANDIDATES.map((c) => (
              <article key={c.id} className="lv2-candidate">
                <header>
                  <h3>{t("landing.v2.ai.candidate", { id: c.id })}</h3>
                  <ul>
                    {c.traits.map((tr) => (
                      <li key={tr}>{t(`landing.v2.ai.trait.${tr}`)}</li>
                    ))}
                  </ul>
                </header>
                <div className={`lv2-candidate__stage is-${c.layout}`} aria-hidden>
                  {Array.from({ length: 6 }, (_, i) => (
                    <i key={i} />
                  ))}
                </div>
              </article>
            ))}
          </div>
          <p className="lv2-status">{t("landing.v2.ai.status")}</p>
        </div>
      </section>

      <section className="lv2-section lv2-section--alt" aria-labelledby="lv2-control-title">
        <div className="home-container">
          <p className="lv2-eyebrow">{t("landing.v2.control.eyebrow")}</p>
          <h2 id="lv2-control-title" className="home-display lv2-h2">
            {t("landing.v2.control.title1")}
            <br />
            {t("landing.v2.control.title2")}
          </h2>
          <p className="lv2-lead">{t("landing.v2.control.body")}</p>
          <div className="lv2-control-rail" aria-hidden>
            {(
              [
                "landing.v2.control.rail1",
                "landing.v2.control.rail2",
                "landing.v2.control.rail3",
                "landing.v2.control.rail4",
                "landing.v2.control.rail5",
                "landing.v2.control.rail6",
              ] as const
            ).map((key) => (
              <span key={key}>{t(key)}</span>
            ))}
          </div>
          <p className="lv2-status">{t("landing.v2.control.status")}</p>
        </div>
      </section>

      <section className="lv2-section" aria-labelledby="lv2-feas-title">
        <div className="home-container">
          <p className="lv2-eyebrow">{t("landing.v2.feas.eyebrow")}</p>
          <h2 id="lv2-feas-title" className="home-display lv2-h2">
            {t("landing.v2.feas.title1")}
            <br />
            {t("landing.v2.feas.title2")}
          </h2>
          <p className="lv2-contrast">{t("landing.v2.feas.contrast")}</p>
          <p className="lv2-lead">{t("landing.v2.feas.body")}</p>
          <div className="lv2-feas-grid">
            <div className="lv2-feas-card is-bad">
              <h3>{t("landing.v2.feas.badTitle")}</h3>
              <ul>
                <li>{t("landing.v2.feas.bad1")}</li>
                <li>{t("landing.v2.feas.bad2")}</li>
                <li>{t("landing.v2.feas.bad3")}</li>
              </ul>
            </div>
            <div className="lv2-feas-card is-check">
              <h3>{t("landing.v2.feas.checkTitle")}</h3>
              <p>{t("landing.v2.feas.checkBody")}</p>
            </div>
            <div className="lv2-feas-card is-good">
              <h3>{t("landing.v2.feas.goodTitle")}</h3>
              <ul>
                <li>{t("landing.v2.feas.good1")}</li>
                <li>{t("landing.v2.feas.good2")}</li>
                <li>{t("landing.v2.feas.good3")}</li>
              </ul>
            </div>
          </div>
          <p className="lv2-status">{t("landing.v2.feas.status")}</p>
        </div>
      </section>

      <section className="lv2-section lv2-section--alt" aria-labelledby="lv2-prec-title">
        <div className="home-container lv2-split">
          <div>
            <p className="lv2-eyebrow">{t("landing.v2.prec.eyebrow")}</p>
            <h2 id="lv2-prec-title" className="home-display lv2-h2">
              {t("landing.v2.prec.title1")}
              <br />
              {t("landing.v2.prec.title2")}
            </h2>
            <p className="lv2-lead">{t("landing.v2.prec.body")}</p>
            <p className="lv2-status">{t("landing.v2.prec.status")}</p>
          </div>
          <div className="lv2-precision" aria-hidden>
            <div className="lv2-precision__grid">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className={i === 4 ? "is-focus" : undefined} />
              ))}
            </div>
            <div className="lv2-precision__meta">
              <span>{t("landing.v2.prec.meta1")}</span>
              <span>{t("landing.v2.prec.meta2")}</span>
              <span>{t("landing.v2.prec.meta3")}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="lv2-section" aria-labelledby="lv2-studio-title">
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
