import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChoreoCoreLogo } from "../components/ChoreoGridLogo";
import { btnAccent, btnSecondary } from "../components/stageButtonStyles";
import { useI18n } from "../i18n/I18nContext";
import { shell } from "../theme/choreoShell";
import {
  fetchUpdateLog,
  formatUpdateLogUpdatedAt,
  pickUpdateLogBody,
  saveUpdateLog,
  updateLogSourceDraft,
  type UpdateLogDoc,
} from "../lib/updateLog";
import {
  translateUpdateLogBodies,
  updateLogHasOtherLocales,
} from "../lib/translateUpdateLog";

const pageWrap: CSSProperties = {
  minHeight: "100dvh",
  background: `radial-gradient(1200px 600px at 10% -10%, ${shell.brandGlow}, transparent 55%), ${shell.bgDeep}`,
  color: shell.text,
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const card: CSSProperties = {
  maxWidth: 820,
  margin: "0 auto",
  padding: "20px 18px 40px",
};

export function UpdateLogPage() {
  const { me, ready } = useAuth();
  const { t, locale } = useI18n();
  const [doc, setDoc] = useState<UpdateLogDoc | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState<"full" | "partial" | false>(
    false
  );

  const email = me?.user?.email ?? null;

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await fetchUpdateLog(email);
      setDoc(next);
      setDraft(updateLogSourceDraft(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("updateLog.loadFail"));
    } finally {
      setLoading(false);
    }
  }, [email, t]);

  useEffect(() => {
    if (!ready) return;
    void reload();
  }, [ready, reload]);

  const onSave = async () => {
    setSaving(true);
    setError("");
    setSavedFlash(false);
    try {
      let bodies = { ja: draft };
      let translatedOk = false;
      try {
        bodies = await translateUpdateLogBodies(draft);
        translatedOk = updateLogHasOtherLocales(bodies);
      } catch {
        bodies = { ja: draft };
      }
      const next = await saveUpdateLog(draft, email, bodies);
      setDoc(next);
      setDraft(updateLogSourceDraft(next));
      setEditing(false);
      setSavedFlash(translatedOk ? "full" : "partial");
      window.setTimeout(() => setSavedFlash(false), 2800);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("updateLog.saveFail"));
    } finally {
      setSaving(false);
    }
  };

  const canEdit = Boolean(doc?.canEdit);
  const displayBody = doc ? pickUpdateLogBody(doc, locale) : "";
  const updatedLabel = doc?.updatedAt
    ? t("updateLog.updated", {
        at: formatUpdateLogUpdatedAt(doc.updatedAt, locale),
      })
    : "";

  return (
    <div style={pageWrap}>
      <header
        style={{
          borderBottom: `1px solid ${shell.border}`,
          background: shell.bgChrome,
          padding:
            "max(10px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) 10px max(16px, env(safe-area-inset-left, 0px))",
        }}
      >
        <div
          style={{
            maxWidth: 820,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
              color: shell.text,
            }}
          >
            <ChoreoCoreLogo height={36} title="ChoreoCore" />
          </Link>
          <div style={{ flex: 1, minWidth: 8 }} />
          <Link
            to="/"
            style={{
              ...btnSecondary,
              padding: "6px 12px",
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            {t("updateLog.home")}
          </Link>
        </div>
      </header>

      <main style={card}>
        <p
          style={{
            margin: "8px 0 4px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: shell.accent,
          }}
        >
          {t("updateLog.kicker")}
        </p>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 26,
            fontWeight: 750,
            letterSpacing: "-0.02em",
          }}
        >
          {t("updateLog.title")}
        </h1>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: shell.textMuted }}>
          {t("updateLog.lead")}
          {updatedLabel ? ` ${updatedLabel}` : null}
          {doc?.source === "local"
            ? t("updateLog.sourceLocal")
            : doc?.source === "default"
              ? t("updateLog.sourceDefault")
              : null}
        </p>

        {error ? (
          <p
            style={{
              margin: "0 0 12px",
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(196,30,58,0.12)",
              border: "1px solid rgba(196,30,58,0.35)",
              color: "#fecaca",
              fontSize: 13,
            }}
          >
            {error}
          </p>
        ) : null}
        {savedFlash ? (
          <p
            style={{
              margin: "0 0 12px",
              padding: "10px 12px",
              borderRadius: 8,
              background: shell.accentSoft,
              border: `1px solid ${shell.borderStrong}`,
              color: "#fef3c7",
              fontSize: 13,
            }}
          >
            {savedFlash === "full"
              ? t("updateLog.saved")
              : t("updateLog.savedPartial")}
          </p>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {canEdit && !editing ? (
            <button
              type="button"
              style={{ ...btnAccent, padding: "8px 14px", fontSize: 13 }}
              onClick={() => {
                setDraft(updateLogSourceDraft(doc));
                setEditing(true);
              }}
            >
              {t("updateLog.edit")}
            </button>
          ) : null}
          {canEdit && editing ? (
            <>
              <button
                type="button"
                style={{ ...btnAccent, padding: "8px 14px", fontSize: 13 }}
                disabled={saving}
                onClick={() => void onSave()}
              >
                {saving ? t("updateLog.translating") : t("updateLog.save")}
              </button>
              <button
                type="button"
                style={{ ...btnSecondary, padding: "8px 14px", fontSize: 13 }}
                disabled={saving}
                onClick={() => {
                  setDraft(updateLogSourceDraft(doc));
                  setEditing(false);
                  setError("");
                }}
              >
                {t("updateLog.cancel")}
              </button>
            </>
          ) : null}
          <button
            type="button"
            style={{ ...btnSecondary, padding: "8px 14px", fontSize: 13 }}
            disabled={loading || saving}
            onClick={() => void reload()}
          >
            {t("updateLog.reload")}
          </button>
        </div>

        {loading && !doc ? (
          <p style={{ color: shell.textMuted, fontSize: 13 }}>
            {t("updateLog.loading")}
          </p>
        ) : editing ? (
          <>
            <p
              style={{
                margin: "0 0 8px",
                fontSize: 12,
                color: shell.textMuted,
              }}
            >
              {t("updateLog.editSourceLabel")}
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              aria-label={t("updateLog.bodyAria")}
              style={{
                width: "100%",
                minHeight: "min(70vh, 640px)",
                boxSizing: "border-box",
                resize: "vertical",
                padding: "16px 16px",
                borderRadius: 12,
                border: `1px solid ${shell.borderStrong}`,
                background: shell.surface,
                color: shell.text,
                fontSize: 14,
                lineHeight: 1.65,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
            />
          </>
        ) : (
          <article
            style={{
              padding: "18px 18px",
              borderRadius: 12,
              border: `1px solid ${shell.border}`,
              background: shell.surface,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 14,
              lineHeight: 1.7,
              color: shell.text,
            }}
          >
            {displayBody.trim() ? displayBody : t("updateLog.empty")}
          </article>
        )}

        {canEdit ? (
          <p
            style={{
              marginTop: 16,
              fontSize: 12,
              color: shell.textSubtle,
              lineHeight: 1.5,
            }}
          >
            {t("updateLog.adminHint")} {t("updateLog.adminTranslateHint")}
            {doc?.source !== "supabase" ? t("updateLog.adminHintLocal") : null}
          </p>
        ) : null}
      </main>
    </div>
  );
}
