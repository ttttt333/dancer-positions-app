import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { applyParsedPositionsAsCue } from "../lib/applyParsedPositionsAsCue";
import {
  isNumericPlaceholderRoster,
  mergeHintToFullNameMaps,
  mergeNameHints,
} from "../lib/extractRosterNameHints";
import { parseRosterHintsFromFile } from "../lib/parseRosterHintsFromFile";
import {
  buildHintsFromEntries,
  hintLabelForEntry,
  type RosterHintEntry,
  type RosterHintNameMode,
} from "../lib/rosterHintCatalog";
import {
  allRosterMemberIds,
  getRosterHintGroups,
  rosterHintEntriesFromGroups,
} from "../lib/rosterHintGroups";
import { ROSTER_FILE_ACCEPT } from "../lib/rosterFileImport";
import type {
  CountMismatch,
  ParsedLine,
  ParsedPosition,
} from "../lib/parsePositionTypes";
import {
  usePositionParser,
  type ParseImageProgress,
} from "../hooks/usePositionParser";
import { btnAccent, btnSecondary } from "./stageButtonStyles";
import { shell } from "../theme/choreoShell";

type Props = {
  open: boolean;
  onClose: () => void;
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  currentTimeSec: number;
  durationSec: number;
  onCueCreated?: (cueId: string, startSec: number) => void;
};

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9200,
  background: "rgba(0,0,0,0.75)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))",
};

const ROSTER_HINT_ACCEPT =
  `${ROSTER_FILE_ACCEPT}image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif`;

const NAME_MODE_OPTIONS: { value: RosterHintNameMode; label: string }[] = [
  { value: "full", label: "フルネーム" },
  { value: "family_only", label: "苗字のみ" },
  { value: "given_only", label: "名のみ" },
];

