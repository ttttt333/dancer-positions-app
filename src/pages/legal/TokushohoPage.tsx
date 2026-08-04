import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ChoreoCoreLogo } from "../../components/ChoreoCoreLogo";
import { btnAccent, btnSecondary } from "../../components/stageButtonStyles";
import { SERVICE_NAME } from "../../lib/commercialDisclosure";
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
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [email]);

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
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const canEdit = Boolean(doc?.canEdit);

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
            ホーム
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
          特定商取引法に基づく表記
        </h1>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: shell.textMuted }}>
          {SERVICE_NAME} の通信販売に関する表記です。
          {doc?.updatedAt
            ? ` 最終更新: ${formatTokushohoUpdatedAt(doc.updatedAt)}`
            : null}
          {doc?.source === "local"
            ? "（この端末に保存）"
            : doc?.source === "default"
              ? "（初期文面）"
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
            更新しました
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
              編集する
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
                {saving ? "更新中…" : "更新する"}
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
                キャンセル
              </button>
            </>
          ) : null}
          <button
            type="button"
            style={{ ...btnSecondary, padding: "8px 14px", fontSize: 13 }}
            disabled={loading || saving}
            onClick={() => void reload()}
          >
            再読み込み
          </button>
        </div>

        {loading && !doc ? (
          <p style={{ color: shell.textMuted, fontSize: 13 }}>読み込み中…</p>
        ) : editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            aria-label="特定商取引法に基づく表記本文"
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
            {doc?.body?.trim() ? doc.body : "（まだ表記がありません）"}
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
            管理人モード: このページ上で文章を直接書き換えて「更新する」で公開できます。
            {doc?.source !== "supabase"
              ? " クラウド未接続・未設定のときはこの端末に保存されます（Supabase の 014_tokushoho_doc と管理者メール登録後は全員に共有されます）。"
              : null}
          </p>
        ) : null}
      </main>
    </div>
  );
}
