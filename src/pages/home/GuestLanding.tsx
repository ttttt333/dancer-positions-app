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

const FLOW_STEPS = [
  { key: "music", title: "MUSIC", body: "Start with the song." },
  { key: "structure", title: "STRUCTURE", body: "Understand where the musical moments happen." },
  { key: "formation", title: "FORMATION", body: "Explore formation possibilities." },
  { key: "transition", title: "TRANSITION", body: "Design how dancers get there." },
  { key: "feasibility", title: "FEASIBILITY", body: "Make sure the formation works on stage." },
  { key: "refine", title: "REFINE", body: "Your choreography. Your decisions." },
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
  {
    id: "A",
    title: "Candidate A",
    traits: ["Symmetry", "Clear lanes", "Center focus"],
    layout: "sym",
  },
  {
    id: "B",
    title: "Candidate B",
    traits: ["Asymmetry", "Depth", "Visual impact"],
    layout: "depth",
  },
  {
    id: "C",
    title: "Candidate C",
    traits: ["Wide coverage", "Spacing", "Wings"],
    layout: "wide",
  },
] as const;

const AUDIENCES = [
  { title: "SOLO", body: "Build formations faster." },
  { title: "CREWS", body: "Design synchronized stage pictures." },
  { title: "COMPETITION TEAMS", body: "Turn musical moments into visual impact." },
  { title: "STUDIOS", body: "Create, teach and organize choreography." },
  {
    title: "PROFESSIONAL CHOREOGRAPHERS",
    body: "Spend less time managing positions. Spend more time creating.",
  },
] as const;

const COMPARE_ROWS: {
  label: string;
  traditional: string;
  choreocore: string;
  status?: "available" | "assisted" | "designed";
}[] = [
  {
    label: "Starting point",
    traditional: "Empty grid",
    choreocore: "Your music + timeline",
    status: "available",
  },
  {
    label: "Song structure",
    traditional: "Manual",
    choreocore: "Music-aware analysis",
    status: "assisted",
  },
  {
    label: "Formation",
    traditional: "Manual only",
    choreocore: "Presets + AI-assisted ideas",
    status: "available",
  },
  {
    label: "Transitions",
    traditional: "Manual",
    choreocore: "Cue-timed paths & approaches",
    status: "available",
  },
  {
    label: "Stage awareness",
    traditional: "Basic",
    choreocore: "Stage board & boundaries",
    status: "available",
  },
  {
    label: "Spacing / feasibility",
    traditional: "Manual",
    choreocore: "Assisted checks in suggestions",
    status: "designed",
  },
  {
    label: "Creative control",
    traditional: "You",
    choreocore: "You — AI proposes, you decide",
    status: "available",
  },
];

const STATUS_LABEL = {
  available: "Available",
  assisted: "AI-assisted",
  designed: "Designed for",
} as const;

/**
 * Guest landing v2 — Music-aware Choreography Intelligence narrative.
 * English-primary story; keeps campaign / auth / legal intact.
 */
