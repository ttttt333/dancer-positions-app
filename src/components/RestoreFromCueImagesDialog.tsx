import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { EditorSideSheet } from "./EditorSideSheet";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";
import { usePositionParser } from "../hooks/usePositionParser";
import { collectCueImagesFromFiles } from "../lib/collectCueImagesFromFiles";
import {
  parseCueExportImageFileName,
  parseCueExportTimeRangeLabel,
} from "../lib/cueExportImageMeta";
import { restoreCuesFromParsedPages } from "../lib/restoreCuesFromParsedPages";
import { buildHintsFromEntries } from "../lib/rosterHintCatalog";
import {
  allRosterMemberIds,
  getRosterHintGroups,
  rosterHintEntriesFromGroups,
} from "../lib/rosterHintGroups";
import { parseRosterHintsFromFile } from "../lib/parseRosterHintsFromFile";
import type { ParsePositionResponse } from "../lib/parsePositionTypes";

type Props = {
  open: boolean;
  onClose: () => void;
  project: ChoreographyProjectJson;
  setProject: (
    action:
      | ChoreographyProjectJson
      | ((prev: ChoreographyProjectJson) => ChoreographyProjectJson)
  ) => void;
  durationSec: number;
  onRestored?: (info: { cueCount: number; dancerPeak: number }) => void;
};

type PagePreview = {
  fileName: string;
  title: string;
  timeLabel: string | null;
  positionCount: number;
  result: ParsePositionResponse;
};

/**
 * 共有で書き出したキュー図 PNG / ZIP から、キューをまとめて復元する。
 */
