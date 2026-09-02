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
import { shell } from "../theme/choreoShell";

type ShareKind = "collab" | "view";
type FlashKey = ShareKind | "pdf" | "csv" | "png";
type BtnVariant = "gold" | "ghost";

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

const GOLD = shell.accent;
const INK = "#0c0a06";

function fileStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function IconLink() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10.5 13.5 8.6 15.4a3.2 3.2 0 0 1-4.5-4.5l2.4-2.4a3.2 3.2 0 0 1 4.5 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="m13.5 10.5 1.9-1.9a3.2 3.2 0 0 1 4.5 4.5l-2.4 2.4a3.2 3.2 0 0 1-4.5 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.8 12s3.4-6.2 9.2-6.2S21.2 12 21.2 12s-3.4 6.2-9.2 6.2S2.8 12 2.8 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconPdf() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3.5h7.2L19 8.2V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M14 3.6V8h4.4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.6 14.2h6.8M8.6 17.2h4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconFiles() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="7" y="6.5" width="12" height="13" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 16.5V6.2A1.7 1.7 0 0 1 6.7 4.5H15" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ActionBtn({
  variant,
  children,
  onClick,
  disabled,
  fill,
}: {
  variant: BtnVariant;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  fill?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const gold: CSSProperties =
    variant === "gold"
      ? {
          background: hover
            ? "linear-gradient(180deg, #f8ecc0 0%, #e0c15a 45%, #b8892c 100%)"
            : "linear-gradient(180deg, #f3e5a8 0%, #d4af37 42%, #a67c2d 100%)",
          color: INK,
          border: "1px solid rgba(243, 229, 168, 0.55)",
          boxShadow: hover
            ? "0 6px 22px rgba(212, 175, 55, 0.38), inset 0 1px 0 rgba(255,255,255,0.45)"
            : "0 2px 16px rgba(212, 175, 55, 0.28), inset 0 1px 0 rgba(255,255,255,0.32)",
        }
      : {
          background: hover ? "rgba(212, 175, 55, 0.1)" : "rgba(255,255,255,0.03)",
          color: shell.text,
          border: `1px solid ${hover ? "rgba(212, 175, 55, 0.4)" : shell.borderStrong}`,
          boxShadow: "none",
        };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...gold,
        fontSize: 12,
            fontWeight: 600,
        letterSpacing: "0.02em",
        padding: "8px 14px",
        borderRadius: 999,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.42 : 1,
        width: fill ? "100%" : undefined,
        boxSizing: "border-box",
        transition: "background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
      }}
    >
      {children}
    </button>
  );
}

