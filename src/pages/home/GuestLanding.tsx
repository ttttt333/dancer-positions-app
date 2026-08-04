import { Link } from "react-router-dom";
import { ChoreoCoreLogo } from "../../components/ChoreoCoreLogo";
import { btnAccent, btnSecondary } from "../../components/stageButtonStyles";
import { useI18n } from "../../i18n/I18nContext";
import { shell } from "../../theme/choreoShell";
import { HOME_DISPLAY, homeRootStyle } from "./homeChrome";

const FEATURES = [
  { key: "landing.featureTimeline", mark: "01" },
  { key: "landing.featureStage", mark: "02" },
  { key: "landing.featureShare", mark: "03" },
  { key: "landing.featureSync", mark: "04" },
] as const;

/**
 * 未ログイン向けトップ: ヒーロー + できること。
 * 作品管理 UI は出さず、試用と登録へ誘導する。
 */
export function GuestLanding() {
  const { t } = useI18n();

  return (
    <div style={homeRootStyle}>
      <header
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding:
            "max(14px, env(safe-area-inset-top, 0px)) max(20px, env(safe-area-inset-right, 0px)) 12px max(20px, env(safe-area-inset-left, 0px))",
        }}
      >
        <ChoreoCoreLogo height={40} title="ChoreoCore" />
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            to="/login"
            style={{
              ...btnSecondary,
              textDecoration: "none",
              padding: "8px 14px",
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
              padding: "8px 14px",
              fontSize: 13,
            }}
          >
            {t("dashboard.register")}
          </Link>
        </div>
      </header>

      <section
        aria-label={t("landing.heroAria")}
        style={{
          position: "relative",
          minHeight: "min(88dvh, 760px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding:
            "0 max(22px, env(safe-area-inset-right, 0px)) 48px max(22px, env(safe-area-inset-left, 0px))",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `
              radial-gradient(ellipse 90% 70% at 70% 35%, rgba(212, 175, 55, 0.18), transparent 55%),
              radial-gradient(ellipse 60% 50% at 15% 80%, rgba(196, 30, 58, 0.12), transparent 50%),
              linear-gradient(180deg, rgba(6,6,6,0.2) 0%, rgba(6,6,6,0.75) 55%, ${shell.bgDeep} 100%),
              repeating-linear-gradient(90deg, rgba(212,175,55,0.04) 0 1px, transparent 1px 48px),
              repeating-linear-gradient(0deg, rgba(212,175,55,0.035) 0 1px, transparent 1px 48px),
              ${shell.bgDeep}
            `,
            animation: "home-hero-glow 10s ease-in-out infinite alternate",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: "max(4%, env(safe-area-inset-right))",
            top: "12%",
            width: "min(52vw, 420px)",
            aspectRatio: "4 / 3",
            borderRadius: 18,
            border: `1px solid ${shell.borderStrong}`,
            background:
              "linear-gradient(165deg, rgba(24,22,18,0.55), rgba(8,8,10,0.7))",
            boxShadow: "inset 0 0 80px rgba(0,0,0,0.45)",
            transform: "rotate(-2deg)",
            animation: "home-stage-float 7s ease-in-out infinite alternate",
          }}
        />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 560 }}>
          <p
            style={{
              margin: "0 0 10px",
              fontFamily: HOME_DISPLAY,
              fontSize: "clamp(28px, 7vw, 44px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: shell.text,
            }}
          >
            ChoreoCore
          </p>
          <h1
            style={{
              margin: "0 0 14px",
              fontFamily: HOME_DISPLAY,
              fontSize: "clamp(22px, 5.2vw, 32px)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.25,
              color: shell.text,
            }}
          >
            {t("landing.headline")}
          </h1>
          <p
            style={{
              margin: "0 0 28px",
              fontSize: "clamp(15px, 3.4vw, 17px)",
              lineHeight: 1.6,
              color: shell.textMuted,
              maxWidth: 420,
            }}
          >
            {t("landing.support")}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link
              to="/editor/new"
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
      </section>

      <section
        aria-labelledby="landing-features-title"
        style={{
          padding:
            "56px max(22px, env(safe-area-inset-right, 0px)) max(64px, env(safe-area-inset-bottom, 0px)) max(22px, env(safe-area-inset-left, 0px))",
          borderTop: `1px solid ${shell.border}`,
          background: `linear-gradient(180deg, ${shell.bgChrome}, ${shell.bgDeep})`,
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2
            id="landing-features-title"
            style={{
              margin: "0 0 8px",
              fontFamily: HOME_DISPLAY,
              fontSize: "clamp(22px, 4.5vw, 28px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            {t("landing.featuresTitle")}
          </h2>
          <p
            style={{
              margin: "0 0 28px",
              fontSize: 15,
              color: shell.textMuted,
              lineHeight: 1.55,
            }}
          >
            {t("landing.featuresLead")}
          </p>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: 18,
            }}
          >
            {FEATURES.map((f) => (
              <li
                key={f.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr",
                  gap: 14,
                  alignItems: "start",
                  padding: "4px 0",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    display: "grid",
                    placeItems: "center",
                    background: shell.accentSoft,
                    color: shell.accent,
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    fontFamily: HOME_DISPLAY,
                  }}
                >
                  {f.mark}
                </span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                    {t(`${f.key}.title`)}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: shell.textMuted,
                      lineHeight: 1.55,
                    }}
                  >
                    {t(`${f.key}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 36 }}>
            <Link
              to="/editor/new"
              style={{
                ...btnAccent,
                textDecoration: "none",
                display: "inline-flex",
                padding: "14px 22px",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {t("landing.ctaTry")}
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes home-hero-glow {
          from { filter: brightness(1); }
          to { filter: brightness(1.08); }
        }
        @keyframes home-stage-float {
          from { transform: rotate(-2deg) translateY(0); opacity: 0.88; }
          to { transform: rotate(-1deg) translateY(-10px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