export function RestoreFromCueImagesDialog({
  open,
  onClose,
  project,
  setProject,
  durationSec,
  onRestored,
}: Props) {
  const { loading, error, clearError, reset, parseImageFilesSeparately } =
    usePositionParser();
  const [pages, setPages] = useState<PagePreview[] | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyWarnings, setApplyWarnings] = useState<string[]>([]);
  const [rosterNotice, setRosterNotice] = useState<string | null>(null);
  const [extraHints, setExtraHints] = useState<string[]>([]);

  const rosterGroups = useMemo(() => getRosterHintGroups(project), [project]);
  const projectHints = useMemo(() => {
    const entries = rosterHintEntriesFromGroups(rosterGroups);
    return buildHintsFromEntries(
      entries,
      new Set(allRosterMemberIds(rosterGroups)),
      "full"
    ).hints;
  }, [rosterGroups]);

  const memberNameHints = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const h of [...extraHints, ...projectHints]) {
      const t = h.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }, [extraHints, projectHints]);

  useEffect(() => {
    if (!open) {
      reset();
      setPages(null);
      setProgressText(null);
      setApplyError(null);
      setApplyWarnings([]);
      setRosterNotice(null);
      setExtraHints([]);
      setReplaceExisting(true);
    }
  }, [open, reset]);

  const onPickImages = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (!list.length) return;
    clearError();
    setApplyError(null);
    setApplyWarnings([]);
    setPages(null);
    try {
      const images = await collectCueImagesFromFiles(list);
      if (!images.length) {
        setApplyError("PNG / JPEG またはキュー図 ZIP を選んでください");
        return;
      }
      setProgressText(`0 / ${images.length}`);
      const parsed = await parseImageFilesSeparately(images, {
        memberNameHints,
        onProgress: (p) =>
          setProgressText(`${p.current} / ${p.total} · ${p.fileName}`),
      });
      setProgressText(null);
      if (!parsed) return;
      setPages(
        parsed.map(({ file, result }) => {
          const meta = parseCueExportImageFileName(file.name);
          const timeLabel =
            result.pageTimeLabel?.trim() ||
            null;
          return {
            fileName: file.name,
            title:
              result.pageTitle?.trim() ||
              meta.title ||
              `キュー ${meta.index ?? "?"}`,
            timeLabel,
            positionCount: result.positions.length,
            result,
          };
        })
      );
    } catch (err) {
      setProgressText(null);
      setApplyError(
        err instanceof Error ? err.message : "画像の読み込みに失敗しました"
      );
    }
  };

  const onPickRoster = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const result = await parseRosterHintsFromFile(file);
      const names = result.entries.map((x) => x.fullName).filter(Boolean);
      setExtraHints(names);
      setRosterNotice(
        `${names.length} 名を名簿ヒントに追加しました（${result.sourceLabel}）`
      );
    } catch (err) {
      setRosterNotice(
        err instanceof Error ? err.message : "名簿の読み込みに失敗しました"
      );
    }
  };

  const onApply = useCallback(() => {
    if (!pages?.length) return;
    setApplyError(null);
    const input = pages.map((p) => ({
      positions: p.result.positions,
      title: p.title,
      timeRange: parseCueExportTimeRangeLabel(p.timeLabel),
    }));
    const restored = restoreCuesFromParsedPages(project, input, {
      durationSec: durationSec > 0 ? durationSec : null,
      replaceExistingCues: replaceExisting,
    });
    if (!restored) {
      setApplyError("キューを1件も作れませんでした");
      return;
    }
    setProject(restored.project);
    setApplyWarnings(restored.warnings);
    onRestored?.({
      cueCount: restored.cueCount,
      dancerPeak: restored.dancerPeak,
    });
    if (restored.warnings.length === 0) onClose();
  }, [
    pages,
    project,
    durationSec,
    replaceExisting,
    setProject,
    onRestored,
    onClose,
  ]);

  return (
    <EditorSideSheet
      open={open}
      onClose={onClose}
      blockDismiss={loading}
      zIndex={96}
      width="min(440px, 94vw)"
      sheetId="restore-cue-images"
      ariaLabelledBy="restore-cue-images-title"
    >
      <div style={{ padding: "16px 18px 22px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <h2
            id="restore-cue-images-title"
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 800,
              color: shell.text,
            }}
          >
            キュー図から復元
          </h2>
          <button
            type="button"
            aria-label="閉じる"
            disabled={loading}
            onClick={onClose}
            style={{
              ...btnSecondary,
              minWidth: 36,
              minHeight: 36,
              padding: "4px 10px",
              opacity: loading ? 0.45 : 1,
            }}
          >
            ✕
          </button>
        </div>

        <p
          style={{
            margin: "0 0 12px",
            fontSize: 12,
            lineHeight: 1.55,
            color: shell.textMuted,
          }}
        >
          以前ダウンロードしたキュー図（PNG または ZIP）を選ぶと、立ち位置と再生時間を読み取ってキューを作り直します。動画は別途、音源として読み込んでください。
        </p>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
            fontSize: 12,
            color: shell.text,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={replaceExisting}
            disabled={loading}
            onChange={(e) => setReplaceExisting(e.target.checked)}
          />
          いまのキューを捨てて、読み取った内容で置き換える
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ ...btnSecondary, display: "block", textAlign: "center" }}>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.pdf,image/*"
              hidden
              disabled={loading}
              onChange={(e) => void onPickRoster(e)}
            />
            名簿をヒントに追加（任意）
          </label>
          {rosterNotice ? (
            <p style={{ margin: 0, fontSize: 11, color: shell.textSubtle }}>
              {rosterNotice}
            </p>
          ) : null}
          {memberNameHints.length > 0 ? (
            <p style={{ margin: 0, fontSize: 11, color: shell.accent }}>
              名簿ヒント {memberNameHints.length} 名
            </p>
          ) : null}

          <label
            style={{
              ...btnAccent,
              display: "block",
              textAlign: "center",
              opacity: loading ? 0.55 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            <input
              type="file"
              accept="image/*,.zip,application/zip"
              multiple
              hidden
              disabled={loading}
              onChange={(e) => void onPickImages(e)}
            />
            {loading
              ? progressText
                ? `解析中… ${progressText}`
                : "解析中…"
              : "キュー図 PNG / ZIP を選ぶ"}
          </label>
        </div>

        {error ? (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#f0a8a8" }}>
            {error}
          </p>
        ) : null}
        {applyError ? (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#f0a8a8" }}>
            {applyError}
          </p>
        ) : null}

        {pages && pages.length > 0 ? (
          <div style={{ marginTop: 14 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: shell.accent,
                marginBottom: 8,
                letterSpacing: "0.08em",
              }}
            >
              読み取り結果 {pages.length} 枚
            </div>
            <div
              style={{
                maxHeight: 220,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "8px 10px",
                borderRadius: 12,
                border: `1px solid ${shell.borderStrong}`,
                background: "rgba(0,0,0,0.28)",
              }}
            >
              {pages.map((p) => (
                <div
                  key={p.fileName}
                  style={{
                    fontSize: 12,
                    color: shell.text,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span style={{ fontWeight: 700, minWidth: 0 }}>
                    {p.title}
                    <span
                      style={{
                        marginLeft: 8,
                        fontWeight: 500,
                        color: shell.textMuted,
                      }}
                    >
                      {p.timeLabel || "時間不明"}
                    </span>
                  </span>
                  <span style={{ color: shell.textSubtle, flexShrink: 0 }}>
                    {p.positionCount} 人
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={onApply}
              style={{
                ...btnAccent,
                width: "100%",
                marginTop: 12,
                minHeight: 44,
                fontWeight: 800,
              }}
            >
              この内容で作品に反映
            </button>
          </div>
        ) : null}

        {applyWarnings.length > 0 ? (
          <ul
            style={{
              margin: "12px 0 0",
              paddingLeft: 18,
              fontSize: 11,
              color: "#fde68a",
              lineHeight: 1.45,
            }}
          >
            {applyWarnings.slice(0, 8).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </EditorSideSheet>
  );
}
