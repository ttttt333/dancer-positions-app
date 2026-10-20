import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { useI18n } from "../i18n/I18nContext";
import {
  buildCueSheetCsv,
  buildSingleShareUrlTextFileContent,
  copyTextToClipboard,
  downloadCueSheetCsv,
  downloadTextFile,
  projectShareLinks,
  shareLinksSafeFilenameBase,
} from "../lib/shareProjectLinks";
import {
  buildChoreographyPdfPages,
  CUE_IMAGE_EXPORT_FORMATS,
  exportChoreographyImages,
  exportChoreographyPdf,
  parseCueImageExportFormat,
  type CueImageExportFormat,
} from "../lib/exportChoreographyPdf";
import { downloadStagePngFile, getStageExportElement } from "../lib/captureStagePng";
import { shell } from "../theme/choreoShell";
import { isSupabaseBackend } from "../lib/supabaseClient";
import { supabaseEnsureEditToken } from "../lib/supabaseProjects";
import { projectApi } from "../api/client";
import {
  buildRangeExcerptProject,
  formatSecToClock,
  parseClockToSec,
} from "../lib/buildRangeExcerptProject";

type ShareKind = "collab" | "view";
type FlashKey = ShareKind | "pdf" | "images" | "csv" | "png";
type BtnVariant = "gold" | "ghost";

