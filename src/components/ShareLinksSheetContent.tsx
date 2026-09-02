import { useState, useCallback, useEffect, type CSSProperties, type ReactNode } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { useI18n } from "../i18n/I18nContext";
import {
  buildCueSheetCsv,
  buildSingleShareUrlTextFileContent,
  copyTextToClipboard,
  downloadCueSheetCsv,
  downloadTextFile,
  shareLinksSafeFilenameBase,
} from "../lib/shareProjectLinks";
import { exportChoreographyPdf } from "../lib/exportChoreographyPdf";
import { downloadStagePngFile, getStageExportElement } from "../lib/captureStagePng";
import { btnAccent, btnSecondary } from "./stageButtonStyles";

type ShareKind = "collab" | "view";
type FlashKey = ShareKind | "pdf" | "csv" | "png";

type Props = {
  open: boolean;
  collabUrl: string;
  viewUrl: string;
  hasServerId: boolean;
  pieceTitle?: string;
  project: ChoreographyProjectJson | null;
  projectName?: string;
  canCapture2d: boolean;
  onClose: () => void;
};

const urlBoxStyle: CSSProperties = {
  fontSize: 11,
  color: "#cbd5e1",
  wordBreak: "break-all",
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(2,6,23,0.55)",
  border: "1px solid #334155",
  fontFamily: "ui-monospace, monospace",
  lineHeight: 1.45,
};

function ShareSection({
  n,
  title,
  desc,
  accent,
  children,
}: {
  n: number;
  title: string;
  desc: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        border: `1px solid ${accent}`,
        borderRadius: 12,
        padding: "12px 14px 14px",
        background: "rgba(2,6,23,0.35)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: accent,
            color: "#0b1220",
            fontSize: 12,
            fontWeight: 800,
            display: "grid",
            placeItems: "center",
            marginTop: 1,
          }}
        >
          {n}
        </span>
        <div>
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
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "#94a3b8",
              lineHeight: 1.5,
            }}
          >
            {desc}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function fileStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 共同編集 URL・生徒用閲覧 URL・キュー PDF・添付しやすいファイルを
 * 右側シートでまとめて扱う。
 */
