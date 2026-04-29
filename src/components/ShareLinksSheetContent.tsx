import { useState, useCallback } from "react";
import { shell } from "../theme/choreoShell";
import { btnAccent, btnSecondary } from "./stageButtonStyles";

type Props = {
  collabUrl: string;
  viewUrl: string;
  /** 未保存のとき */
  hasServerId: boolean;
  onClose: () => void;
};

/**
 * 共同編集 URL / 生徒用閲覧 URL の表示・コピー（右レール「ファイル共有」から）
 */
export function ShareLinksSheetContent({
  collabUrl,
  viewUrl,
  hasServerId,
  onClose,
}: Props) {
  const [collabOk, setCollabOk] = useState(false);
  const [viewOk, setViewOk] = useState(false);

  const copy = useCallback(async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        window.prompt("コピーする URL", text);
        return true;
      } catch {
        return false;
      }
    }
  }, []);

  if (!hasServerId) {
    return (
      <div style={{ padding: "4px 0" }}>
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#94a3b8", lineHeight: 1.5 }}>
          先に作品を<strong style={{ color: "#e2e8f0" }}>クラウドに保存</strong>
          すると、次の URL をここに表示できます。
        </p>
        <button
          type="button"
          onClick={onClose}
          style={{ ...btnSecondary, fontSize: 13, padding: "6px 14px" }}
        >
          閉じる
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        maxWidth: "100%",
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
        リンクを相手に送ると、同じアカウントにログインした上で使えます（未実装の公開
        URL とは別です）。
      </p>
      <section
        style={{
          padding: 12,
          borderRadius: 10,
          border: `1px solid ${shell.border}`,
          background: "rgba(15,23,42,0.88)",
        }}
      >
        <h4
          style={{
            margin: "0 0 8px",
            fontSize: 13,
            fontWeight: 700,
            color: "#e2e8f0",
          }}
        >
          共同編集
        </h4>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#94a3b8" }}>
          共同編集をオンにして開きます。チーム内で同じ作品を同時に編集できます。
        </p>
        <div
          style={{
            fontSize: 11,
            color: "#cbd5e1",
            wordBreak: "break-all",
            marginBottom: 10,
            padding: "6px 8px",
            borderRadius: 6,
            background: "rgba(2,6,23,0.55)",
            border: "1px solid #334155",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {collabUrl}
        </div>
        <button
          type="button"
          onClick={async () => {
            const ok = await copy(collabUrl);
            if (ok) {
              setCollabOk(true);
              setTimeout(() => setCollabOk(false), 2000);
            }
          }}
          style={btnAccent}
        >
          {collabOk ? "コピーしました" : "共同編集リンクをコピー"}
        </button>
      </section>
      <section
        style={{
          padding: 12,
          borderRadius: 10,
          border: `1px solid ${shell.border}`,
          background: "rgba(15,23,42,0.88)",
        }}
      >
        <h4
          style={{
            margin: "0 0 8px",
            fontSize: 13,
            fontWeight: 700,
            color: "#e2e8f0",
          }}
        >
          生徒用（閲覧・パート表示）
        </h4>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#94a3b8" }}>
          生徒に自分の名前を選んでもらい、ステージ上で自分の立ち位置をハイライト表示します。
        </p>
        <div
          style={{
            fontSize: 11,
            color: "#cbd5e1",
            wordBreak: "break-all",
            marginBottom: 10,
            padding: "6px 8px",
            borderRadius: 6,
            background: "rgba(2,6,23,0.55)",
            border: "1px solid #334155",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {viewUrl}
        </div>
        <button
          type="button"
          onClick={async () => {
            const ok = await copy(viewUrl);
            if (ok) {
              setViewOk(true);
              setTimeout(() => setViewOk(false), 2000);
            }
          }}
          style={btnSecondary}
        >
          {viewOk ? "コピーしました" : "閲覧リンクをコピー"}
        </button>
      </section>
    </div>
  );
}