type Props = {
  open: boolean;
  collabUrl: string;
  viewUrl: string;
  hasServerId: boolean;
  /** クラウド版では編集用トークンを発行して `/join/{token}` を共同編集 URL にする */
  serverId?: number | null;
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
  collabUrl: legacyCollabUrl,
  viewUrl,
  hasServerId,
  serverId = null,
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
  const [imagesBusy, setImagesBusy] = useState(false);
  const [pngBusy, setPngBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [pngError, setPngError] = useState<string | null>(null);
  /** 画像書き出し用：0 始まりページ番号 */
  const [selectedImagePages, setSelectedImagePages] = useState<number[]>([]);
  const [imageRangeFrom, setImageRangeFrom] = useState(1);
  const [imageRangeTo, setImageRangeTo] = useState(1);
  const [imageExportFormat, setImageExportFormat] =
    useState<CueImageExportFormat>("png");

  const useJoinLink = isSupabaseBackend() && serverId != null;
  const [editToken, setEditToken] = useState<string | null>(null);
  const [editTokenError, setEditTokenError] = useState<string | null>(null);
  const [editTokenBusy, setEditTokenBusy] = useState(false);

  const loadEditToken = useCallback(
    async (regenerate: boolean) => {
      if (!useJoinLink || serverId == null) return;
      setEditTokenBusy(true);
      setEditTokenError(null);
      try {
        setEditToken(await supabaseEnsureEditToken(serverId, { regenerate }));
      } catch (e) {
        setEditTokenError(e instanceof Error ? e.message : "編集用リンクを作れませんでした");
      } finally {
        setEditTokenBusy(false);
      }
    },
    [serverId, useJoinLink]
  );

  useEffect(() => {
    if (open) void loadEditToken(false);
  }, [open, loadEditToken]);

  const collabUrl = useJoinLink
    ? editToken && typeof window !== "undefined"
      ? `${window.location.origin}/join/${editToken}`
      : ""
    : legacyCollabUrl;

  const onRegenerateEditToken = () => {
    if (
      !window.confirm(
        "共同編集リンクを作り直します。古いリンクからは新しく参加できなくなります（参加済みの人はそのまま編集できます）。"
      )
    ) {
      return;
    }
    void loadEditToken(true);
  };

  useEffect(() => {
    if (open) {
      setCopyKind(null);
      setFlash(null);
      setPdfBusy(false);
      setImagesBusy(false);
      setPngBusy(false);
      setPdfError(null);
      setImagesError(null);
      setPngError(null);
    }
  }, [open]);

  const untitled = t("pdf.untitled");
  const title = pieceTitle.trim() || projectName.trim() || untitled;
  const fileBase = shareLinksSafeFilenameBase(title);
  const cueCount = project?.cues?.length ?? 0;

  const imageCueChoices = useMemo(() => {
    if (!project) return [] as { index: number; title: string; timeLabel: string }[];
    const pages = buildChoreographyPdfPages(project, {
      cueN: (n) => t("pdf.cueN", { n }),
      formationN: (n) => t("pdf.formationN", { n }),
      formationFallback: t("pdf.formation"),
    });
    return pages.map((page, index) => ({
      index,
      title: page.title,
      timeLabel: page.timeLabel,
    }));
  }, [project, t]);

  useEffect(() => {
    if (!open) return;
    const n = imageCueChoices.length;
    setSelectedImagePages(Array.from({ length: n }, (_, i) => i));
    setImageRangeFrom(1);
    setImageRangeTo(Math.max(1, n));
  }, [open, imageCueChoices]);

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

  const choreographyExportLabels = () => ({
    playbackTime: t("pdf.playbackTime"),
    untitled,
    cueN: (n: number) => t("pdf.cueN", { n }),
    formationN: (n: number) => t("pdf.formationN", { n }),
    formationFallback: t("pdf.formation"),
    backstage: t("pdf.backstage"),
    side: t("pdf.side"),
    audience: t("pdf.audience"),
    emptyError: t("pdf.emptyError"),
  });

  const onExportPdf = async () => {
    if (!project || pdfBusy) return;
    setPdfError(null);
    setPdfBusy(true);
    try {
      await exportChoreographyPdf({
        project,
        projectName: title,
        labels: choreographyExportLabels(),
      });
      pulseFlash("pdf");
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : t("home.sheet.exportPdfFail"));
    } finally {
      setPdfBusy(false);
    }
  };

  const onExportImages = async () => {
    if (!project || imagesBusy) return;
    if (selectedImagePages.length === 0) {
      setImagesError(t("shareSheet.imagesNeedSelection"));
      return;
    }
    setImagesError(null);
    setImagesBusy(true);
    try {
      await exportChoreographyImages({
        project,
        projectName: title,
        labels: choreographyExportLabels(),
        pageIndexes: selectedImagePages,
        format: imageExportFormat,
      });
      pulseFlash("images");
    } catch (e) {
      setImagesError(
        e instanceof Error ? e.message : t("home.sheet.exportImagesFail")
      );
    } finally {
      setImagesBusy(false);
    }
  };

  const toggleImagePage = (index: number) => {
    setSelectedImagePages((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      return [...prev, index].sort((a, b) => a - b);
    });
  };

  const selectAllImagePages = () => {
    setSelectedImagePages(imageCueChoices.map((c) => c.index));
  };

  const clearImagePages = () => {
    setSelectedImagePages([]);
  };

  const applyImageRange = () => {
    const n = imageCueChoices.length;
    if (n === 0) return;
    const from = Math.min(n, Math.max(1, Math.floor(imageRangeFrom) || 1));
    const to = Math.min(n, Math.max(1, Math.floor(imageRangeTo) || 1));
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    setImageRangeFrom(lo);
    setImageRangeTo(hi);
    setSelectedImagePages(
      Array.from({ length: hi - lo + 1 }, (_, i) => lo - 1 + i)
    );
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
          {kind === "collab" && useJoinLink && editToken ? (
            <ActionBtn
              variant="ghost"
              onClick={onRegenerateEditToken}
              disabled={editTokenBusy}
            >
              リンクを作り直す
            </ActionBtn>
          ) : null}
        </div>
        {kind === "collab" && useJoinLink && editTokenError ? (
          <p style={{ margin: 0, fontSize: 12, color: "#f0a8a8", lineHeight: 1.5 }}>
            {editTokenError}
          </p>
        ) : null}
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
          icon={<IconEye />}
          title="範囲を決めて生徒に共有"
          desc="「最初の2分だけ」など、曲の一部だけのコピー作品を作り、その生徒用リンクを発行します。範囲の外の立ち位置は入りません。元の作品をあとで直しても、コピーには反映されません。"
        >
          {hasServerId ? (
            <RangeExcerptShare project={project} title={title} />
          ) : (
            renderUrlActions("view")
          )}
        </ShareCard>

        <ShareCard
          index="04"
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
          index="05"
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
              disabled={pngBusy || imagesBusy}
              onClick={() => void onExportPng()}
            />
            <div style={{ gridColumn: "1 / -1" }}>
              <div
                style={{
                  borderRadius: 14,
                  border: `1px solid ${shell.borderStrong}`,
                  background: "rgba(0,0,0,0.28)",
                  padding: "12px 12px 13px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.01em",
                      lineHeight: 1.35,
                      color: shell.text,
                    }}
                  >
                    {t("shareSheet.allPngButton")}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: shell.textMuted,
                      lineHeight: 1.45,
                    }}
                  >
                    {t("shareSheet.allPngSelectDesc")}
                  </div>
                </div>

                {imageCueChoices.length > 0 ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      <button
                        type="button"
                        onClick={selectAllImagePages}
                        disabled={imagesBusy || pngBusy}
                        style={cueSelectChipStyle}
                      >
                        {t("shareSheet.imagesSelectAll")}
                      </button>
                      <button
                        type="button"
                        onClick={clearImagePages}
                        disabled={imagesBusy || pngBusy}
                        style={cueSelectChipStyle}
                      >
                        {t("shareSheet.imagesClearAll")}
                      </button>
                      <span
                        style={{
                          fontSize: 11,
                          color: shell.textMuted,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {t("shareSheet.imagesSelectedCount", {
                          selected: selectedImagePages.length,
                          total: imageCueChoices.length,
                        })}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        alignItems: "center",
                        fontSize: 11,
                        color: shell.textMuted,
                      }}
                    >
                      <span>{t("shareSheet.imagesRangeLabel")}</span>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, imageCueChoices.length)}
                        value={imageRangeFrom}
                        disabled={imagesBusy || pngBusy}
                        onChange={(e) =>
                          setImageRangeFrom(Number(e.target.value) || 1)
                        }
                        aria-label={t("shareSheet.imagesRangeFrom")}
                        style={cueRangeInputStyle}
                      />
                      <span>〜</span>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, imageCueChoices.length)}
                        value={imageRangeTo}
                        disabled={imagesBusy || pngBusy}
                        onChange={(e) =>
                          setImageRangeTo(Number(e.target.value) || 1)
                        }
                        aria-label={t("shareSheet.imagesRangeTo")}
                        style={cueRangeInputStyle}
                      />
                      <button
                        type="button"
                        onClick={applyImageRange}
                        disabled={imagesBusy || pngBusy}
                        style={cueSelectChipStyle}
                      >
                        {t("shareSheet.imagesApplyRange")}
                      </button>
                    </div>

                    <div
                      role="group"
                      aria-label={t("shareSheet.imagesCueListAria")}
                      style={{
                        maxHeight: 180,
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        paddingRight: 2,
                      }}
                    >
                      {imageCueChoices.map((cue) => {
                        const checked = selectedImagePages.includes(cue.index);
                        return (
                          <label
                            key={cue.index}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "6px 8px",
                              borderRadius: 8,
                              border: checked
                                ? "1px solid rgba(212,175,55,0.45)"
                                : "1px solid transparent",
                              background: checked
                                ? "rgba(212,175,55,0.1)"
                                : "transparent",
                              cursor: imagesBusy || pngBusy ? "default" : "pointer",
                              opacity: imagesBusy || pngBusy ? 0.55 : 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={imagesBusy || pngBusy}
                              onChange={() => toggleImagePage(cue.index)}
                            />
                            <span
                              style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: 12,
                                fontWeight: 600,
                                color: shell.text,
                              }}
                            >
                              {cue.title}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: shell.textMuted,
                                fontVariantNumeric: "tabular-nums",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {cue.timeLabel}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        alignItems: "center",
                        fontSize: 11,
                        color: shell.textMuted,
                      }}
                    >
                      <label
                        htmlFor="cue-image-export-format"
                        style={{ fontWeight: 600 }}
                      >
                        {t("shareSheet.imagesFormatLabel")}
                      </label>
                      <select
                        id="cue-image-export-format"
                        value={imageExportFormat}
                        disabled={imagesBusy || pngBusy}
                        aria-label={t("shareSheet.imagesFormatAria")}
                        onChange={(e) =>
                          setImageExportFormat(
                            parseCueImageExportFormat(e.target.value)
                          )
                        }
                        style={{
                          ...cueRangeInputStyle,
                          width: "auto",
                          minWidth: 88,
                          paddingRight: 28,
                          cursor:
                            imagesBusy || pngBusy ? "not-allowed" : "pointer",
                          opacity: imagesBusy || pngBusy ? 0.55 : 1,
                        }}
                      >
                        {CUE_IMAGE_EXPORT_FORMATS.map((fmt) => (
                          <option key={fmt} value={fmt}>
                            .{fmt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : null}

                <button
                  type="button"
                  disabled={
                    !project ||
                    imageCueChoices.length === 0 ||
                    selectedImagePages.length === 0 ||
                    imagesBusy ||
                    pngBusy
                  }
                  onClick={() => void onExportImages()}
                  style={{
                    ...cueSelectChipStyle,
                    width: "100%",
                    justifyContent: "center",
                    padding: "10px 12px",
                    fontWeight: 700,
                    borderColor:
                      selectedImagePages.length > 0 && !imagesBusy
                        ? "rgba(212,175,55,0.55)"
                        : shell.borderStrong,
                    background:
                      selectedImagePages.length > 0 && !imagesBusy
                        ? "rgba(212,175,55,0.16)"
                        : "rgba(0,0,0,0.2)",
                    color: shell.text,
                    opacity:
                      !project ||
                      imageCueChoices.length === 0 ||
                      selectedImagePages.length === 0 ||
                      imagesBusy ||
                      pngBusy
                        ? 0.45
                        : 1,
                    cursor:
                      !project ||
                      imageCueChoices.length === 0 ||
                      selectedImagePages.length === 0 ||
                      imagesBusy ||
                      pngBusy
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {imagesBusy
                    ? t("shareSheet.imagesBusy")
                    : flash === "images"
                      ? t("shareSheet.imagesDone")
                      : t("shareSheet.imagesDownloadSelected", {
                          count: selectedImagePages.length,
                          format: imageExportFormat,
                        })}
                </button>
              </div>
            </div>
          </div>
          {cueCount === 0 && imageCueChoices.length === 0 ? (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: shell.textSubtle, lineHeight: 1.45 }}>
              {t("shareSheet.csvNeedCues")}
            </p>
          ) : null}
          {imagesError ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#f0a8a8", lineHeight: 1.45 }}>
              {imagesError}
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

const cueSelectChipStyle: CSSProperties = {
  padding: "5px 10px",
  borderRadius: 8,
  border: `1px solid ${shell.borderStrong}`,
  background: "rgba(0,0,0,0.22)",
  color: shell.textMuted,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

const cueRangeInputStyle: CSSProperties = {
  width: 56,
  padding: "5px 6px",
  borderRadius: 6,
  border: `1px solid ${shell.borderStrong}`,
  background: "#020617",
  color: shell.text,
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
};

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

type ExcerptLink = { label: string; url: string };

const clockInputStyle: CSSProperties = {
  width: 72,
  padding: "7px 8px",
  borderRadius: 10,
  border: `1px solid ${shell.borderStrong}`,
  background: "rgba(0,0,0,0.38)",
  color: shell.text,
  fontSize: 13,
  fontVariantNumeric: "tabular-nums",
  textAlign: "center",
};

function RangeExcerptShare({
  project,
  title,
}: {
  project: ChoreographyProjectJson | null;
  title: string;
}) {
  const lastCueEnd = Math.max(0, ...(project?.cues ?? []).map((c) => c.tEndSec));
  const [startStr, setStartStr] = useState("0:00");
  const [endStr, setEndStr] = useState(() =>
    formatSecToClock(Math.min(120, lastCueEnd || 120))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<ExcerptLink[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const onCreate = async () => {
    if (!project || busy) return;
    setError(null);
    const s = parseClockToSec(startStr);
    const e = endStr.trim() ? parseClockToSec(endStr) : lastCueEnd;
    if (s == null || e == null) {
      setError("時間は「2:00」のように 分:秒 で入力してください。");
      return;
    }
    if (!(e > s)) {
      setError("終わりの時間は、始めの時間より後にしてください。");
      return;
    }
    const excerpt = buildRangeExcerptProject(project, s, e);
    if (excerpt.cues.length === 0) {
      setError("この範囲にはキューがありません。範囲を見直してください。");
      return;
    }
    const label = `${formatSecToClock(s)}〜${formatSecToClock(e)}`;
    setBusy(true);
    try {
      const row = await projectApi.create(`${title}（${label} 生徒用）`, excerpt);
      const url = projectShareLinks(row.id, row.share_token).view;
      setLinks((prev) => [{ label, url }, ...prev]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg.startsWith("free_limit")
          ? "無料プランの作品数の上限に達しているため、コピーを作れませんでした。"
          : msg || "コピー作品を作れませんでした。"
      );
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async (url: string) => {
    if (await copyTextToClipboard(url)) {
      setCopiedUrl(url);
      window.setTimeout(() => setCopiedUrl((cur) => (cur === url ? null : cur)), 2000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <input
          aria-label="始め（分:秒）"
          data-excerpt-start
          value={startStr}
          onChange={(e) => setStartStr(e.target.value)}
          placeholder="0:00"
          style={clockInputStyle}
        />
        <span style={{ color: shell.textMuted, fontSize: 13 }}>〜</span>
        <input
          aria-label="終わり（分:秒）"
          data-excerpt-end
          value={endStr}
          onChange={(e) => setEndStr(e.target.value)}
          placeholder={formatSecToClock(lastCueEnd)}
          style={clockInputStyle}
        />
        <span style={{ color: shell.textSubtle, fontSize: 11 }}>
          （最後のキュー {formatSecToClock(lastCueEnd)}）
        </span>
      </div>
      <ActionBtn
        variant="gold"
        fill
        onClick={() => void onCreate()}
        disabled={!project || busy}
      >
        {busy ? "作成中…" : "この範囲のコピーを作ってリンクを発行"}
      </ActionBtn>
      {error ? (
        <p style={{ margin: 0, fontSize: 12, color: "#f0a8a8", lineHeight: 1.5 }}>{error}</p>
      ) : null}
      {links.map((l) => (
        <div
          key={l.url}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(0,0,0,0.38)",
            border: "1px solid rgba(212, 175, 55, 0.14)",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: shell.text }}>{l.label}</span>
          <span
            style={{
              fontSize: 11,
              color: "#d6d3d1",
              wordBreak: "break-all",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            {l.url}
          </span>
          <div>
            <ActionBtn variant="ghost" onClick={() => void onCopy(l.url)}>
              {copiedUrl === l.url ? "コピーしました" : "リンクをコピー"}
            </ActionBtn>
          </div>
        </div>
      ))}
    </div>
  );
}
