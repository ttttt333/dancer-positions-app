import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { stashPostLoginRedirect } from "../lib/postLoginRedirect";
import { isSupabaseBackend } from "../lib/supabaseClient";
import { supabaseJoinProjectByEditToken } from "../lib/supabaseProjects";
import { shell } from "../theme/choreoShell";

/** 編集用リンク `/join/{token}` を開いたアカウントを共同編集者として登録し、エディタへ進む */
export function JoinCollabPage() {
  const { token = "" } = useParams<{ token: string }>();
  const { ready, me } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!ready || startedRef.current) return;
    if (!me) {
      const back = `/join/${encodeURIComponent(token)}`;
      stashPostLoginRedirect(back);
      navigate("/login", { replace: true, state: { from: back } });
      return;
    }
    if (!isSupabaseBackend()) {
      setError("共同編集リンクはクラウド版でのみ使えます。");
      return;
    }
    startedRef.current = true;
    void supabaseJoinProjectByEditToken(token.trim())
      .then((id) => navigate(`/editor/${id}`, { replace: true }))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "共同編集への参加に失敗しました");
      });
  }, [ready, me, token, navigate]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "#060606",
        color: shell.text,
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center", lineHeight: 1.7 }}>
        {error ? (
          <>
            <p style={{ color: "#f0a8a8", fontSize: 14, margin: "0 0 16px" }}>{error}</p>
            <Link to="/" style={{ color: shell.accent, fontSize: 13 }}>
              ライブラリへ戻る
            </Link>
          </>
        ) : (
          <p style={{ fontSize: 14, color: shell.textMuted, margin: 0 }}>
            共同編集に参加しています…
          </p>
        )}
      </div>
    </div>
  );
}