function ShareCard({
  index,
  icon,
  title,
  desc,
  children,
}: {
  index: string;
  icon: ReactNode;
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        position: "relative",
        borderRadius: 16,
        padding: "14px 14px 15px",
        background:
          "linear-gradient(180deg, rgba(28, 24, 18, 0.92) 0%, rgba(14, 12, 10, 0.88) 100%)",
        border: `1px solid ${shell.borderStrong}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 28px rgba(0,0,0,0.22)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 12,
          bottom: 12,
          width: 2,
          borderRadius: 2,
          background: `linear-gradient(180deg, ${GOLD}, rgba(212,175,55,0.15))`,
        }}
      />
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingLeft: 8 }}>
        <div
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            color: GOLD,
            background: "rgba(212, 175, 55, 0.1)",
            border: "1px solid rgba(212, 175, 55, 0.28)",
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 3,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: GOLD,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {index}
            </span>
            <h4
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 700,
                color: shell.text,
                letterSpacing: "0.01em",
                lineHeight: 1.3,
              }}
            >
              {title}
            </h4>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: shell.textMuted,
              lineHeight: 1.55,
            }}
          >
            {desc}
          </p>
        </div>
      </div>
      <div style={{ paddingLeft: 8 }}>{children}</div>
    </section>
  );
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
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(212, 175, 55, 0.08)",
            border: "1px solid rgba(212, 175, 55, 0.22)",
            color: "#e8d48a",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {t("shareSheet.needCloud")}
        </div>
      );
    }
    const url = kind === "collab" ? collabUrl : viewUrl;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            fontSize: 11,
            color: "#d6d3d1",
            wordBreak: "break-all",
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(0,0,0,0.38)",
            border: "1px solid rgba(212, 175, 55, 0.14)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            lineHeight: 1.5,
            letterSpacing: "-0.01em",
          }}
        >
          {url || t("shareSheet.urlPlaceholder")}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <ActionBtn variant="gold" onClick={() => void onCopy(kind)} disabled={!url}>
            {copyKind === kind ? t("shareSheet.copied") : t("shareSheet.copyUrl")}
          </ActionBtn>
          <ActionBtn
            variant="ghost"
            onClick={() => onSaveSingleTextFile(kind)}
            disabled={!url}
          >
            {flash === kind ? t("shareSheet.saved") : t("shareSheet.saveTxt")}
          </ActionBtn>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        background:
          "radial-gradient(120% 60% at 100% -10%, rgba(212,175,55,0.16), transparent 55%), linear-gradient(180deg, #14110d 0%, #0a0908 38%, #060606 100%)",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          padding: "18px 18px 14px",
          background:
            "linear-gradient(180deg, rgba(20,17,13,0.96) 0%, rgba(20,17,13,0.82) 70%, rgba(20,17,13,0))",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.22em",
                color: GOLD,
                marginBottom: 6,
              }}
            >
              SHARE
            </div>
            <h3
              id="share-links-panel-title"
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                color: shell.text,
                letterSpacing: "0.01em",
                lineHeight: 1.15,
              }}
            >
              {t("shareSheet.title")}
            </h3>
          </div>
          <button
            type="button"
            aria-label={t("editor.layout.close")}
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: `1px solid ${shell.borderStrong}`,
              background: "rgba(255,255,255,0.03)",
              color: shell.textMuted,
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 12,
            color: shell.textMuted,
            lineHeight: 1.6,
            maxWidth: "36em",
          }}
        >
          {t("shareSheet.lead")}
        </p>
        {title ? (
          <div
            style={{
              marginTop: 12,
              display: "inline-flex",
              maxWidth: "100%",
              alignItems: "center",
              gap: 8,
              padding: "5px 10px 5px 8px",
              borderRadius: 999,
              border: `1px solid ${shell.border}`,
              background: "rgba(0,0,0,0.28)",
              color: shell.textSubtle,
              fontSize: 11,
              letterSpacing: "0.02em",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: GOLD,
                boxShadow: "0 0 8px rgba(212,175,55,0.7)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "#e7e5e4",
              }}
            >
              {title}
            </span>
          </div>
        ) : null}
      </header>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "4px 16px 28px",
        }}
      >
        <ShareCard
          index="01"
          icon={<IconLink />}
          title={t("shareSheet.collabTitle")}
          desc={t("shareSheet.collabDesc")}
        >
          {renderUrlActions("collab")}
        </ShareCard>

        <ShareCard
          index="02"
          icon={<IconEye />}
          title={t("shareSheet.studentTitle")}
          desc={t("shareSheet.studentDesc")}
        >
          {renderUrlActions("view")}
        </ShareCard>

        <ShareCard
          index="03"
          icon={<IconPdf />}
          title={t("shareSheet.pdfTitle")}
          desc={t("shareSheet.pdfDesc")}
        >
          <ActionBtn
            variant="gold"
            fill
            onClick={() => void onExportPdf()}
            disabled={!project || pdfBusy}
          >
            {pdfBusy
              ? t("shareSheet.pdfBusy")
              : flash === "pdf"
                ? t("shareSheet.pdfDone")
                : t("shareSheet.pdfButton")}
          </ActionBtn>
          {pdfError ? (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#f0a8a8", lineHeight: 1.45 }}>
              {pdfError}
            </p>
          ) : null}
        </ShareCard>

        <ShareCard
          index="04"
          icon={<IconFiles />}
          title={t("shareSheet.filesTitle")}
          desc={t("shareSheet.filesDesc")}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <FileTile
              label={flash === "csv" ? t("shareSheet.csvDone") : t("shareSheet.csvButton")}
              hint={t("shareSheet.csvDesc")}
              disabled={!project || cueCount === 0}
              onClick={onExportCsv}
            />
            <FileTile
              label={
                pngBusy
                  ? t("shareSheet.pngBusy")
                  : flash === "png"
                    ? t("shareSheet.pngDone")
                    : t("shareSheet.pngButton")
              }
              hint={t("shareSheet.pngDesc")}
              disabled={pngBusy}
              onClick={() => void onExportPng()}
            />
          </div>
          {cueCount === 0 ? (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: shell.textSubtle, lineHeight: 1.45 }}>
              {t("shareSheet.csvNeedCues")}
            </p>
          ) : null}
          {pngError ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#f0a8a8", lineHeight: 1.45 }}>
              {pngError}
            </p>
          ) : !canCapture2d ? (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: shell.textSubtle, lineHeight: 1.45 }}>
              {t("shareSheet.pngNeed2d")}
            </p>
          ) : null}
        </ShareCard>
      </div>
    </div>
  );
}

function FileTile({
  label,
  hint,
  onClick,
  disabled,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: "left",
        padding: "12px 12px 13px",
        borderRadius: 14,
        border: `1px solid ${hover && !disabled ? "rgba(212,175,55,0.42)" : shell.borderStrong}`,
        background:
          hover && !disabled ? "rgba(212, 175, 55, 0.1)" : "rgba(0,0,0,0.28)",
        color: shell.text,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        minHeight: 86,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        transition: "border-color 0.15s ease, background 0.15s ease",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.01em", lineHeight: 1.35 }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: shell.textMuted, lineHeight: 1.45 }}>{hint}</span>
    </button>
  );
}
