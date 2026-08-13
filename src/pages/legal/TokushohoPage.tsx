import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ChoreoCoreLogo } from "../../components/ChoreoCoreLogo";
import { btnAccent, btnSecondary } from "../../components/stageButtonStyles";
import { useI18n } from "../../i18n/I18nContext";
import {
  fetchTokushoho,
  formatTokushohoUpdatedAt,
  saveTokushoho,
  type TokushohoDoc,
} from "../../lib/tokushohoDoc";
import { shell } from "../../theme/choreoShell";

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

export function TokushohoPage() {
  const { me, ready } = useAuth();
  const { t, locale } = useI18n();
  const [doc, setDoc] = useState<TokushohoDoc | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  const email = me?.user?.email ?? null;

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await fetchTokushoho(email);
      setDoc(next);
      setDraft(next.body);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("legal.tokushoho.loadFail"));
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
      const next = await saveTokushoho(draft, email);
      setDoc(next);
      setDraft(next.body);
      setEditing(false);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("legal.tokushoho.saveFail"));
    } finally {
      setSaving(false);
    }
  };

  const canEdit = Boolean(doc?.canEdit);
  const langNote = t("legal.tokushoho.langNote");

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
            <ChoreoCoreLogo height={36} title="ChoreoCore" withWordmark />
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
            {t("legal.tokushoho.home")}
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
          LEGAL
        </p>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 26,
            fontWeight: 750,
            letterSpacing: "-0.02em",
          }}
        >
          {t("legal.tokushoho.title")}
        </h1>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: shell.textMuted }}>
          {t("legal.tokushoho.lead")}
          {doc?.updatedAt
            ? ` ${t("legal.tokushoho.updated", {
                at: formatTokushohoUpdatedAt(doc.updatedAt),
              })}`
            : null}
          {doc?.source === "local"
            ? ` ${t("legal.tokushoho.sourceLocal")}`
            : doc?.source === "default"
              ? ` ${t("legal.tokushoho.sourceDefault")}`
              : null}
        </p>
        {locale !== "ja" && langNote ? (
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 12,
              lineHeight: 1.5,
              color: shell.textSubtle,
            }}
          >
            {langNote}
          </p>
        ) : null}

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
            {t("legal.tokushoho.saved")}
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
                setDraft(doc?.body ?? "");
                setEditing(true);
              }}
            >
              {t("legal.tokushoho.edit")}
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
                {saving ? t("legal.tokushoho.saving") : t("legal.tokushoho.save")}
              </button>
              <button
                type="button"
                style={{ ...btnSecondary, padding: "8px 14px", fontSize: 13 }}
                disabled={saving}
                onClick={() => {
                  setDraft(doc?.body ?? "");
                  setEditing(false);
                  setError("");
                }}
              >
                {t("legal.tokushoho.cancel")}
              </button>
            </>
          ) : null}
          <button
            type="button"
            style={{ ...btnSecondary, padding: "8px 14px", fontSize: 13 }}
            disabled={loading || saving}
            onClick={() => void reload()}
          >
            {t("legal.tokushoho.reload")}
          </button>
        </div>

        {loading && !doc ? (
          <p style={{ color: shell.textMuted, fontSize: 13 }}>
            {t("legal.tokushoho.loading")}
          </p>
        ) : editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            aria-label={t("legal.tokushoho.title")}
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
            {doc?.body?.trim() ? doc.body : t("legal.tokushoho.empty")}
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
            {t("legal.tokushoho.adminHint")}
            {doc?.source !== "supabase"
              ? t("legal.tokushoho.adminHintLocal")
              : null}
          </p>
        ) : null}
      </main>
    </div>
  );
}
