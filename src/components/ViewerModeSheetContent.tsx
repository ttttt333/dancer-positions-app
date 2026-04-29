import { useState } from "react";
import {
  type StudentPick,
  ChoreoMemberPickerPanel,
} from "./ChoreoStudentViewGate";
import { btnSecondary } from "./stageButtonStyles";
import {
  downloadFromDataUrl,
  downloadStagePngFile,
  getStageExportElement,
  getStagePngDataUrl,
  sharePngDataUrl,
} from "../lib/captureStagePng";

type Props = {
  variant: "editor" | "public";
  pieceTitle: string;
  entries: import("../lib/viewRoster").ViewRosterEntry[];
  onPick: (p: StudentPick) => void;
  onClearEditorPreview?: () => void;
  canCapture2d: boolean;
};

function pngName(pieceTitle: string) {
  return `${(pieceTitle || "stage").replace(/[^\w\u3000-\u9faf-]+/g, "_")}-stage.png`;
}

export function ViewerModeSheetContent({
  variant,
  pieceTitle,
  entries,
  onPick,
  onClearEditorPreview,
  canCapture2d,
}: Props) {
  const [captureBusy, setCaptureBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onCapture = async (wantShare: boolean) => {
    if (!canCapture2d) {
      setMsg(
        "2D 表示のときに保存できます。ステージ上の [2D] を選んでからお試しください。",
      );
      return;
    }
    if (!getStageExportElement()) {
      setMsg("ステージ枠の準備がまだのようです。少し待ってから再試行してください。");
      return;
    }
    setMsg(null);
    setCaptureBusy(true);
    try {
      if (wantShare) {
        const dataUrl = await getStagePngDataUrl();
        const name = pngName(pieceTitle);
        const ok = await sharePngDataUrl(dataUrl, name);
        if (ok) return;
        downloadFromDataUrl(dataUrl, name);
        setMsg("共有を使えなかったため、ダウンロードで保存しました。");
        return;
      }
      await downloadStagePngFile(pieceTitle || "stage");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "画像の取得に失敗しました。");
    } finally {
      setCaptureBusy(false);
    }
  };

  return (
    <div style={{ padding: "0 0 4px" }}>
      <p
        style={{
          fontSize: 12,
          color: "#94a3b8",
          lineHeight: 1.45,
          margin: "0 0 12px",
          textAlign: "left",
        }}
      >
        メンバーを選ぶと、その人の立ち位置の印が大きく強調され、他のメンバーは控えめに表示されます。タイムラインを
        <strong style={{ color: "#cbd5e1" }}> 再生中も同じ強調</strong>
        になり、曲に合わせた立ち回り（キュー遷移）の確認に使えます。
        動画のピクチャまでは出していませんが、
        波形（タイムライン）の再生位置に合わせ、選択した人の印が分かりやすく付いて動きます。
        {variant === "public" ? "（生徒用閲覧の見え方と同じです。）" : "（生徒用閲覧のプレビューとして利用できます。）"}
      </p>
      {variant === "editor" && onClearEditorPreview ? (
        <div
          style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}
        >
          <button
            type="button"
            onClick={onClearEditorPreview}
            style={{ ...btnSecondary, fontSize: 12, padding: "4px 10px" }}
          >
            個別の強調を解除
          </button>
        </div>
      ) : null}
      <ChoreoMemberPickerPanel
        entries={entries}
        onPick={onPick}
        heading="誰の立ち位置を大きく見るか"
        subheading="名前を選ぶか、全員表示にしてください。閉じたあとステージと再生でご確認ください。"
        compact
      />
      <div
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: "1px solid rgba(100, 116, 139, 0.45)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
          今の立ち位置を送る
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            disabled={captureBusy}
            onClick={() => onCapture(false)}
            style={{
              ...btnSecondary,
              fontSize: 13,
              fontWeight: 600,
              padding: "8px 14px",
            }}
          >
            画像を保存
          </button>
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <button
              type="button"
              disabled={captureBusy}
              onClick={() => onCapture(true)}
              style={{
                ...btnSecondary,
                fontSize: 13,
                fontWeight: 600,
                padding: "8px 14px",
              }}
            >
              共有で送る
            </button>
          ) : null}
        </div>
        {msg ? (
          <p
            style={{ margin: 0, fontSize: 12, color: "#fde68a" }}
            role="status"
          >
            {msg}
          </p>
        ) : null}
      </div>
    </div>
  );
}
