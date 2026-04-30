import { useState, useCallback, useEffect } from "react";
import { btnAccent, btnSecondary } from "./stageButtonStyles";

type ShareKind = "collab" | "view";

type Props = {
  open: boolean;
  collabUrl: string;
  viewUrl: string;
  hasServerId: boolean;
  onClose: () => void;
};

/**
 * 共同編集 URL か生徒用閲覧 URL かを選び、表示・コピー。
 */
export function ShareLinksSheetContent({
  open,
  collabUrl,
  viewUrl,
  hasServerId,
  onClose,
}: Props) {
  const [step, setStep] = useState<"choose" | ShareKind>("choose");
  const [copyOk, setCopyOk] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("choose");
      setCopyOk(false);
    }
  }, [open]);

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

  const onCopy = async (kind: ShareKind) => {
    const u = kind === "collab" ? collabUrl : viewUrl;
    const ok = await copy(u);
    if (ok) {
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    }
  };

  if (!hasServerId) {
    return (
      <div style={{ padding: "4px 0" }}>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 14,
            color: "#94a3b8",
            lineHeight: 1.5,
          }}
        >
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

  if (step === "choose") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
          送り先に合わせて種類を選んでください。同じ作品でも URL が異なります。
        </p>
        <button
          type="button"
          onClick={() => setStep("collab")}
          style={{
            ...btnAccent,
            padding: "14px 16px",
            fontSize: 14,
            fontWeight: 700,
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 4,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          振り付けし・チーム用（共同編集）
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "rgba(11, 18, 32, 0.9)",
              lineHeight: 1.4,
            }}
          >
            同じ作品のデータを編集できます。ログインしたメンバーが
            <code style={{ fontSize: 11 }}>?collab=1</code> 付きで開きます。
          </span>
        </button>
        <button
          type="button"
          onClick={() => setStep("view")}
          style={{
            ...btnSecondary,
            padding: "14px 16px",
            fontSize: 14,
            fontWeight: 700,
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 4,
            width: "100%",
            boxSizing: "border-box",
            borderColor: "rgba(14, 165, 233, 0.55)",
            color: "#e0f2fe",
          }}
        >
          生徒用（閲覧だけ）
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#94a3b8",
              lineHeight: 1.4,
            }}
          >
            立ち位置の閲覧・パート表示のみ。名簿から自分を選べます。編集はできません。
          </span>
        </button>
      </div>
    );
  }

  const url = step === "collab" ? collabUrl : viewUrl;
  const title = step === "collab" ? "共同編集用 URL" : "生徒用（閲覧）URL";
  const hint =
    step === "collab"
      ? "この URL をチームに送ります。相手もログインのうえ、編集用リンクとして使います。"
      : "この URL を生徒に送ります。誰のパートを光らせるかだけ選べ、データは変えられません。";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        maxWidth: "100%",
      }}
    >
      <h4
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 700,
          color: "#e2e8f0",
        }}
      >
        {title}
      </h4>
      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{hint}</p>
      <div
        style={{
          fontSize: 11,
          color: "#cbd5e1",
          wordBreak: "break-all",
          padding: "8px 10px",
          borderRadius: 8,
          background: "rgba(2,6,23,0.55)",
          border: "1px solid #334155",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {url}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={() => onCopy(step)}
          style={btnAccent}
        >
          {copyOk ? "コピーしました" : "URL をコピー"}
        </button>
        <button type="button" onClick={() => setStep("choose")} style={btnSecondary}>
          種類を選び直す
        </button>
      </div>
    </div>
  );
}
