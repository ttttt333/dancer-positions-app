import { Link } from "react-router-dom";

type EditorPageStatusProps = {
  loadError: string | null;
  collabSyncing: boolean;
  projectLoaded: boolean;
};

/** 読込失敗・共同編集同期・データ未取得の早期 return 用 */
export function EditorPageStatus({
  loadError,
  collabSyncing,
  projectLoaded,
}: EditorPageStatusProps) {
  if (loadError) {
    return (
      <div style={{ padding: 24, color: "#f87171" }}>
        {loadError}{" "}
        <Link to="/library" style={{ color: "#93c5fd" }}>
          戻る
        </Link>
      </div>
    );
  }

  if (collabSyncing) {
    return (
      <div style={{ padding: 24, color: "#94a3b8" }}>
        共同編集を同期しています…（Yjs）
      </div>
    );
  }

  if (!projectLoaded) {
    return <div style={{ padding: 24, color: "#94a3b8" }}>読み込み中…</div>;
  }

  return null;
}
