import { useCallback, useState } from "react";
import { toCanvas, toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import type { ChoreographyProjectJson } from "../types/choreography";
import { sortCuesByStart } from "../lib/cueInterval";
import { playCompletionWoof } from "../lib/playCompletionWoof";
import { btnSecondary } from "./stageButtonStyles";

const STAGE_ROOT_ID = "stage-export-root";

type Props = {
  open: boolean;
  onClose: () => void;
  project: ChoreographyProjectJson;
  projectName: string;
  /** 2D ステージが DOM にあるときのみ画像・簡易動画出力 */
  stage2dVisible: boolean;
};

function safeBaseName(name: string) {
  return name.replace(/[^\w\u3000-\u30ff\u4e00-\u9faf-]+/g, "_").slice(0, 80) || "choreogrid";
}

async function exportJson(project: ChoreographyProjectJson, base: string) {
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${base}.choreogrid.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function exportPng(base: string) {
  const el = document.getElementById(STAGE_ROOT_ID);
  if (!el) throw new Error("ステージ要素が見つかりません");
  const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${base}-stage.png`;
  a.click();
}

function escMemoHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildMemoPdfDom(project: ChoreographyProjectJson): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "box-sizing:border-box;width:720px;padding:28px 32px;background:#ffffff;color:#0f172a;font:14px/1.55 system-ui,-apple-system,sans-serif;";
  const title = document.createElement("h1");
  title.style.cssText = "margin:0 0 20px;font-size:20px;font-weight:700;";
  title.textContent = `${project.pieceTitle || "（無題）"} — メモ（§11）`;
  wrap.appendChild(title);
  const parts: string[] = [];
  for (const f of project.formations) {
    if (f.note?.trim()) {
      parts.push(
        `<p style="margin:12px 0 6px"><strong>${escMemoHtml(f.name)}</strong>（フォーメーション）</p><p style="margin:0 0 8px;white-space:pre-wrap">${escMemoHtml(f.note)}</p>`
      );
    }
    for (const d of f.dancers) {
      const h =
        typeof d.heightCm === "number" && Number.isFinite(d.heightCm)
          ? ` · 身長 ${d.heightCm} cm`
          : "";
      if (d.note?.trim() || h) {
        parts.push(
          `<p style="margin:6px 0 6px 12px;font-size:13px"><strong>${escMemoHtml(f.name)} / ${escMemoHtml(d.label)}</strong>${escMemoHtml(h)}<br/>${
            d.note?.trim()
              ? `<span style="white-space:pre-wrap">${escMemoHtml(d.note)}</span>`
              : ""
          }</p>`
        );
      }
    }
  }
  for (const c of sortCuesByStart(project.cues)) {
    if (c.note?.trim()) {
      const fn =
        project.formations.find((x) => x.id === c.formationId)?.name ?? "";
      parts.push(
        `<p style="margin:10px 0 6px;font-size:13px"><strong>キュー ${escMemoHtml(c.name ?? "（無名）")}</strong> · ${escMemoHtml(fn)}</p><p style="margin:0 0 8px 12px;white-space:pre-wrap">${escMemoHtml(c.note)}</p>`
      );
    }
  }
  const inner = document.createElement("div");
  inner.innerHTML =
    parts.length > 0
      ? parts.join("")
      : "<p style='color:#64748b;margin:0'>（メモはありません）</p>";
  wrap.appendChild(inner);
  return wrap;
}

async function exportPdf(
  base: string,
  project: ChoreographyProjectJson,
  includeMemoPage: boolean
) {
  const el = document.getElementById(STAGE_ROOT_ID);
  if (!el) throw new Error("ステージ要素が見つかりません");
  const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true });
  const canvas = await toCanvas(el, { pixelRatio: 2, cacheBust: true });
  const wPx = canvas.width;
  const hPx = canvas.height;
  const orientation = wPx >= hPx ? "landscape" : "portrait";
  const doc = new jsPDF({
    orientation,
    unit: "px",
    format: [wPx, hPx],
    hotfixes: ["px_scaling"],
  });
  doc.addImage(dataUrl, "PNG", 0, 0, wPx, hPx, undefined, "FAST");
  if (includeMemoPage) {
    const memoRoot = buildMemoPdfDom(project);
    document.body.appendChild(memoRoot);
    try {
      const memoCanvas = await toCanvas(memoRoot, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });
      const mw = memoCanvas.width;
      const mh = memoCanvas.height;
      doc.addPage([mw, mh]);
      doc.addImage(
        memoCanvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        mw,
        mh,
        undefined,
        "FAST"
      );
    } finally {
      document.body.removeChild(memoRoot);
    }
  }
  doc.save(`${base}-stage.pdf`);
}

const MIN_WEBM_SEC = 2;
const MAX_WEBM_SEC = 8;

async function exportWebmStatic(base: string) {
  const el = document.getElementById(STAGE_ROOT_ID);
  if (!el) throw new Error("ステージ要素が見つかりません");
  const canvas = await toCanvas(el, { pixelRatio: 2, cacheBust: true });
  const stream = canvas.captureStream(12);
  const mime =
    MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";
  if (!mime) throw new Error("このブラウザでは WebM 録画に対応していません");
  const rec = new MediaRecorder(stream, { mimeType: mime });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve, reject) => {
    rec.onerror = () => reject(new Error("録画に失敗しました"));
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      resolve(blob);
    };
  });
  rec.start(200);
  const sec = Math.min(MAX_WEBM_SEC, Math.max(MIN_WEBM_SEC, 3));
  await new Promise((r) => setTimeout(r, sec * 1000));
  rec.stop();
  const blob = await done;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${base}-stage.webm`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * 仕様 §1・§12: PNG / PDF / 動画(WebM) / プロジェクト JSON の書き出し。
 */
export function ExportDialog({
  open,
  onClose,
  project,
  projectName,
  stage2dVisible,
}: Props) {
  const [wantJson, setWantJson] = useState(true);
  const [wantPng, setWantPng] = useState(true);
  const [wantPdf, setWantPdf] = useState(false);
  const [wantVideo, setWantVideo] = useState(false);
  /** §11 PDF の 2 ページ目にフォーメーション・ダンサー・キューのメモを載せる */
  const [pdfIncludeMemos, setPdfIncludeMemos] = useState(true);
  const [busy, setBusy] = useState(false);

  const runExport = useCallback(async () => {
    const base = safeBaseName(projectName.trim() || "無題の作品");
    setBusy(true);
    try {
      if (wantJson) await exportJson(project, base);
      if (wantPng || wantPdf || wantVideo) {
        if (!stage2dVisible) {
          throw new Error("PNG・PDF・動画は 2D ステージ表示中のみ書き出せます");
        }
        if (wantPng) await exportPng(base);
        if (wantPdf) await exportPdf(base, project, pdfIncludeMemos);
        if (wantVideo) await exportWebmStatic(base);
      }
      playCompletionWoof();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "書き出しに失敗しました");
    } finally {
      setBusy(false);
    }
  }, [
    project,
    projectName,
    wantJson,
    wantPng,
    wantPdf,
    wantVideo,
    pdfIncludeMemos,
    stage2dVisible,
    onClose,
  ]);

  if (!open) return null;

  const chkRow = (
    id: string,
    label: string,
    checked: boolean,
    onChange: (v: boolean) => void,
    disabled?: boolean
  ) => (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? "#64748b" : "#e2e8f0",
        fontSize: "13px",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(15, 23, 42, 0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "#0f172a",
          borderRadius: "12px",
          border: "1px solid #334155",
          padding: "18px 20px 20px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "14px",
          }}
        >
          <h3
            id="export-dialog-title"
            style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#f8fafc" }}
          >
            書き出し（§1）
          </h3>
          <button
            type="button"
            disabled={busy}
            aria-label="閉じる"
            onClick={onClose}
            style={{ ...btnSecondary, fontSize: "18px", lineHeight: 1, padding: "4px 12px" }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>
          形式を選んで実行します。PNG・PDF・動画は現在の 2D ステージ（
          <code style={{ color: "#cbd5e1" }}>#{STAGE_ROOT_ID}</code>
          ）の見た目を出力します。動画は静止画を数秒録画した簡易 WebM です。
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
          {chkRow("ex-json", "プロジェクト JSON（再編集用）", wantJson, setWantJson)}
          {chkRow(
            "ex-png",
            "PNG（ステージ画像）",
            wantPng,
            setWantPng,
            !stage2dVisible
          )}
          {chkRow(
            "ex-pdf",
            "PDF（1ページにステージ画像）",
            wantPdf,
            setWantPdf,
            !stage2dVisible
          )}
          {chkRow(
            "ex-pdf-memo",
            "PDF にメモページを追加（§11・フォーメ／ダンサー／キュー）",
            pdfIncludeMemos,
            setPdfIncludeMemos,
            !stage2dVisible || !wantPdf
          )}
          {chkRow(
            "ex-webm",
            "動画 WebM（簡易・数秒）",
            wantVideo,
            setWantVideo,
            !stage2dVisible
          )}
        </div>
        {!stage2dVisible ? (
          <p style={{ margin: "0 0 12px", fontSize: "11px", color: "#fbbf24" }}>
            画像・PDF・動画はエディタで 2D ステージを表示してください。
          </p>
        ) : null}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button type="button" disabled={busy} style={btnSecondary} onClick={onClose}>
            キャンセル
          </button>
          <button
            type="button"
            disabled={busy || (!wantJson && !wantPng && !wantPdf && !wantVideo)}
            style={{
              ...btnSecondary,
              borderColor: "#6366f1",
              color: "#c7d2fe",
              fontWeight: 600,
              opacity: busy ? 0.6 : 1,
            }}
            onClick={() => void runExport()}
          >
            {busy ? "処理中…" : "書き出す"}
          </button>
        </div>
      </div>
    </div>
  );
}