export function ShareLinksSheetContent({
  open,
  collabUrl,
  viewUrl,
  hasServerId,
  pieceTitle = "",
  project,
  projectName = "",
  canCapture2d,
  onClose,
}: Props) {
  const { t } = useI18n();
  const [copyKind, setCopyKind] = useState<ShareKind | null>(null);
  const [flash, setFlash] = useState<FlashKey | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pngBusy, setPngBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pngError, setPngError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCopyKind(null);
      setFlash(null);
      setPdfBusy(false);
      setPngBusy(false);
      setPdfError(null);
      setPngError(null);
    }
  }, [open]);

  const untitled = t("pdf.untitled");
  const title = pieceTitle.trim() || projectName.trim() || untitled;
  const fileBase = shareLinksSafeFilenameBase(title);
  const cueCount = project?.cues?.length ?? 0;

  const pulseFlash = useCallback((key: FlashKey) => {
    setFlash(key);
    window.setTimeout(() => setFlash((cur) => (cur === key ? null : cur)), 2000);
  }, []);

  const onCopy = async (kind: ShareKind) => {
    const u = kind === "collab" ? collabUrl : viewUrl;
    const ok = await copyTextToClipboard(u);
    if (ok) {
      setCopyKind(kind);
      window.setTimeout(() => setCopyKind((cur) => (cur === kind ? null : cur)), 2000);
    }
  };

  const onSaveSingleTextFile = useCallback(
    (kind: ShareKind) => {
      const url = kind === "collab" ? collabUrl : viewUrl;
      if (!url) return;
      const text = buildSingleShareUrlTextFileContent({
        pieceTitle: title,
        kind,
        url,
      });
      const label = kind === "collab" ? "共同編集" : "閲覧";
      downloadTextFile(`ChoreoCore-${label}-${fileBase}-${fileStamp()}.txt`, text);
      pulseFlash(kind);
    },
    [collabUrl, viewUrl, title, fileBase, pulseFlash]
  );

  const onExportPdf = async () => {
    if (!project || pdfBusy) return;
    setPdfError(null);
    setPdfBusy(true);
    try {
      await exportChoreographyPdf({
        project,
        projectName: title,
        labels: {
          playbackTime: t("pdf.playbackTime"),
          untitled,
          cueN: (n) => t("pdf.cueN", { n }),
          formationN: (n) => t("pdf.formationN", { n }),
          formationFallback: t("pdf.formation"),
          backstage: t("pdf.backstage"),
          side: t("pdf.side"),
          audience: t("pdf.audience"),
          emptyError: t("pdf.emptyError"),
        },
      });
      pulseFlash("pdf");
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : t("home.sheet.exportPdfFail"));
    } finally {
      setPdfBusy(false);
    }
  };

  const onExportCsv = () => {
    if (!project || cueCount === 0) return;
    const csv = buildCueSheetCsv(project, {
      cueFallback: (n) => t("pdf.cueN", { n }),
    });
    downloadCueSheetCsv(`ChoreoCore-cues-${fileBase}-${fileStamp()}.csv`, csv);
    pulseFlash("csv");
  };

  const onExportPng = async () => {
    if (pngBusy) return;
    setPngError(null);
    if (!canCapture2d) {
      setPngError(t("shareSheet.pngNeed2d"));
      return;
    }
    if (!getStageExportElement()) {
      setPngError(t("shareSheet.pngFail"));
      return;
    }
    setPngBusy(true);
    try {
      await downloadStagePngFile(title);
      pulseFlash("png");
    } catch (e) {
      setPngError(e instanceof Error ? e.message : t("shareSheet.pngFail"));
    } finally {
      setPngBusy(false);
    }
  };

  const renderUrlActions = (kind: ShareKind) => {
    if (!hasServerId) {
      return (
        <p style={{ margin: 0, fontSize: 12, color: "#fbbf24", lineHeight: 1.5 }}>
          {t("shareSheet.needCloud")}
        </p>
      );
    }
    const url = kind === "collab" ? collabUrl : viewUrl;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={urlBoxStyle}>{url || t("shareSheet.urlPlaceholder")}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            onClick={() => onCopy(kind)}
            disabled={!url}
            style={{ ...btnAccent, fontSize: 12, padding: "7px 12px" }}
          >
            {copyKind === kind ? t("shareSheet.copied") : t("shareSheet.copyUrl")}
          </button>
          <button
            type="button"
            onClick={() => onSaveSingleTextFile(kind)}
            disabled={!url}
            style={{
              ...btnSecondary,
              fontSize: 12,
              padding: "7px 12px",
              borderColor:
                kind === "collab"
                  ? "rgba(22, 163, 74, 0.5)"
                  : "rgba(14, 165, 233, 0.5)",
              color: kind === "collab" ? "#bbf7d0" : "#bae6fd",
            }}
          >
            {flash === kind ? t("shareSheet.saved") : t("shareSheet.saveTxt")}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        paddingTop: 8,
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.55 }}>
        {t("shareSheet.lead")}
      </p>

      <ShareSection
        n={1}
        title={t("shareSheet.collabTitle")}
        desc={t("shareSheet.collabDesc")}
        accent="rgba(212, 175, 55, 0.7)"
      >
        {renderUrlActions("collab")}
      </ShareSection>

      <ShareSection
        n={2}
        title={t("shareSheet.studentTitle")}
        desc={t("shareSheet.studentDesc")}
        accent="rgba(56, 189, 248, 0.65)"
      >
        {renderUrlActions("view")}
      </ShareSection>

      <ShareSection
        n={3}
        title={t("shareSheet.pdfTitle")}
        desc={t("shareSheet.pdfDesc")}
        accent="rgba(251, 191, 36, 0.55)"
      >
        <button
          type="button"
          onClick={() => void onExportPdf()}
          disabled={!project || pdfBusy}
          style={{
            ...btnAccent,
            fontSize: 13,
            padding: "9px 14px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {pdfBusy
            ? t("shareSheet.pdfBusy")
            : flash === "pdf"
              ? t("shareSheet.pdfDone")
              : t("shareSheet.pdfButton")}
        </button>
        {pdfError ? (
          <p style={{ margin: 0, fontSize: 12, color: "#fca5a5", lineHeight: 1.45 }}>
            {pdfError}
          </p>
        ) : null}
      </ShareSection>

      <ShareSection
        n={4}
        title={t("shareSheet.filesTitle")}
        desc={t("shareSheet.filesDesc")}
        accent="rgba(148, 163, 184, 0.4)"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
            {t("shareSheet.csvDesc")}
          </p>
          <button
            type="button"
            onClick={onExportCsv}
            disabled={!project || cueCount === 0}
            style={{
              ...btnSecondary,
              fontSize: 12,
              padding: "8px 12px",
              borderColor: "rgba(74, 222, 128, 0.45)",
              color: "#bbf7d0",
            }}
          >
            {flash === "csv" ? t("shareSheet.csvDone") : t("shareSheet.csvButton")}
          </button>
          {cueCount === 0 ? (
            <p style={{ margin: 0, fontSize: 11, color: "#78716c", lineHeight: 1.45 }}>
              {t("shareSheet.csvNeedCues")}
            </p>
          ) : null}

          <p
            style={{
              margin: "6px 0 0",
              fontSize: 11,
              color: "#94a3b8",
              lineHeight: 1.45,
            }}
          >
            {t("shareSheet.pngDesc")}
          </p>
          <button
            type="button"
            onClick={() => void onExportPng()}
            disabled={pngBusy}
            style={{
              ...btnSecondary,
              fontSize: 12,
              padding: "8px 12px",
              borderColor: "rgba(14, 165, 233, 0.45)",
              color: "#bae6fd",
            }}
          >
            {pngBusy
              ? t("shareSheet.pngBusy")
              : flash === "png"
                ? t("shareSheet.pngDone")
                : t("shareSheet.pngButton")}
          </button>
          {pngError ? (
            <p style={{ margin: 0, fontSize: 12, color: "#fca5a5", lineHeight: 1.45 }}>
              {pngError}
            </p>
          ) : !canCapture2d ? (
            <p style={{ margin: 0, fontSize: 11, color: "#78716c", lineHeight: 1.45 }}>
              {t("shareSheet.pngNeed2d")}
            </p>
          ) : null}
        </div>
      </ShareSection>

      <button
        type="button"
        onClick={onClose}
        style={{ ...btnSecondary, fontSize: 13, padding: "6px 14px", alignSelf: "flex-start" }}
      >
        {t("editor.layout.close")}
      </button>
    </div>
  );
}
