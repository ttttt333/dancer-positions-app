import { useState, useCallback, useEffect } from "react";
import {
  buildSingleShareUrlTextFileContent,
  downloadTextFile,
  shareLinksSafeFilenameBase,
} from "../lib/shareProjectLinks";
import { btnAccent, btnSecondary } from "./stageButtonStyles";

type ShareKind = "collab" | "view";

type Props = {
  open: boolean;
  collabUrl: string;
  viewUrl: string;
  hasServerId: boolean;
  /** 保存する .txt に入れる作品名 */
  pieceTitle?: string;
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
  pieceTitle = "無題の作品",
  onClose,
}: Props) {
  const [step, setStep] = useState<"choose" | ShareKind>("choose");
  const [copyOk, setCopyOk] = useState(false);
  const [fileSaveFlash, setFileSaveFlash] = useState<ShareKind | null>(null);

  useEffect(() => {
    if (open) {
      setStep("choose");
      setCopyOk(false);
      setFileSaveFlash(null);
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

  const onSaveSingleTextFile = useCallback(
    (kind: ShareKind) => {
      const url = kind === "collab" ? collabUrl : viewUrl;
      if (!url) return;
      const text = buildSingleShareUrlTextFileContent({
        pieceTitle: pieceTitle.trim() || "無題の作品",
        kind,
        url,
      });
      const base = shareLinksSafeFilenameBase(pieceTitle);
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      const label = kind === "collab" ? "共同編集" : "閲覧";
      downloadTextFile(`ChoreoCore-${label}-${base}-${stamp}.txt`, text);
      setFileSaveFlash(kind);
      setTimeout(() => setFileSaveFlash(null), 2000);
    },
    [collabUrl, viewUrl, pieceTitle]
  );

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

        <div
          style={{
            marginTop: 4,
            paddingTop: 14,
            borderTop: "1px solid #334155",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "#94a3b8",
              lineHeight: 1.55,
            }}
          >
            先生用と生徒用は別々のテキストファイルに保存できます（配布・印刷用のメモ）。
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => onSaveSingleTextFile("collab")}
              style={{
                ...btnSecondary,
                fontWeight: 600,
                padding: "8px 12px",
                fontSize: 12,
                borderColor: "rgba(22, 163, 74, 0.5)",
                color: "#bbf7d0",
                flex: "1 1 200px",
              }}
            >
              {fileSaveFlash === "collab" ? "保存しました" : "共同編集用を .txt に保存"}
            </button>
            <button
              type="button"
              onClick={() => onSaveSingleTextFile("view")}
              style={{
                ...btnSecondary,
                fontWeight: 600,
                padding: "8px 12px",
                fontSize: 12,
                borderColor: "rgba(14, 165, 233, 0.5)",
                color: "#bae6fd",
                flex: "1 1 200px",
              }}
            >
              {fileSaveFlash === "view" ? "保存しました" : "閲覧用を .txt に保存"}
            </button>
          </div>
        </div>
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
        <button
          type="button"
          onClick={() => onSaveSingleTextFile(step)}
          style={{
            ...btnSecondary,
            fontSize: 12,
            borderColor:
              step === "collab"
                ? "rgba(22, 163, 74, 0.5)"
                : "rgba(14, 165, 233, 0.5)",
            color: step === "collab" ? "#bbf7d0" : "#bae6fd",
          }}
        >
          {fileSaveFlash === step ? "保存した" : "この URL を .txt に保存"}
        </button>
      </div>
    </div>
  );
}