function RosterNameModePicker({
  mode,
  onChange,
  prominent,
}: {
  mode: RosterHintNameMode;
  onChange: (mode: RosterHintNameMode) => void;
  prominent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: prominent ? 0 : 8,
      }}
    >
      {NAME_MODE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            ...(prominent ? btnAccent : btnSecondary),
            padding: prominent ? "8px 14px" : "4px 10px",
            fontSize: prominent ? 12 : 11,
            borderColor: mode === opt.value ? "#d4af37" : undefined,
            color:
              mode === opt.value
                ? prominent
                  ? "#0f172a"
                  : "#fde68a"
                : prominent
                  ? shell.text
                  : undefined,
            opacity: prominent && mode !== opt.value ? 0.85 : 1,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const dialog: CSSProperties = {
  width: "min(520px, calc(100vw - 32px))",
  maxHeight: "min(640px, calc(100dvh - 48px))",
  background: shell.bgDeep,
  border: `1px solid ${shell.border}`,
  borderRadius: 16,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
};

function formatSec(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00.0";
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
}

function PositionPreviewThumb({ positions }: { positions: ParsedPosition[] }) {
  return (
    <svg
      viewBox="0 0 100 60"
      width="100%"
      height={120}
      aria-hidden
      style={{
        display: "block",
        background: "#0a0f1e",
        borderRadius: 8,
        border: "1px solid #334155",
      }}
    >
      <rect x="0" y="48" width="100" height="12" fill="#94a3b8" fillOpacity={0.12} rx="2" />
      {positions.map((p, i) => (
        <g key={`${p.name}-${i}`}>
          <circle
            cx={Math.max(4, Math.min(96, p.x))}
            cy={2 + (Math.max(0, Math.min(100, p.y)) / 100) * 56}
            r={3.2}
            fill="#d4af37"
            fillOpacity={0.95}
          />
        </g>
      ))}
    </svg>
  );
}

export function ParsePositionFromPhotoDialog({
  open,
  onClose,
  project,
  setProject,
  currentTimeSec,
  durationSec,
  onCueCreated,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rosterFileInputRef = useRef<HTMLInputElement>(null);
  const { loading, error, clearError, parseImageFiles } = usePositionParser();
  const [preview, setPreview] = useState<ParsedPosition[] | null>(null);
  const [previewLines, setPreviewLines] = useState<ParsedLine[] | null>(null);
  const [countMismatches, setCountMismatches] = useState<CountMismatch[]>([]);
  const [formationName, setFormationName] = useState("写真から取込");
  const [sourceFileNames, setSourceFileNames] = useState<string[]>([]);
  const [useProjectRosterHints, setUseProjectRosterHints] = useState(true);
  const [useUploadedRosterHints, setUseUploadedRosterHints] = useState(true);
  const [selectedRosterIds, setSelectedRosterIds] = useState<Set<string>>(
    () => new Set()
  );
  const [uploadedRosterEntries, setUploadedRosterEntries] = useState<
    RosterHintEntry[]
  >([]);
  const [selectedUploadedIds, setSelectedUploadedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [uploadedNameMode, setUploadedNameMode] =
    useState<RosterHintNameMode>("full");
  const [uploadedNameModeChosen, setUploadedNameModeChosen] = useState(false);
  const [projectNameMode, setProjectNameMode] =
    useState<RosterHintNameMode>("full");
  const [uploadedRosterSource, setUploadedRosterSource] = useState<string | null>(
    null
  );
  const [uploadedRosterNotice, setUploadedRosterNotice] = useState<string | null>(
    null
  );
  const [rosterUploadLoading, setRosterUploadLoading] = useState(false);
  const [rosterUploadError, setRosterUploadError] = useState<string | null>(null);
  const [parseProgress, setParseProgress] = useState<ParseImageProgress | null>(
    null
  );
  const [rosterExpanded, setRosterExpanded] = useState(false);
  const [uploadedRosterExpanded, setUploadedRosterExpanded] = useState(true);

  const rosterGroups = useMemo(
    () => getRosterHintGroups(project),
    [project]
  );
  const hasProjectRoster = rosterGroups.length > 0;
  const projectRosterEntries = useMemo(
    () => rosterHintEntriesFromGroups(rosterGroups),
    [rosterGroups]
  );
  const allProjectLabels = useMemo(
    () => projectRosterEntries.map((e) => e.fullName),
    [projectRosterEntries]
  );
  const projectRosterIsNumeric = isNumericPlaceholderRoster(allProjectLabels);
  const hasUploadedRoster = uploadedRosterEntries.length > 0;
  const busy = loading || rosterUploadLoading;

  const projectHintBuild = useMemo(() => {
    if (!useProjectRosterHints || !hasProjectRoster) {
      return { hints: [] as string[], hintToFullName: new Map<string, string>() };
    }
    return buildHintsFromEntries(
      projectRosterEntries,
      selectedRosterIds,
      projectNameMode
    );
  }, [
    useProjectRosterHints,
    hasProjectRoster,
    projectRosterEntries,
    selectedRosterIds,
    projectNameMode,
  ]);

  const uploadedHintBuild = useMemo(() => {
    if (!useUploadedRosterHints || !hasUploadedRoster) {
      return { hints: [] as string[], hintToFullName: new Map<string, string>() };
    }
    return buildHintsFromEntries(
      uploadedRosterEntries,
      selectedUploadedIds,
      uploadedNameMode
    );
  }, [
    useUploadedRosterHints,
    hasUploadedRoster,
    uploadedRosterEntries,
    selectedUploadedIds,
    uploadedNameMode,
  ]);

  const memberNameHints = useMemo(
    () => mergeNameHints(projectHintBuild.hints, uploadedHintBuild.hints),
    [projectHintBuild.hints, uploadedHintBuild.hints]
  );

  const hintToFullName = useMemo(
    () =>
      mergeHintToFullNameMaps(
        projectHintBuild.hintToFullName,
        uploadedHintBuild.hintToFullName
      ),
    [projectHintBuild.hintToFullName, uploadedHintBuild.hintToFullName]
  );

  const hintsEnabled =
    (useProjectRosterHints && hasProjectRoster) ||
    (useUploadedRosterHints && hasUploadedRoster);
  const hintsReady = !hintsEnabled || memberNameHints.length > 0;

  const uploadedModeReady =
    !useUploadedRosterHints || !hasUploadedRoster || uploadedNameModeChosen;

  const canParseImages = hintsReady && uploadedModeReady;

  const resetState = useCallback(() => {
    setPreview(null);
    setPreviewLines(null);
    setCountMismatches([]);
    setFormationName("写真から取込");
    setSourceFileNames([]);
    setParseProgress(null);
    setUploadedRosterEntries([]);
    setSelectedUploadedIds(new Set());
    setUploadedNameMode("full");
    setUploadedNameModeChosen(false);
    setProjectNameMode("full");
    setUploadedRosterSource(null);
    setUploadedRosterNotice(null);
    setRosterUploadLoading(false);
    setRosterUploadError(null);
    setUseUploadedRosterHints(true);
    setUploadedRosterExpanded(true);
    setUseProjectRosterHints(!projectRosterIsNumeric);
    setRosterExpanded(projectRosterIsNumeric);
    setSelectedRosterIds(new Set(allRosterMemberIds(rosterGroups)));
    clearError();
  }, [clearError, rosterGroups, projectRosterIsNumeric]);

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  const toggleRosterMember = (id: string) => {
    setSelectedRosterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllRoster = () => {
    setSelectedRosterIds(new Set(allRosterMemberIds(rosterGroups)));
  };

  const clearAllRoster = () => {
    setSelectedRosterIds(new Set());
  };

  const selectAllUploaded = () => {
    setSelectedUploadedIds(new Set(uploadedRosterEntries.map((e) => e.id)));
  };

  const clearAllUploaded = () => {
    setSelectedUploadedIds(new Set());
  };

  const toggleUploadedEntry = (id: string) => {
    setSelectedUploadedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRosterUploadClick = () => {
    if (busy) return;
    rosterFileInputRef.current?.click();
  };

  const handleRosterFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setRosterUploadLoading(true);
    setRosterUploadError(null);
    clearError();
    try {
      const result = await parseRosterHintsFromFile(file);
      setUploadedRosterEntries(result.entries);
      setSelectedUploadedIds(new Set(result.entries.map((e) => e.id)));
      setUploadedRosterSource(result.sourceLabel);
      setUploadedRosterNotice(result.notice ?? null);
      setUseUploadedRosterHints(true);
      setUploadedRosterExpanded(true);
      setUploadedNameMode("family_only");
      setUploadedNameModeChosen(false);
      if (projectRosterIsNumeric) {
        setUseProjectRosterHints(false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "名簿の読み込みに失敗しました";
      setRosterUploadError(msg);
    } finally {
      setRosterUploadLoading(false);
    }
  };

  const handlePickClick = () => {
    if (busy) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setSourceFileNames(files.map((f) => f.name));
    setParseProgress(null);
    const result = await parseImageFiles(files, {
      memberNameHints: memberNameHints.length ? memberNameHints : undefined,
      hintToFullName: hintToFullName.size ? hintToFullName : undefined,
      onProgress: setParseProgress,
    });
    setParseProgress(null);
    if (result?.positions.length) {
      setPreview(result.positions);
      setPreviewLines(result.lines ?? null);
      setCountMismatches(result.countMismatches ?? []);
    }
  };

  const handleConfirm = () => {
    if (!preview?.length) return;
    if (countMismatches.length > 0) {
      const detail = countMismatches
        .map(
          (m) =>
            `列${m.lineIndex + 1}: 画像の人数 ${m.expected} 人 → 読取 ${m.actual} 人`
        )
        .join("\n");
      const ok = window.confirm(
        `列ごとの人数が一致しません。\n${detail}\n\nこのまま確定してキューに追加しますか？`
      );
      if (!ok) return;
    }
    if (project.cues.length >= 100) {
      window.alert("キューは最大 100 件までです。");
      return;
    }
    let appliedCueId: string | null = null;
    let appliedStart = currentTimeSec;
    setProject((p) => {
      const applied = applyParsedPositionsAsCue(p, {
        positions: preview,
        tStartSec: currentTimeSec,
        durationSec,
        formationName,
      });
      if (!applied) {
        window.alert("キューを追加できませんでした。");
        return p;
      }
      appliedCueId = applied.result.cueId;
      appliedStart = applied.result.tStartSec;
      return applied.project;
    });
    if (appliedCueId) {
      onCueCreated?.(appliedCueId, appliedStart);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="parse-position-photo-title"
      style={overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: `1px solid ${shell.border}`,
          }}
        >
          <h2
            id="parse-position-photo-title"
            style={{ margin: 0, fontSize: 16, fontWeight: 700, color: shell.text }}
          >
            写真から立ち位置を取込
          </h2>
          <button
            type="button"
            aria-label="閉じる"
            disabled={busy}
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: shell.textMuted,
              fontSize: 20,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {!preview ? (
            <>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: shell.textMuted, lineHeight: 1.5 }}>
                まず名簿（ファイルまたは写真）をアップロードすると、その名前が立ち位置画像の中にあると予測して読み取ります。
                立ち位置図は 1 枚または複数枚選べます（例: 手書きメモ＋デジタル図）。
              </p>

              <div
                style={{
                  marginBottom: 12,
                  border: `1px solid ${shell.border}`,
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setUploadedRosterExpanded((v) => !v)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "#0f172a",
                    border: "none",
                    color: shell.text,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>
                    名簿をアップロード
                    {hasUploadedRoster
                      ? `（${uploadedHintBuild.hints.length}/${uploadedRosterEntries.length} 名）`
                      : ""}
                  </span>
                  <span style={{ color: shell.textMuted, fontSize: 11 }}>
                    {uploadedRosterExpanded ? "▲" : "▼"}
                  </span>
                </button>
                {uploadedRosterExpanded ? (
                  <div style={{ padding: "8px 12px 10px" }}>
                    <p
                      style={{
                        margin: "0 0 8px",
                        fontSize: 11,
                        color: shell.textMuted,
                        lineHeight: 1.45,
                      }}
                    >
                      CSV / Excel / PDF または名簿の写真を選ぶと、メンバー名を抽出して立ち位置の読み取りヒントに使います。
                    </p>
                    <input
                      ref={rosterFileInputRef}
                      type="file"
                      accept={ROSTER_HINT_ACCEPT}
                      style={{ display: "none" }}
                      onChange={(e) => void handleRosterFileChange(e)}
                    />
                    <button
                      type="button"
                      onClick={handleRosterUploadClick}
                      disabled={busy || project.viewMode === "view"}
                      style={{
                        ...btnSecondary,
                        width: "100%",
                        opacity: rosterUploadLoading ? 0.7 : 1,
                        cursor: rosterUploadLoading ? "wait" : "pointer",
                      }}
                    >
                      {rosterUploadLoading
                        ? "名簿を読み取り中…"
                        : hasUploadedRoster
                          ? "名簿を差し替える"
                          : "名簿ファイル・写真を選ぶ"}
                    </button>
                    {uploadedRosterSource ? (
                      <p
                        style={{
                          margin: "8px 0 0",
                          fontSize: 11,
                          color: shell.textMuted,
                        }}
                      >
                        読み込み元: {uploadedRosterSource}
                      </p>
                    ) : null}
                    {uploadedRosterNotice ? (
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: 11,
                          color: "#fbbf24",
                          lineHeight: 1.45,
                        }}
                      >
                        {uploadedRosterNotice}
                      </p>
                    ) : null}
                    {hasUploadedRoster ? (
                      <>
                        <div
                          style={{
                            marginTop: 10,
                            padding: "10px 12px",
                            borderRadius: 8,
                            background: uploadedNameModeChosen
                              ? "#0f172a"
                              : "rgba(212,175,55,0.12)",
                            border: uploadedNameModeChosen
                              ? "1px solid #334155"
                              : "1px solid rgba(212,175,55,0.45)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: uploadedNameModeChosen ? shell.text : "#fde68a",
                              marginBottom: 8,
                            }}
                          >
                            {uploadedNameModeChosen
                              ? "読み取り表記"
                              : "読み取り表記を選んでください"}
                          </div>
                          <p
                            style={{
                              margin: "0 0 10px",
                              fontSize: 11,
                              color: shell.textMuted,
                              lineHeight: 1.45,
                            }}
                          >
                            立ち位置画像に書かれている表記（苗字だけ・名前だけ等）に合わせて選びます。確定時はフルネームで登録します。
                          </p>
                          <RosterNameModePicker
                            prominent={!uploadedNameModeChosen}
                            mode={uploadedNameMode}
                            onChange={(mode) => {
                              setUploadedNameMode(mode);
                              setUploadedNameModeChosen(true);
                            }}
                          />
                        </div>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12,
                            color: shell.text,
                            margin: "10px 0 8px",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={useUploadedRosterHints}
                            onChange={(e) => setUseUploadedRosterHints(e.target.checked)}
                          />
                          アップロード名簿をヒントとして使う
                        </label>
                        {useUploadedRosterHints ? (
                          <>
                            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                              <button
                                type="button"
                                onClick={selectAllUploaded}
                                style={{
                                  ...btnSecondary,
                                  padding: "4px 10px",
                                  fontSize: 11,
                                }}
                              >
                                全選択
                              </button>
                              <button
                                type="button"
                                onClick={clearAllUploaded}
                                style={{
                                  ...btnSecondary,
                                  padding: "4px 10px",
                                  fontSize: 11,
                                }}
                              >
                                全解除
                              </button>
                            </div>
                            <div
                              style={{
                                maxHeight: 120,
                                overflow: "auto",
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "4px 10px",
                              }}
                            >
                              {uploadedRosterEntries.map((entry) => {
                                const label = hintLabelForEntry(entry, uploadedNameMode);
                                return (
                                  <label
                                    key={entry.id}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      fontSize: 12,
                                      color: shell.textMuted,
                                      cursor: "pointer",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedUploadedIds.has(entry.id)}
                                      onChange={() => toggleUploadedEntry(entry.id)}
                                    />
                                    {label}
                                    {uploadedNameMode !== "full" &&
                                    label !== entry.fullName ? (
                                      <span style={{ opacity: 0.55, fontSize: 10 }}>
                                        ({entry.fullName})
                                      </span>
                                    ) : null}
                                  </label>
                                );
                              })}
                            </div>
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {hasProjectRoster ? (
                <div
                  style={{
                    marginBottom: 12,
                    border: `1px solid ${shell.border}`,
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setRosterExpanded((v) => !v)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      background: "#0f172a",
                      border: "none",
                      color: shell.text,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>プロジェクト名簿（{projectHintBuild.hints.length} 名選択中）</span>
                    <span style={{ color: shell.textMuted, fontSize: 11 }}>
                      {rosterExpanded ? "▲" : "▼"}
                    </span>
                  </button>
                  {rosterExpanded ? (
                    <div style={{ padding: "8px 12px 10px" }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 12,
                          color: shell.text,
                          marginBottom: 8,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={useProjectRosterHints}
                          onChange={(e) => setUseProjectRosterHints(e.target.checked)}
                        />
                        プロジェクト名簿をヒントとして使う
                      </label>
                      {projectRosterIsNumeric ? (
                        <p
                          style={{
                            margin: "0 0 8px",
                            fontSize: 11,
                            color: "#fbbf24",
                            lineHeight: 1.45,
                          }}
                        >
                          プロジェクト名簿が番号のみです。本名は上の「名簿をアップロード」から読み込んでください。
                        </p>
                      ) : null}
                      {useProjectRosterHints ? (
                        <>
                          <RosterNameModePicker
                            mode={projectNameMode}
                            onChange={setProjectNameMode}
                          />
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              marginBottom: 8,
                            }}
                          >
                            <button
                              type="button"
                              onClick={selectAllRoster}
                              style={{
                                ...btnSecondary,
                                padding: "4px 10px",
                                fontSize: 11,
                              }}
                            >
                              全選択
                            </button>
                            <button
                              type="button"
                              onClick={clearAllRoster}
                              style={{
                                ...btnSecondary,
                                padding: "4px 10px",
                                fontSize: 11,
                              }}
                            >
                              全解除
                            </button>
                          </div>
                          <div
                            style={{
                              maxHeight: 160,
                              overflow: "auto",
                              display: "flex",
                              flexDirection: "column",
                              gap: 10,
                            }}
                          >
                            {rosterGroups.map((group) => (
                              <div key={group.id}>
                                {rosterGroups.length > 1 ? (
                                  <div
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: "#94a3b8",
                                      marginBottom: 4,
                                    }}
                                  >
                                    {group.name}
                                  </div>
                                ) : null}
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "4px 10px",
                                  }}
                                >
                                  {group.members.map((m) => {
                                    const entry = projectRosterEntries.find(
                                      (e) => e.id === m.id
                                    );
                                    const label = entry
                                      ? hintLabelForEntry(entry, projectNameMode)
                                      : m.label;
                                    return (
                                      <label
                                        key={m.id}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                          fontSize: 12,
                                          color: shell.textMuted,
                                          cursor: "pointer",
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={selectedRosterIds.has(m.id)}
                                          onChange={() => toggleRosterMember(m.id)}
                                        />
                                        {label}
                                        {entry &&
                                        projectNameMode !== "full" &&
                                        label !== entry.fullName ? (
                                          <span style={{ opacity: 0.55, fontSize: 10 }}>
                                            ({entry.fullName})
                                          </span>
                                        ) : null}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p
                          style={{
                            margin: 0,
                            fontSize: 11,
                            color: shell.textMuted,
                            lineHeight: 1.45,
                          }}
                        >
                          名簿ヒントなしで読み取ります（手書きの名前をそのまま使います）。
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
                style={{ display: "none" }}
                onChange={(e) => void handleFileChange(e)}
              />
              <button
                type="button"
                onClick={handlePickClick}
                disabled={busy || project.viewMode === "view" || !canParseImages}
                style={{
                  ...btnAccent,
                  width: "100%",
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? "画像を解析中…" : "画像を選ぶ（複数可）"}
              </button>
              {!uploadedModeReady ? (
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 11,
                    color: "#fbbf24",
                  }}
                >
                  名簿読み込み後、読み取り表記（フルネーム / 苗字のみ / 名のみ）を選んでから画像を選んでください。
                </p>
              ) : hintsEnabled && !hintsReady ? (
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 11,
                    color: "#fbbf24",
                  }}
                >
                  名簿ヒントを使う場合は、名簿をアップロードするか、少なくとも 1 名を選択してください。
                </p>
              ) : null}
              {memberNameHints.length > 0 ? (
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 11,
                    color: "#93c5fd",
                    lineHeight: 1.45,
                  }}
                >
                  解析ヒント: {memberNameHints.length} 名
                  {uploadedNameMode !== "full" && useUploadedRosterHints && hasUploadedRoster
                    ? ` · アップロード名簿=${NAME_MODE_OPTIONS.find((o) => o.value === uploadedNameMode)?.label}`
                    : ""}
                  {projectNameMode !== "full" && useProjectRosterHints && hasProjectRoster
                    ? ` · プロジェクト名簿=${NAME_MODE_OPTIONS.find((o) => o.value === projectNameMode)?.label}`
                    : ""}
                  <br />
                  選択した表記で画像を読み取り、確定時はフルネームでキューに登録します
                </p>
              ) : null}
              {loading ? (
                <p
                  role="status"
                  style={{
                    margin: "12px 0 0",
                    fontSize: 12,
                    color: "#93c5fd",
                    textAlign: "center",
                    lineHeight: 1.5,
                  }}
                >
                  {parseProgress
                    ? `解析中 ${parseProgress.current}/${parseProgress.total}: ${parseProgress.fileName}`
                    : "OpenAI で立ち位置を読み取っています。"}
                  <br />
                  複数枚の場合は順番に処理します。数十秒かかることがあります…
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: shell.textMuted }}>
                {sourceFileNames.length > 0
                  ? `ファイル: ${sourceFileNames.join("、")}`
                  : null}
                {sourceFileNames.length > 0 ? " · " : null}
                キュー開始: {formatSec(currentTimeSec)} · {preview.length} 人
                {memberNameHints.length > 0
                  ? ` · 名簿ヒント ${memberNameHints.length} 名`
                  : null}
              </p>
              <PositionPreviewThumb positions={preview} />
              {previewLines && previewLines.length > 0 ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "#0f172a",
                    border: "1px solid #334155",
                    fontSize: 11,
                    color: shell.textMuted,
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 600, color: shell.text, marginBottom: 4 }}>
                    列ごとの読取（名簿名寄せ済み）
                  </div>
                  {previewLines.map((line, i) => (
                    <div key={`line-${i}`}>
                      列{i + 1}（{line.count}人）: {line.names.join(" · ")}
                    </div>
                  ))}
                </div>
              ) : null}
              {countMismatches.length > 0 ? (
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 11,
                    color: "#fbbf24",
                    lineHeight: 1.45,
                  }}
                >
                  列の人数が画像と一致しません。内容を確認してから確定してください。
                </p>
              ) : null}
              <label
                style={{
                  display: "block",
                  marginTop: 12,
                  fontSize: 12,
                  color: shell.textMuted,
                }}
              >
                フォーメーション名
                <input
                  type="text"
                  value={formationName}
                  onChange={(e) => setFormationName(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #334155",
                    background: "#0a0f1e",
                    color: shell.text,
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </label>
              <div
                style={{
                  marginTop: 12,
                  maxHeight: 220,
                  overflow: "auto",
                  border: "1px solid #334155",
                  borderRadius: 8,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#0f172a", color: "#94a3b8" }}>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>#</th>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>名前</th>
                      <th style={{ textAlign: "center", padding: "8px 6px" }}>確度</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>X%</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>Y%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p, i) => (
                      <tr key={`${p.name}-${i}`} style={{ borderTop: "1px solid #1e293b" }}>
                        <td style={{ padding: "6px 10px", color: "#64748b" }}>{i + 1}</td>
                        <td style={{ padding: "6px 10px", color: shell.text }}>{p.name}</td>
                        <td
                          style={{
                            padding: "6px 6px",
                            textAlign: "center",
                            color: p.confidence === "low" ? "#fbbf24" : "#64748b",
                            fontSize: 11,
                          }}
                        >
                          {p.confidence === "low"
                            ? p.rosterMatched
                              ? "名寄せ"
                              : "推測"
                            : "—"}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>{p.x.toFixed(1)}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right" }}>{p.y.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {error || rosterUploadError ? (
            <p
              role="alert"
              style={{
                margin: "12px 0 0",
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.35)",
                color: "#fecaca",
                fontSize: 12,
                lineHeight: 1.45,
                whiteSpace: "pre-line",
              }}
            >
              {error ?? rosterUploadError}
            </p>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            padding: "12px 20px 16px",
            borderTop: `1px solid ${shell.border}`,
          }}
        >
          {preview ? (
            <>
              <button
                type="button"
                style={btnSecondary}
                disabled={busy}
                onClick={() => {
                  resetState();
                }}
              >
                やり直す
              </button>
              <button
                type="button"
                style={btnAccent}
                disabled={busy}
                onClick={handleConfirm}
              >
                確定してキューに追加
              </button>
            </>
          ) : (
            <button type="button" style={btnSecondary} disabled={busy} onClick={onClose}>
              キャンセル
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