export function GuestLanding() {
  const { t } = useI18n();
  const campaign = isReleaseCampaignActive();

  useEffect(() => {
    const prevTitle = document.title;
    const desc = document.querySelector('meta[name="description"]');
    const prevDesc = desc?.getAttribute("content") ?? null;
    document.title = "ChoreoCore — Turn Music Into Movement";
    desc?.setAttribute(
      "content",
      "ChoreoCore helps choreographers turn music into formations, transitions and stage-ready choreography."
    );
    return () => {
      document.title = prevTitle;
      if (desc && prevDesc != null) desc.setAttribute("content", prevDesc);
    };
  }, []);

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
              How it works
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

      {/* ── HERO ── */}
      <section className="lv2-hero" aria-label="ChoreoCore introduction">
        <div className="home-container lv2-hero-inner">
          <div className="lv2-hero-copy">
            <p className="lv2-eyebrow">MUSIC-AWARE CHOREOGRAPHY INTELLIGENCE</p>
            <h1 className="home-display lv2-hero-title">
              TURN MUSIC
              <br />
              INTO <span>MOVEMENT.</span>
            </h1>
            <p className="lv2-hero-sub">
              From song structure to stage formation — ChoreoCore helps
              choreographers design formations that move with the music.
            </p>
            <p className="lv2-hero-jp" lang="ja">
              音楽を聴けば、フォーメーションが見えてくる。
            </p>
            <p className="lv2-pill-row" aria-label="Audience">
              Built for choreographers, crews, competitions &amp; studios.
            </p>
            <div className="lv2-cta-row">
              <Link to="/register" className="home-btn home-btn--primary lv2-btn-lg">
                {campaign ? t("landing.campaign.cta") : "Start free"}
              </Link>
              <a href="#how-it-works" className="home-btn home-btn--secondary lv2-btn-lg">
                See how it works
              </a>
            </div>
            <p className="lv2-cta-note">
              {campaign
                ? t("landing.campaign.note")
                : "Free to start · Sign up with email or Google · No credit card required for Free"}
            </p>
            <p className="lv2-brand-line">
              Most tools place dancers. <strong>ChoreoCore helps you choreograph.</strong>
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

      {/* ── PROBLEM ── */}
      <section className="lv2-section" aria-labelledby="lv2-problem-title">
        <div className="home-container">
          <p className="lv2-eyebrow">THE PROBLEM</p>
          <h2 id="lv2-problem-title" className="home-display lv2-h2">
            STOP MOVING DOTS.
            <br />
            START DESIGNING CHOREOGRAPHY.
          </h2>
          <p className="lv2-lead">
            Most formation tools start with an empty grid. You place every dancer. You adjust
            every position. You repeat it for every section of the song.
          </p>
          <p className="lv2-contrast">
            ChoreoCore starts from the <em>music</em>.
          </p>
          <div className="lv2-compare-flow">
            <div className="lv2-flow-col">
              <h3>TRADITIONAL</h3>
              <ol>
                <li>Empty Stage</li>
                <li>Place Dancers</li>
                <li>Adjust Positions</li>
                <li>Repeat</li>
                <li>Check</li>
              </ol>
            </div>
            <div className="lv2-flow-col is-accent">
              <h3>CHOREOCORE</h3>
              <ol>
                <li>Music</li>
                <li>Structure</li>
                <li>Formation</li>
                <li>Transition</li>
                <li>Refine</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE NEW WAY ── */}
      <section
        id="how-it-works"
        className="lv2-section lv2-section--alt"
        aria-labelledby="lv2-way-title"
      >
        <div className="home-container">
          <p className="lv2-eyebrow">THE NEW WAY</p>
          <h2 id="lv2-way-title" className="home-display lv2-h2">
            FROM MUSIC
            <br />
            TO FORMATION.
          </h2>
          <p className="lv2-pillars">Music × Space × Time × Dancers</p>
          <div className="lv2-steps">
            {FLOW_STEPS.map((s, i) => (
              <article key={s.key} className="lv2-step">
                <span className="lv2-step__n">{String(i + 1).padStart(2, "0")}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── MUSIC STRUCTURE ── */}
      <section className="lv2-section" aria-labelledby="lv2-structure-title">
        <div className="home-container lv2-split">
          <div>
            <p className="lv2-eyebrow">MUSIC STRUCTURE</p>
            <h2 id="lv2-structure-title" className="home-display lv2-h2">
              IT DOESN&apos;T JUST HEAR THE BEAT.
              <br />
              IT UNDERSTANDS THE SONG.
            </h2>
            <p className="lv2-lead">
              Intro. Verse. Pre-chorus. Chorus. Break. Outro. ChoreoCore turns the structure of
              your music into a choreography timeline.
            </p>
            <p className="lv2-status">Available · Song analysis + cue timeline</p>
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

      {/* ── TRANSITION ── */}
      <section className="lv2-section lv2-section--alt" aria-labelledby="lv2-trans-title">
        <div className="home-container lv2-split">
          <div className="lv2-arrival" aria-hidden>
            <div className="lv2-arrival__beat">
              <span>BEAT</span>
              <div className="lv2-arrival__line" />
              <strong>SECTION CHANGE</strong>
            </div>
            <div className="lv2-arrival__path">
              <span>DANCERS MOVE</span>
              <span>→</span>
              <span className="is-on">TRANSITION</span>
              <span>→</span>
              <span>ARRIVAL</span>
              <span>→</span>
              <span className="is-hit">MUSICAL HIT</span>
            </div>
            <p className="lv2-arrival__note">
              Design movement so dancers arrive for the moment — not scramble on the beat.
            </p>
          </div>
          <div>
            <p className="lv2-eyebrow">TRANSITION</p>
            <h2 id="lv2-trans-title" className="home-display lv2-h2">
              DON&apos;T CHANGE ON THE BEAT.
              <br />
              ARRIVE FOR THE MOMENT.
            </h2>
            <p className="lv2-lead">
              A formation is not just where dancers stand. It&apos;s how they get there.
            </p>
            <p className="lv2-status">
              Available · Cue-timed transitions &amp; approach paths between formations
            </p>
          </div>
        </div>
      </section>

      {/* ── AI FORMATION ── */}
      <section className="lv2-section" aria-labelledby="lv2-ai-title">
        <div className="home-container">
          <p className="lv2-eyebrow">AI FORMATION GENERATION</p>
          <h2 id="lv2-ai-title" className="home-display lv2-h2">
            ONE SONG.
            <br />
            INFINITE POSSIBILITIES.
          </h2>
          <p className="lv2-lead">
            Explore formation ideas generated around your music, stage and dancers.
          </p>
          <div className="lv2-ai-flow" aria-label="AI proposes, you decide">
            <span>AI PROPOSES</span>
            <span>→</span>
            <span>CHOREOGRAPHER SELECTS</span>
            <span>→</span>
            <span>CHOREOGRAPHER REFINES</span>
          </div>
          <div className="lv2-candidates">
            {CANDIDATES.map((c) => (
              <article key={c.id} className="lv2-candidate">
                <header>
                  <h3>{c.title}</h3>
                  <ul>
                    {c.traits.map((tr) => (
                      <li key={tr}>{tr}</li>
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
          <p className="lv2-status">Available · AI formation suggestions (you always choose)</p>
        </div>
      </section>

      {/* ── CONTROL ── */}
      <section className="lv2-section lv2-section--alt" aria-labelledby="lv2-control-title">
        <div className="home-container">
          <p className="lv2-eyebrow">CHOREOGRAPHER CONTROL</p>
          <h2 id="lv2-control-title" className="home-display lv2-h2">
            AI PROPOSES.
            <br />
            YOU CHOREOGRAPH.
          </h2>
          <p className="lv2-lead">
            ChoreoCore doesn&apos;t replace your creative decisions. It gives you more
            possibilities to work with.
          </p>
          <div className="lv2-control-rail" aria-hidden>
            {["AI Suggestion", "Edit", "Swap", "Align", "Flip", "Refine"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <p className="lv2-status">
            Available · Editor tools including swap, align, presets, and refine
          </p>
        </div>
      </section>

      {/* ── FEASIBILITY ── */}
      <section className="lv2-section" aria-labelledby="lv2-feas-title">
        <div className="home-container">
          <p className="lv2-eyebrow">MOVEMENT FEASIBILITY</p>
          <h2 id="lv2-feas-title" className="home-display lv2-h2">
            BEAUTIFUL FORMATIONS
            <br />
            AREN&apos;T ENOUGH.
          </h2>
          <p className="lv2-contrast">THEY HAVE TO BE DANCEABLE.</p>
          <p className="lv2-lead">
            A formation can look perfect on screen and still fail in rehearsal. ChoreoCore is
            designed to think about spacing, stage boundaries, transitions and dancer movement.
          </p>
          <div className="lv2-feas-grid">
            <div className="lv2-feas-card is-bad">
              <h3>WATCH FOR</h3>
              <ul>
                <li>Dancer collision</li>
                <li>Too close</li>
                <li>Outside stage</li>
              </ul>
            </div>
            <div className="lv2-feas-card is-check">
              <h3>CHECK</h3>
              <p>Spacing · Boundaries · Paths</p>
            </div>
            <div className="lv2-feas-card is-good">
              <h3>AIM FOR</h3>
              <ul>
                <li>Clear spacing</li>
                <li>Safe stage area</li>
                <li>Smooth transition</li>
              </ul>
            </div>
          </div>
          <p className="lv2-status">
            Designed for · Feasibility signals in AI suggestions; you verify on stage
          </p>
        </div>
      </section>

      {/* ── PRECISION ── */}
      <section className="lv2-section lv2-section--alt" aria-labelledby="lv2-prec-title">
        <div className="home-container lv2-split">
          <div>
            <p className="lv2-eyebrow">PRECISION</p>
            <h2 id="lv2-prec-title" className="home-display lv2-h2">
              DESIGN WITH PRECISE
              <br />
              STAGE COORDINATES.
            </h2>
            <p className="lv2-lead">
              Precise positions. Clear spacing. A stage you can actually work with.
            </p>
            <p className="lv2-status">Available · Stage board grid &amp; coordinate editing</p>
          </div>
          <div className="lv2-precision" aria-hidden>
            <div className="lv2-precision__grid">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className={i === 4 ? "is-focus" : undefined} />
              ))}
            </div>
            <div className="lv2-precision__meta">
              <span>x · y</span>
              <span>spacing</span>
              <span>boundary</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── STUDIO ── */}
      <section className="lv2-section" aria-labelledby="lv2-studio-title">
        <div className="home-container">
          <p className="lv2-eyebrow">FROM SCREEN TO STUDIO</p>
          <h2 id="lv2-studio-title" className="home-display lv2-h2">
            FROM SCREEN
            <br />
            TO STUDIO.
          </h2>
          <div className="lv2-workflow">
            {["DESIGN", "REVIEW", "EXPORT", "REHEARSE", "REFINE"].map((step) => (
              <div key={step} className="lv2-workflow__step">
                {step}
              </div>
            ))}
          </div>
          <p className="lv2-lead">
            Share student links, export materials, and bring the plan into rehearsal — then
            refine.
          </p>
          <p className="lv2-status">Available · Cloud projects, share links, PDF / video export</p>
        </div>
      </section>

      {/* ── WHY ── */}
      <section className="lv2-section lv2-section--alt" aria-labelledby="lv2-why-title">
        <div className="home-container">
          <p className="lv2-eyebrow">WHY CHOREOCORE</p>
          <h2 id="lv2-why-title" className="home-display lv2-h2">
            MOST TOOLS PLACE DANCERS.
            <br />
            CHOREOCORE HELPS YOU CHOREOGRAPH.
          </h2>
          <div className="lv2-table-wrap">
            <table className="lv2-table">
              <thead>
                <tr>
                  <th scope="col"> </th>
                  <th scope="col">Traditional formation tools</th>
                  <th scope="col">ChoreoCore</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.traditional}</td>
                    <td>
                      {row.choreocore}
                      {row.status ? (
                        <span className={`lv2-badge is-${row.status}`}>
                          {STATUS_LABEL[row.status]}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── WHO ── */}
      <section className="lv2-section" aria-labelledby="lv2-who-title">
        <div className="home-container">
          <p className="lv2-eyebrow">WHO IT&apos;S FOR</p>
          <h2 id="lv2-who-title" className="home-display lv2-h2">
            BUILT FOR PEOPLE
            <br />
            WHO BUILD THE SHOW.
          </h2>
          <div className="lv2-who">
            {AUDIENCES.map((a) => (
              <article key={a.title} className="lv2-who-card">
                <h3>{a.title}</h3>
                <p>{a.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="lv2-section lv2-section--alt" aria-labelledby="lv2-price-title">
        <div className="home-container">
          <p className="lv2-eyebrow">PRICING</p>
          <h2 id="lv2-price-title" className="home-display lv2-h2">
            START FREE.
            <br />
            GO PRO WHEN YOU NEED MORE.
          </h2>
          <div className="lv2-pricing">
            <article className="lv2-price-card">
              <h3>FREE</h3>
              <p className="lv2-price-card__price">¥0</p>
              <ul>
                <li>Music timeline &amp; formation cues</li>
                <li>Stage board editing</li>
                <li>Presets &amp; core tools</li>
                <li>Cloud projects (limited)</li>
                <li>Share &amp; export (plan limits apply)</li>
              </ul>
              <Link to="/register" className="home-btn home-btn--secondary">
                Start free
              </Link>
            </article>
            <article className="lv2-price-card is-pro">
              <h3>PRO</h3>
              <p className="lv2-price-card__price">
                ¥{PRO_PRICE_YEN_TAX_IN.toLocaleString()}
                <span>/mo</span>
              </p>
              <p className="lv2-price-card__alt">
                or ¥{PRO_ANNUAL_PRICE_YEN_TAX_IN.toLocaleString()}/yr
              </p>
              <ul>
                <li>Higher / unlimited cues &amp; cast size</li>
                <li>Unlimited cloud projects</li>
                <li>AI formation suggestions</li>
                <li>Expanded export &amp; sharing</li>
                <li>
                  {campaign
                    ? "Campaign: PRO features unlocked free"
                    : `${PRO_TRIAL_DAYS}-day trial on monthly`}
                </li>
              </ul>
              <Link to="/register" className="home-btn home-btn--primary">
                {campaign ? t("landing.campaign.cta") : "Start creating"}
              </Link>
            </article>
          </div>
          <p className="lv2-cta-note">
            Actual limits and trial terms are shown in-app at upgrade. No fictional TEAM plan.
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="lv2-final" aria-labelledby="lv2-final-title">
        <div className="home-container">
          <h2 id="lv2-final-title" className="home-display lv2-h2">
            YOUR MUSIC ALREADY KNOWS
            <br />
            WHERE THE MOMENT SHOULD HAPPEN.
          </h2>
          <p className="lv2-lead">ChoreoCore helps you find it.</p>
          <div className="lv2-cta-row lv2-cta-row--center">
            <Link to="/register" className="home-btn home-btn--primary lv2-btn-lg">
              START CREATING
            </Link>
            <a href="#how-it-works" className="home-btn home-btn--secondary lv2-btn-lg">
              EXPLORE CHOREOCORE
            </a>
          </div>
          <p className="lv2-brand-line lv2-brand-line--final">
            Most tools place dancers.
            <br />
            <strong>ChoreoCore helps you choreograph.</strong>
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
