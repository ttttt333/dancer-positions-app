import type { CSSProperties, ComponentProps, Dispatch, SetStateAction } from "react";
import type { ChoreographyProjectJson, Cue } from "../types/choreography";
import type { FloorTextPlaceSession } from "../components/StageBoard";
import { btnAccent, btnSecondary, btnToolSquare, btnSelected, btnDisabled, iconBase, sectionContainer, gridContainer, iconStage, iconCue, iconMember, iconShare, btnStage, btnCue, btnMember, btnShare } from "../components/stageButtonStyles";
import { ChoreoCoreToolbar } from "./ChoreoCoreToolbar";
import { 
  Settings,
  Save,
  List,
  Users,
  Share2,
  Cloud,
  Download,
  Eye,
  Undo,
  Redo,
  Upload,
  X,
  Type,
  Plus,
  Search,
  ArrowUp,
  Monitor,
  MapPin,
  Flag,
  Grid3x3,
  Magnet,
  Music,
  Folder,
  FileText,
  HelpCircle,
  Package
} from "lucide-react";

export type EditorWorkbenchChoreoToolbarProps = Omit<
  ComponentProps<typeof ChoreoCoreToolbar>,
  "layout" | "embedInPanel" | "tilesInRun" | "singleTile" | "dense"
>;

export type WorkbenchCuePagerVariant = "rail" | "inline" | "stageCorner";

export type WorkbenchCuePagerProps = {
  variant: WorkbenchCuePagerVariant;
  project: ChoreographyProjectJson;
  cuesSortedForStageJump: Cue[];
  selectedCueId: string | null;
  /**
   * ページインデックス。`includeRosterSlot` のとき 0 = 名簿ページ、1..n = ソート済みキュー n-1。
   * 名簿なしのときはキュー index のみ。
   */
  jumpToPagerSlot: (slotIdx: number) => void;
  /** true のとき先頭スロットが名簿（タイムラインを隠す画面） */
  includeRosterSlot?: boolean;
  /** `project.rosterHidesTimeline` — 名簿ページがアクティブ */
  rosterTimelineHidden?: boolean;
};

export function WorkbenchCuePager({
  variant,
  project,
  cuesSortedForStageJump,
  selectedCueId,
  jumpToPagerSlot,
  includeRosterSlot = false,
  rosterTimelineHidden = false,
}: WorkbenchCuePagerProps) {
  const isRail = variant === "rail";
  const isCorner = variant === "stageCorner";
  const total = includeRosterSlot
    ? cuesSortedForStageJump.length + 1
    : cuesSortedForStageJump.length;
  if (total <= 0) return null;

  const cueIdx = selectedCueId
    ? cuesSortedForStageJump.findIndex((c) => c.id === selectedCueId)
    : -1;
  let slotIdx: number;
  if (includeRosterSlot) {
    if (rosterTimelineHidden) slotIdx = 0;
    else if (cueIdx >= 0) slotIdx = cueIdx + 1;
    else slotIdx = -1;
  } else {
    slotIdx = cueIdx;
  }

  const cur =
    includeRosterSlot && slotIdx === 0
      ? null
      : includeRosterSlot && slotIdx > 0
        ? cuesSortedForStageJump[slotIdx - 1] ?? null
        : !includeRosterSlot && slotIdx >= 0
          ? cuesSortedForStageJump[slotIdx] ?? null
          : null;

  const rosterPageActive = includeRosterSlot && slotIdx === 0;
  const pageHighlight =
    rosterPageActive || (slotIdx >= 0 && cur != null && !rosterPageActive);

  const cueCount = cuesSortedForStageJump.length;
  /** 名簿スロットありのとき、先頭キューは一覧の「1」と同じくページ表示も 1 始まり（0=名簿は別表示） */
  const pagerFractionLabel =
    rosterPageActive && includeRosterSlot
      ? `名簿 / ${total}`
      : slotIdx >= 0
        ? includeRosterSlot
          ? `${slotIdx} / ${cueCount}`
          : `${slotIdx + 1} / ${total}`
        : `— / ${total}`;

  const canPrev = project.viewMode !== "view" && slotIdx > 0;
  /** 未選択（slotIdx === -1）のときも「次」で先頭キューへ入れる（波形クリックで選択が空になったあとなど） */
  const canNext =
    project.viewMode !== "view" &&
    (slotIdx < 0
      ? cuesSortedForStageJump.length > 0
      : slotIdx >= 0 && slotIdx < total - 1);
  const navBtnStyle = (enabled: boolean): CSSProperties =>
    isRail
      ? {
          width: "48px",
          height: "48px",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          border: "1px solid #334155",
          background: "#0f172a",
          color: enabled ? "#cbd5e1" : "#475569",
          fontSize: "15px",
          lineHeight: 1,
          flexDirection: "row",
          cursor: enabled ? "pointer" : "not-allowed",
          flexShrink: 0,
        }
      : isCorner
        ? {
            width: "24px",
            height: "24px",
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "6px",
            border: "1px solid #475569",
            background: "#0f172a",
            color: enabled ? "#e2e8f0" : "#475569",
            fontSize: "12px",
            lineHeight: 1,
            cursor: enabled ? "pointer" : "not-allowed",
            flexShrink: 0,
          }
        : {
            width: "26px",
            height: "26px",
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "6px",
            border: "1px solid #334155",
            background: "#0f172a",
            color: enabled ? "#cbd5e1" : "#475569",
            fontSize: "14px",
            lineHeight: 1,
            cursor: enabled ? "pointer" : "not-allowed",
            flexShrink: 0,
          };
  const core = (
    <div
      className={isRail ? "editor-right-cue-pager" : undefined}
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: isRail ? "column" : "row",
        alignItems: "center",
        gap: isRail ? "6px" : isCorner ? "3px" : "4px",
        flexShrink: 0,
        width: isRail ? 48 : undefined,
      }}
      title="ステージのキュー（ページ）切替。名簿があるとき先頭は名簿。波形の再生位置も区間の頭に移動します。"
    >
      <button
        type="button"
        onClick={() => jumpToPagerSlot(slotIdx - 1)}
        disabled={!canPrev}
        title={includeRosterSlot && slotIdx === 1 ? "名簿ページへ" : "前のページへ"}
        aria-label={includeRosterSlot && slotIdx === 1 ? "名簿ページへ" : "前のページへ"}
        style={navBtnStyle(canPrev)}
      >
        ◀
      </button>
      <div
        role="status"
        aria-label={
          rosterPageActive
            ? `名簿ページ、全 ${total} ページ`
            : includeRosterSlot && slotIdx > 0
              ? `キュー ${slotIdx} / ${cueCount}`
              : `ページ ${slotIdx >= 0 ? slotIdx + 1 : "未選択"} / ${total}`
        }
        title={
          rosterPageActive
            ? "名簿メンバーの配置・並び替え"
            : cur
              ? cur.name?.trim()
                ? `「${cur.name.trim()}」を編集中`
                : "無名のキューを編集中"
              : "タイムラインなどからキューを選択"
        }
        style={
          isRail
            ? {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1px",
                width: "48px",
                height: "48px",
                maxWidth: "48px",
                padding: "4px 2px",
                borderRadius: "8px",
                border: pageHighlight ? "1px solid #818cf8" : "1px solid #334155",
                background: pageHighlight ? "rgba(99,102,241,0.18)" : "#0f172a",
                color: pageHighlight ? "#e0e7ff" : "#94a3b8",
                fontSize: "7px",
                fontWeight: 700,
                lineHeight: 1.1,
                cursor: "default",
                flexShrink: 0,
                fontVariantNumeric: "tabular-nums",
                textAlign: "center",
                overflow: "hidden",
                wordBreak: "break-word",
              }
            : isCorner
              ? {
                  display: "inline-flex",
                  alignItems: "center",
                  gap:
                    (rosterPageActive || (cur && cur.name?.trim())) ? "4px" : "0",
                  padding: "2px 5px",
                  minHeight: "22px",
                  borderRadius: "6px",
                  border: pageHighlight ? "1px solid #818cf8" : "1px solid #475569",
                  background: pageHighlight ? "rgba(99,102,241,0.22)" : "#0f172a",
                  color: pageHighlight ? "#e0e7ff" : "#94a3b8",
                  fontSize: "10px",
                  fontWeight: 700,
                  cursor: "default",
                  flexShrink: 0,
                  maxWidth: "112px",
                  fontVariantNumeric: "tabular-nums",
                }
              : {
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 9px",
                  borderRadius: "8px",
                  border: pageHighlight ? "1px solid #818cf8" : "1px solid #334155",
                  background: pageHighlight ? "rgba(99,102,241,0.18)" : "#0f172a",
                  color: pageHighlight ? "#e0e7ff" : "#94a3b8",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "default",
                  flexShrink: 0,
                  minHeight: "26px",
                  maxWidth: "240px",
                  fontVariantNumeric: "tabular-nums",
                }
        }
      >
        {!isCorner && !rosterPageActive ? (
          <span
            style={{
              fontSize: isRail ? "6.5px" : "9px",
              color: pageHighlight ? "#c7d2fe" : "#64748b",
              letterSpacing: isRail ? 0 : "0.04em",
              lineHeight: 1.1,
            }}
          >
            キュー
          </span>
        ) : null}
        <span
          style={
            isRail
              ? {
                  whiteSpace: "normal",
                  textAlign: "center",
                  lineHeight: 1.1,
                }
              : { whiteSpace: "nowrap" }
          }
        >
          {pagerFractionLabel}
        </span>
        {rosterPageActive ? null : cur && cur.name?.trim() ? (
          <span
            style={{
              fontSize: isRail ? "6.5px" : isCorner ? "9px" : "11px",
              fontWeight: 500,
              color: "#e2e8f0",
              overflow: "hidden",
              display: isRail ? "-webkit-box" : undefined,
              WebkitLineClamp: isRail ? 2 : undefined,
              WebkitBoxOrient: isRail ? "vertical" : undefined,
              textOverflow: "ellipsis",
              whiteSpace: isRail ? "normal" : "nowrap",
              maxWidth: isRail ? "100%" : isCorner ? "72px" : "120px",
              lineHeight: 1.08,
              textAlign: "center",
            }}
          >
            {cur.name.trim()}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() =>
          jumpToPagerSlot(
            slotIdx < 0 ? (includeRosterSlot ? 1 : 0) : slotIdx + 1
          )
        }
        disabled={!canNext}
        title={
          includeRosterSlot && slotIdx === 0
            ? "次のキューへ"
            : "次のページへ"
        }
        aria-label={
          includeRosterSlot && slotIdx === 0
            ? "次のキューへ"
            : "次のページへ"
        }
        style={navBtnStyle(canNext)}
      >
        ▶
      </button>
    </div>
  );
  if (isCorner) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "stretch",
          padding: "2px 4px",
          borderRadius: "8px",
          border: "1px solid rgba(148, 163, 184, 0.3)",
          background: "rgba(15, 23, 42, 0.88)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      >
        {core}
      </div>
    );
  }
  return core;
}

export type EditorStageWorkbenchProps = {
  layout: "stage" | "rail";
  project: ChoreographyProjectJson;
  setProjectSafe: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  selectedCueId: string | null;
  selectedCue: Cue | null;
  stageAreaSettingsOpen: boolean;
  setStageAreaSettingsOpen: Dispatch<SetStateAction<boolean>>;
  stageUndoDisabled: boolean;
  stageRedoDisabled: boolean;
  undo: () => void;
  redo: () => void;
  setAddCueDialogOpen: Dispatch<SetStateAction<boolean>>;
  saveStageToFormationBox: () => void;
  setFlowLibraryOpen: Dispatch<SetStateAction<boolean>>;
  addDancerFromStageToolbar: () => void;
  importCrewCsvFromStageToolbar: () => void;
  stageView: "2d" | "3d";
  setStageView: Dispatch<SetStateAction<"2d" | "3d">>;
  floorTextPlaceSession: FloorTextPlaceSession | null;
  setFloorTextPlaceSession: Dispatch<SetStateAction<FloorTextPlaceSession | null>>;
  commitFloorTextPlace: () => void;
  hasRosterMembers: boolean;
  /** true のとき「テキスト」（床プレビュー配置）ボタンとその入力帯を出さない */
  hideFloorTextToolbar?: boolean;
  /** true のとき右レールの「戻る」「進む」を出さない（上部ドックと重複しないため） */
  hideUndoRedoInRail?: boolean;
  /** 右レール用: ChoreoCore の単体タイルに渡すプロップ */
  choreoToolbarProps?: EditorWorkbenchChoreoToolbarProps;
  /** 上部ドック時など: モーダルでキュー一覧を開く */
  onOpenCueListModal?: () => void;
  /** タイムラインの音源取込を開く */
  onOpenAudioImport?: () => void;
  /** 音源ボタンホバーで FFmpeg 先読み */
  onPreloadFfmpegForAudio?: () => void;
  /** ステージのみ全画面（波形・右列を隠す） */
  onEnterStageZen?: () => void;
  /** true のとき右レールに「拡大」を表示 */
  stageZenEligible?: boolean;
  /** ファイル共有（共同編集 URL / 閲覧 URL）のシートを開く */
  onOpenShareLinks?: () => void;
  /** 共有ボタンをグレーアウト（未保存など） */
  shareLinksButtonDisabled?: boolean;
  /** 右レール: 生徒用閲覧同様のメンバー強調＋共有（編集・/view 共通） */
  onOpenViewerMode?: () => void;
  /** 閲覧を開けないとき（通常は使わない） */
  viewerModeButtonDisabled?: boolean;
  /** クラウド保存の確認を開く（ログイン済み編集時のみ親から渡す） */
  onOpenCloudSave?: () => void;
  /** 保存処理中はクラウドボタンを無効化 */
  cloudSaveDisabled?: boolean;
  /** 右レール 2 行タイルの上段ラベル（例: クラウド） */
  cloudSaveRailLine1?: string;
  /** 右レール 2 行タイルの下段（例: 保存 / 上書き） */
  cloudSaveRailLine2?: string;
  /** 右レール・ツールチップ */
  cloudSaveRailTitle?: string;
  /** AIフォーメーション提案ダイアログを開く */
  onAiSuggest?: () => void;
};

export function EditorStageWorkbench(props: EditorStageWorkbenchProps) {
  const rail = props.layout === "rail";
  const {
    project,
    setProjectSafe,
    selectedCueId,
    stageAreaSettingsOpen,
    setStageAreaSettingsOpen,
    stageUndoDisabled,
    stageRedoDisabled,
    undo,
    redo,
    setAddCueDialogOpen,
    saveStageToFormationBox,
    setFlowLibraryOpen,
    addDancerFromStageToolbar,
    importCrewCsvFromStageToolbar,
    stageView,
    floorTextPlaceSession,
    setFloorTextPlaceSession,
    commitFloorTextPlace,
    hasRosterMembers,
    hideFloorTextToolbar = false,
    hideUndoRedoInRail = false,
    choreoToolbarProps,
    onOpenCueListModal,
    onOpenAudioImport,
    onPreloadFfmpegForAudio,
    onEnterStageZen,
    stageZenEligible = false,
    onOpenShareLinks,
    shareLinksButtonDisabled = false,
    onOpenViewerMode,
    viewerModeButtonDisabled = false,
    onOpenCloudSave,
    cloudSaveDisabled = false,
    cloudSaveRailLine1 = "",
    cloudSaveRailLine2 = "",
    cloudSaveRailTitle = "",
    onAiSuggest,
  } = props;

  const rowOuter: CSSProperties = rail
    ? {
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 10,
        width: "100%",
        minWidth: 0,
      }
    : {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        flexWrap: "wrap",
      };
  const cluster: CSSProperties = rail
    ? {
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 8,
        minWidth: 0,
        width: "100%",
      }
    : {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        flexWrap: "wrap",
        minWidth: 0,
      };
  const clusterEnd: CSSProperties = rail
    ? {
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 8,
        width: "100%",
        minWidth: 0,
      }
    : {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
        justifyContent: "flex-end",
      };
  const rootOuter: CSSProperties = rail
    ? {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginBottom: 0,
        width: "100%",
        minWidth: 0,
      }
    : {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        marginBottom: "4px",
      };

  /** 右列ホスト内では子を親の flex グリッドに直接参加させる */
  const rootStyle: CSSProperties = rail ? { display: "contents" } : rootOuter;

  const rowOuterStyle: CSSProperties = rail ? { display: "contents" } : rowOuter;
  const clusterStyle: CSSProperties = rail ? { display: "contents" } : cluster;
  const clusterEndStyle: CSSProperties = rail ? { display: "contents" } : clusterEnd;

  const viewModeRow: CSSProperties = {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    flexWrap: "wrap",
  };

  if (rail) {
    const choreo = choreoToolbarProps;
    const isView = project.viewMode === "view";

    // 共通ボタンスタイル生成
    function tileBtn(color: string, active = false) {
      return {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        width: "72px",
        height: "72px",
        borderRadius: "16px",
        border: `1px solid ${color}40`,
        background: active ? `${color}25` : "rgba(255,255,255,0.04)",
        backdropFilter: "blur(8px)",
        cursor: isView ? "not-allowed" : "pointer",
        opacity: isView ? 0.4 : 1,
        transition: "all 0.15s ease",
        gap: 0,
        padding: 0,
        flexShrink: 0,
      } as React.CSSProperties;
    }

    function sectionLabel(text: string) {
      return (
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: "rgba(148,163,184,0.7)",
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          padding: "4px 12px 2px",
          width: "100%",
        }}>
          {text}
        </div>
      );
    }

    return (
      <>
        <div
          className="editor-right-rail-stack"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 0,
            width: "100%",
            minWidth: 0,
          }}
        >

          {/* ── STAGE ── */}
          {sectionLabel("舞台・編集")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: "4px 10px 8px" }}>

            {/* 舞台設定 */}
            <button type="button"
              style={tileBtn("#8b5cf6", stageAreaSettingsOpen)}
              disabled={isView}
              title="舞台・客席・グリッド・名前の出し方・この URL の共有・ショートカット"
              onClick={() => setStageAreaSettingsOpen(true)}
            >
              <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                <path d="M3 18 L6 6 L18 6 L21 18 Z" stroke="#8b5cf6" strokeWidth="1.6" strokeLinejoin="round"/>
                <circle cx="9" cy="10" r="1.2" fill="#8b5cf6"/>
                <circle cx="12" cy="9.5" r="1.4" fill="#8b5cf6"/>
                <circle cx="15" cy="10" r="1.2" fill="#8b5cf6"/>
                <circle cx="10.5" cy="14" r="1" fill="#8b5cf6" opacity="0.7"/>
                <circle cx="13.5" cy="14" r="1" fill="#8b5cf6" opacity="0.7"/>
              </svg>
            </button>

            {/* キュー設定 */}
            <button type="button"
              style={tileBtn("#f59e0b")}
              disabled={isView}
              title="キュー設定"
              onClick={() => setStageAreaSettingsOpen(true)}
            >
              <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                <path d="M4 5h16M4 9h16M4 13h10" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M16 16 L22 20 L16 24 Z" fill="#f59e0b" transform="translate(-3,-6) scale(0.8)"/>
                <circle cx="18" cy="17" r="3.5" fill="none" stroke="#f59e0b" strokeWidth="1.5"/>
                <path d="M16.5 17 L17.5 18 L19.5 16" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* 立ち位置保存 */}
            <button type="button"
              style={tileBtn("#10b981")}
              disabled={isView}
              title="形の箱に今の立ち位置を保存"
              aria-label="形の箱に今の立ち位置を保存"
              onClick={() => saveStageToFormationBox()}
            >
              <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="#10b981" strokeWidth="1.6" fill="none"/>
                <circle cx="8.5" cy="10" r="1.5" fill="#10b981"/>
                <circle cx="15.5" cy="10" r="1.5" fill="#10b981"/>
                <circle cx="12" cy="14" r="1.8" fill="#10b981"/>
                <path d="M8.5 10 L12 14 L15.5 10" stroke="#10b981" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.5"/>
              </svg>
            </button>

            {/* テキスト */}
            {!hideFloorTextToolbar ? (
              <button type="button"
                style={tileBtn(floorTextPlaceSession ? "#38bdf8" : "#f59e0b", !!floorTextPlaceSession)}
                disabled={isView || stageView !== "2d" || (project.cues.length > 0 && !selectedCueId)}
                title={
                  stageView !== "2d" ? "床テキストは 2D 表示のときのみ使えます"
                  : project.cues.length > 0 && !selectedCueId ? "タイムラインでキューを選んでから使えます"
                  : floorTextPlaceSession ? "テキスト配置を終了します"
                  : "編集画面の好きな位置にテキストを置きます"
                }
                onClick={() => {
                  if (isView || stageView !== "2d") return;
                  if (project.cues.length > 0 && !selectedCueId) return;
                  setFloorTextPlaceSession(cur => cur ? null : { body: "", fontSizePx: 18, fontWeight: 600, xPct: 50, yPct: 22, color: "#fef08a", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", scale: 1 });
                }}
              >
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                  <path d="M4 7h16M12 7v10M8 17h8" stroke={floorTextPlaceSession ? "#38bdf8" : "#f59e0b"} strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M19 3 L21 5" stroke={floorTextPlaceSession ? "#38bdf8" : "#f59e0b"} strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
            ) : null}

            {/* 拡大（Zen） */}
            {stageZenEligible && onEnterStageZen ? (
              <button type="button"
                style={tileBtn("#8b5cf6")}
                disabled={isView}
                title="波形と右メニューを隠してステージだけを大きく表示（Esc で戻る）"
                aria-label="ステージを拡大表示"
                onClick={() => onEnterStageZen()}
              >
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                  <circle cx="11" cy="11" r="6.5" stroke="#8b5cf6" strokeWidth="1.6"/>
                  <path d="M16 16 L21 21" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M8.5 11 H13.5 M11 8.5 V13.5" stroke="#8b5cf6" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </button>
            ) : null}

            {/* 元に戻す */}
            {!hideUndoRedoInRail ? (
              <button type="button"
                style={tileBtn("#64748b")}
                disabled={isView || stageUndoDisabled}
                title="編集を元に戻す（⌘Z / Ctrl+Z）"
                aria-label="元に戻す"
                onClick={() => undo()}
              >
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                  <path d="M4 9 C4 5 8 3 12 3 C16 3 20 7 20 12 C20 17 16 21 12 21" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                  <path d="M4 9 L4 4 M4 9 L9 9" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </button>
            ) : null}

            {/* やり直す */}
            {!hideUndoRedoInRail ? (
              <button type="button"
                style={tileBtn("#64748b")}
                disabled={isView || stageRedoDisabled}
                title="やり直す（⌘⇧Z / Ctrl+Shift+Z）"
                aria-label="やり直す"
                onClick={() => redo()}
              >
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                  <path d="M20 9 C20 5 16 3 12 3 C8 3 4 7 4 12 C4 17 8 21 12 21" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                  <path d="M20 9 L20 4 M20 9 L15 9" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </button>
            ) : null}

            {/* グリッド吸着 (snap) */}
            {choreo?.onToggleSnapGrid ? (
              <button type="button"
                style={tileBtn("#8b5cf6", choreo.snapGrid)}
                title={`スナップ：格子点に自動整列 (${choreo.snapGrid ? "ON" : "OFF"})`}
                onClick={() => choreo.onToggleSnapGrid?.()}
              >
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                  <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" stroke={choreo.snapGrid ? "#a78bfa" : "#8b5cf6"} strokeWidth="1.5" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="2.5" fill={choreo.snapGrid ? "#a78bfa" : "#8b5cf6"} opacity={choreo.snapGrid ? 1 : 0.5}/>
                </svg>
              </button>
            ) : null}

          </div>

          {/* ── CUE ── */}
          {sectionLabel("キュー")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: "4px 10px 8px" }}>

            {/* キュー一覧 */}
            {onOpenCueListModal ? (
              <button type="button"
                style={tileBtn("#f59e0b")}
                disabled={isView}
                title="モーダルでキュー一覧を開きます"
                aria-label="キュー一覧を開く"
                onClick={() => onOpenCueListModal()}
              >
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                  <rect x="3" y="4" width="18" height="16" rx="2" stroke="#f59e0b" strokeWidth="1.5" fill="none"/>
                  <path d="M7 8h2M7 12h2M7 16h2" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 8h5M12 12h5M12 16h3" stroke="#f59e0b" strokeWidth="1.4" strokeLinecap="round" opacity="0.7"/>
                </svg>
              </button>
            ) : null}

            {/* 音源取込 */}
            {onOpenAudioImport ? (
              <button type="button"
                style={tileBtn("#ef4444")}
                disabled={isView}
                title="楽曲または動画から音声を読み込み（MP4 / AVI / MOV / MKV / WMV 等に対応）"
                aria-label="音源を取り込む"
                onPointerEnter={() => onPreloadFfmpegForAudio?.()}
                onClick={() => onOpenAudioImport?.()}
              >
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                  <path d="M3 12 Q6 6 9 12 Q12 18 15 12 Q18 6 21 12" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                  <path d="M12 18 L12 21 M10 21 L14 21" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            ) : null}

            {/* ライブラリ */}
            <button type="button"
              style={tileBtn("#3b82f6")}
              disabled={isView}
              title="今までの流れ（フォーメーションとキュー）をフローライブラリに保存します"
              onClick={() => setFlowLibraryOpen(true)}
            >
              <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                <path d="M3 5 C3 4 4 3 5 3 L14 3 L21 10 L21 19 C21 20 20 21 19 21 L5 21 C4 21 3 20 3 19 Z" stroke="#3b82f6" strokeWidth="1.5" fill="none"/>
                <path d="M14 3 L14 10 L21 10" stroke="#3b82f6" strokeWidth="1.4" fill="none"/>
                <path d="M7 13 L12 13 M7 17 L15 17" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M17 14 L19 13 L17 12" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* AI提案 */}
            {onAiSuggest && !isView ? (
              <button type="button"
                style={{
                  ...tileBtn("#a78bfa"),
                  background: "rgba(76,29,149,0.22)",
                  border: "1px solid rgba(167,139,250,0.5)",
                }}
                title="楽曲の構造を解析してフォーメーションをAIが提案します"
                aria-label="AIフォーメーション提案"
                onClick={() => onAiSuggest?.()}
              >
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                  <path d="M12 3 L13.8 9.2 L20 11 L13.8 12.8 L12 19 L10.2 12.8 L4 11 L10.2 9.2 Z" fill="#a78bfa" stroke="#a78bfa" strokeWidth="0.5" strokeLinejoin="round"/>
                  <path d="M19 3 L19.9 5.9 L22 7 L19.9 8.1 L19 11 L18.1 8.1 L16 7 L18.1 5.9 Z" fill="#c4b5fd" stroke="#c4b5fd" strokeWidth="0.3" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#a78bfa", marginTop: 3, lineHeight: 1 }}>AI提案</span>
              </button>
            ) : null}

          </div>

          {/* ── MEMBERS ── */}
          {sectionLabel("メンバー")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: "4px 10px 8px" }}>

            {/* ＋メンバー */}
            <button type="button"
              style={tileBtn("#10b981")}
              disabled={isView}
              title="選択中のフォーメーションにメンバーを1人追加（中央付近）"
              onClick={() => addDancerFromStageToolbar()}
            >
              <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                <circle cx="10" cy="8" r="3.5" stroke="#10b981" strokeWidth="1.6" fill="none"/>
                <path d="M3 20 C3 16 6 14 10 14 C11.5 14 12.9 14.4 14 15.1" stroke="#10b981" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
                <path d="M18 13 V19 M15 16 H21" stroke="#10b981" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            {/* 名簿取込 */}
            <button type="button"
              style={tileBtn("#06b6d4")}
              disabled={isView}
              title="CSV / TSV を選んで新しい名簿として取り込みます（1 列目または「名前」などの見出しを検出）"
              onClick={() => importCrewCsvFromStageToolbar()}
            >
              <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                <rect x="3" y="3" width="14" height="18" rx="2" stroke="#06b6d4" strokeWidth="1.5" fill="none"/>
                <path d="M6 7h8M6 11h8M6 15h5" stroke="#06b6d4" strokeWidth="1.3" strokeLinecap="round"/>
                <circle cx="18" cy="17" r="4" fill="none" stroke="#06b6d4" strokeWidth="1.4"/>
                <path d="M16.5 17 L17.5 18 L19.5 16" stroke="#06b6d4" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* メンバー表示 */}
            {hasRosterMembers && !project.rosterHidesTimeline ? (
              <button type="button"
                style={tileBtn("#10b981")}
                disabled={isView}
                title="右列で名簿一覧を表示し、タイムライン列は隠します"
                onClick={() => setProjectSafe(p => ({ ...p, rosterHidesTimeline: true, rosterStripCollapsed: false }))}
              >
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                  <circle cx="8" cy="8" r="3" stroke="#10b981" strokeWidth="1.5" fill="none"/>
                  <circle cx="16" cy="8" r="3" stroke="#10b981" strokeWidth="1.5" fill="none"/>
                  <path d="M2 20 C2 16.5 4.5 14 8 14" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  <path d="M22 20 C22 16.5 19.5 14 16 14" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  <path d="M8 14 C9.5 16 14.5 16 16 14" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                </svg>
              </button>
            ) : null}

          </div>

          {/* ── SHARE / OUTPUT ── */}
          {sectionLabel("共有・出力")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: "4px 10px 8px" }}>

            {/* 共有URL */}
            {onOpenShareLinks ? (
              <button type="button"
                style={tileBtn("#0ea5e9")}
                disabled={shareLinksButtonDisabled}
                title="チーム用（共同編集）か生徒用（閲覧）か選んで URL を発行"
                onClick={onOpenShareLinks}
              >
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                  <circle cx="18" cy="5" r="3" stroke="#0ea5e9" strokeWidth="1.5" fill="none"/>
                  <circle cx="6" cy="12" r="3" stroke="#0ea5e9" strokeWidth="1.5" fill="none"/>
                  <circle cx="18" cy="19" r="3" stroke="#0ea5e9" strokeWidth="1.5" fill="none"/>
                  <path d="M8.6 10.7 L15.4 6.3 M8.6 13.3 L15.4 17.7" stroke="#0ea5e9" strokeWidth="1.4"/>
                </svg>
              </button>
            ) : null}

            {/* クラウド保存 */}
            {onOpenCloudSave ? (
              <button type="button"
                style={tileBtn("#3b82f6")}
                disabled={isView || cloudSaveDisabled}
                title={cloudSaveRailTitle}
                aria-label={cloudSaveRailTitle}
                onClick={() => onOpenCloudSave()}
              >
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                  <path d="M18 15 C21 15 22 11 19 9 C19 6 16 4 13 5 C11 3 7 4 7 7.5 C4 8 3 12 6 13.5" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
                  <path d="M12 12 L12 21 M9 18 L12 21 L15 18" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ) : null}

            {/* 書き出し */}
            {choreo ? (
              <button type="button"
                style={tileBtn("#06b6d4")}
                title="書き出し（PNG / PDF / WebM / JSON）"
                onClick={() => choreo.onOpenExport?.()}
              >
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                  <rect x="4" y="3" width="16" height="13" rx="2" stroke="#06b6d4" strokeWidth="1.5" fill="none"/>
                  <path d="M8 6h4M8 9h6M8 12h3" stroke="#06b6d4" strokeWidth="1.3" strokeLinecap="round" opacity="0.7"/>
                  <path d="M8 19 L16 19 M12 16 L12 21 M9 18.5 L12 21 L15 18.5" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ) : null}

            {/* 閲覧モード */}
            {onOpenViewerMode ? (
              <button type="button"
                style={tileBtn("#38bdf8")}
                disabled={viewerModeButtonDisabled}
                title="表示する人を一人に強調。再生の確認とステージ画像の保存・共有"
                aria-label="閲覧モード（メンバー別の強調）"
                onClick={() => onOpenViewerMode()}
              >
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                  <path d="M2 12 C5 7 9 4 12 4 C15 4 19 7 22 12 C19 17 15 20 12 20 C9 20 5 17 2 12 Z" stroke="#38bdf8" strokeWidth="1.5" fill="none"/>
                  <circle cx="12" cy="12" r="3.5" stroke="#38bdf8" strokeWidth="1.5" fill="none"/>
                  <circle cx="12" cy="12" r="1.2" fill="#38bdf8"/>
                </svg>
              </button>
            ) : null}

            {/* 大道具 */}
            {choreo ? (
              <button type="button"
                style={tileBtn("#f97316")}
                title="大道具を追加（図形・色を選択）"
                onClick={() => choreo.onOpenSetPiecePicker?.()}
              >
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                  <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="#f97316" strokeWidth="1.5" fill="none"/>
                  <circle cx="17" cy="7" r="4" stroke="#f97316" strokeWidth="1.5" fill="none"/>
                  <path d="M3 17 L9 21 L21 13 L21 17 L9 21 L3 21 Z" stroke="#f97316" strokeWidth="1.4" strokeLinejoin="round" fill="none" opacity="0.5"/>
                  <rect x="12" y="14" width="10" height="6" rx="1" stroke="#f97316" strokeWidth="1.4" fill="none"/>
                </svg>
              </button>
            ) : null}

            {/* ヘルプ */}
            {choreo ? (
              <button type="button"
                style={tileBtn("#64748b")}
                title="キーボードショートカット一覧"
                onClick={() => choreo.onOpenShortcutsHelp?.()}
              >
                <svg viewBox="0 0 24 24" width={28} height={28} fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="9.5" stroke="#64748b" strokeWidth="1.5" fill="none"/>
                  <path d="M9.5 9.5 C9.5 7.8 11 6.5 12.5 6.5 C14 6.5 15.5 7.7 15.5 9.3 C15.5 11.5 12.5 11.5 12.5 13.5" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  <circle cx="12.5" cy="17" r="1" fill="#64748b"/>
                </svg>
              </button>
            ) : null}

          </div>

          {/* Floor text session toolbar */}
          {!hideFloorTextToolbar && floorTextPlaceSession ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", padding: "8px 10px", marginTop: 4, borderTop: "1px solid #334155", width: "100%", boxSizing: "border-box" }}>
              <textarea
                value={floorTextPlaceSession?.body || ""}
                onChange={(e) => setFloorTextPlaceSession(s => s ? { ...s, body: e.target.value } : s)}
                rows={2}
                aria-label="編集画面に表示するテキスト"
                placeholder=""
                style={{ flex: "1 1 220px", minWidth: 180, maxWidth: 520, fontSize: 12, padding: "6px 8px", borderRadius: 8, border: "1px solid #475569", background: "#0f172a", color: "#e2e8f0", resize: "vertical" }}
              />
              <input type="number" min={8} max={56}
                aria-label="床テキストのフォントサイズ（ピクセル）"
                value={floorTextPlaceSession?.fontSizePx || 18}
                onChange={(e) => setFloorTextPlaceSession(s => s ? { ...s, fontSizePx: Math.round(Math.min(56, Math.max(8, Number(e.target.value) || 18))) } : s)}
                style={{ width: 64, padding: "4px 6px", borderRadius: 6, border: "1px solid #475569", background: "#0f172a", color: "#e2e8f0", fontSize: 12 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => commitFloorTextPlace()} title="テキストを配置して確定"
                  style={{ ...tileBtn("#22c55e"), width: 52, height: 40 }}>
                  <Save size={18} strokeWidth={1.5} style={{ color: "#22c55e" }} />
                </button>
                <button type="button" onClick={() => setFloorTextPlaceSession(null)} title="テキスト配置をキャンセル"
                  style={{ ...tileBtn("#ef4444"), width: 52, height: 40 }}>
                  <X size={18} strokeWidth={1.5} style={{ color: "#ef4444" }} />
                </button>
              </div>
            </div>
          ) : null}

        </div>
      </>
    );
  }

  return (
    <div style={rootStyle}>
      {/* 1 行目: タイトル／選択情報 + 主要アクション */}
      <div style={rowOuterStyle}>
        <div style={clusterStyle}>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={stageAreaSettingsOpen}
            disabled={project.viewMode === "view"}
            title="舞台・客席・グリッド・名前の出し方・この URL の共有・ショートカット"
            onClick={() => setStageAreaSettingsOpen(true)}
            style={{
              fontSize: "11px",
        lineHeight: 1.2,
        padding: "4px 10px",
        borderRadius: "6px",
        border: "1px solid #475569",
        background: "#1e293b",
        color: "#e2e8f0",
        cursor:
          project.viewMode === "view" ? "not-allowed" : "pointer",
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      舞台設定
    </button>
        </div>
        <div
          style={clusterEndStyle}
          title="右のタイムラインでキューを選ぶと、その区間の立ち位置を編集します。再生中は区間の隙間のみ補間表示されます。"
        >
          {!rail ? (
            <div
              style={{
                width: "1px",
                height: "22px",
                background: "#334155",
                flexShrink: 0,
              }}
              aria-hidden
            />
          ) : null}
    {!hideUndoRedoInRail ? (
      <>
        <button
          type="button"
          style={btnSecondary}
          disabled={project.viewMode === "view" || stageUndoDisabled}
          title="編集を元に戻す（⌘Z / Ctrl+Z）"
          aria-label="元に戻す"
          onClick={() => undo()}
        >
          戻る
        </button>
        <button
          type="button"
          style={btnSecondary}
          disabled={project.viewMode === "view" || stageRedoDisabled}
          title="やり直す（⌘⇧Z / Ctrl+Shift+Z）"
          aria-label="やり直す"
          onClick={() => redo()}
        >
          進む
        </button>
      </>
    ) : null}
    <button
      type="button"
      style={{
        ...btnSecondary,
        borderColor: "#0284c7",
        background: "#0ea5e9",
        color: "#0b1220",
        padding: "6px 10px",
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontWeight: 700,
      }}
      disabled={project.viewMode === "view"}
      title="＋キュー：人数と立ち位置の決め方（変更／複製／雛形／保存リスト）を選んで追加"
      aria-label="新しいキューを追加"
      onClick={() => setAddCueDialogOpen(true)}
    >
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        aria-hidden
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id="cueSettingsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="9" stroke="url(#cueSettingsGradient)" strokeWidth="2" fill="none" />
        {/* 時計の針 */}
        <line x1="12" y1="12" x2="12" y2="6" stroke="url(#cueSettingsGradient)" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="12" x2="16" y2="14" stroke="url(#cueSettingsGradient)" strokeWidth="1.5" strokeLinecap="round" />
        {/* ギアの中心 */}
        <circle cx="12" cy="12" r="1.5" fill="url(#cueSettingsGradient)" />
        {/* 音符 */}
        <circle cx="18" cy="8" r="2" fill="url(#cueSettingsGradient)" />
        <line x1="18" y1="10" x2="18" y2="14" stroke="url(#cueSettingsGradient)" strokeWidth="1.5" />
        <rect x="17" y="14" width="2" height="3" fill="url(#cueSettingsGradient)" />
      </svg>
      <span style={{ fontSize: "12px", fontWeight: 700 }}>キュー設定</span>
    </button>
    <button
      type="button"
      style={btnSecondary}
      disabled={project.viewMode === "view"}
      title="今までの流れ（フォーメーションとキュー）をフローライブラリに保存します"
      onClick={() => setFlowLibraryOpen(true)}
    >
      ライブラリ
    </button>
    <button
      type="button"
      style={btnSecondary}
      disabled={project.viewMode === "view"}
      title="選択中のフォーメーションにメンバーを1人追加（中央付近）"
      onClick={() => addDancerFromStageToolbar()}
    >
      ＋メンバー
    </button>
    <button
      type="button"
      style={btnSecondary}
      disabled={project.viewMode === "view"}
      title="CSV / TSV を選んで新しい名簿として取り込みます（1 列目または「名前」などの見出しを検出）"
      onClick={() => importCrewCsvFromStageToolbar()}
    >
      名簿取り込み
    </button>
    {!rail ? (
      <div
        style={{
          width: "1px",
          height: "22px",
          background: "#334155",
          flexShrink: 0,
        }}
        aria-hidden
      />
    ) : null}
    <div style={viewModeRow}>
      <button
        type="button"
        style={{
          ...btnSecondary,
          ...(floorTextPlaceSession
            ? { borderColor: "#38bdf8", color: "#e0f2fe" }
            : {}),
        }}
        disabled={
          project.viewMode === "view" ||
          stageView !== "2d" ||
          (project.cues.length > 0 && !selectedCueId)
        }
        title={
          stageView !== "2d"
            ? "床テキストは 2D 表示のときのみ使えます"
            : project.cues.length > 0 && !selectedCueId
              ? "タイムラインでキューを選んでから使えます"
              : floorTextPlaceSession
                ? "テキスト配置を終了します"
                : "編集画面の好きな位置にテキストを置きます（ドラッグ・空所クリックで移動）"
        }
        onClick={() => {
          if (project.viewMode === "view") return;
          if (stageView !== "2d") return;
          if (project.cues.length > 0 && !selectedCueId) return;
          setFloorTextPlaceSession((cur) =>
            cur
              ? null
              : {
                  body: "",
                  fontSizePx: 18,
                  fontWeight: 600,
                  xPct: 50,
                  yPct: 22,
                  color: "#fef08a",
                  fontFamily:
                    "system-ui, -apple-system, 'Segoe UI', sans-serif",
                  scale: 1,
                }
          );
        }}
      >
        {floorTextPlaceSession ? "テキストやめる" : "テキスト"}
      </button>
      {hasRosterMembers && !project.rosterHidesTimeline ? (
        <button
          type="button"
          disabled={project.viewMode === "view"}
          title="右列で名簿一覧を表示し、タイムライン列は隠します"
          onClick={() =>
            setProjectSafe((p) => ({
              ...p,
              rosterHidesTimeline: true,
              rosterStripCollapsed: false,
            }))
          }
          style={{
            fontSize: "11px",
            padding: "4px 10px",
            borderRadius: "8px",
            border: "1px solid #14532d",
            background: "#14532d",
            color: "#dcfce7",
            cursor:
              project.viewMode === "view"
                ? "not-allowed"
                : "pointer",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          メンバーを表示
        </button>
      ) : null}
      {!rail && (onOpenViewerMode || onOpenShareLinks || onOpenCloudSave) ? (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
          }}
        >
          {onOpenViewerMode ? (
            <button
              type="button"
              disabled={viewerModeButtonDisabled}
              title="表示する人を一人に強調。再生の確認とステージ画像の保存・共有"
              onClick={() => onOpenViewerMode()}
              style={{
                ...btnSecondary,
                background: "rgba(186, 230, 253, 0.1)",
                borderColor: "rgba(56, 189, 248, 0.4)",
                color: "#e0f2fe",
                fontSize: "11px",
                padding: "4px 10px",
                borderRadius: "8px",
                fontWeight: 600,
                whiteSpace: "nowrap",
                cursor: viewerModeButtonDisabled ? "not-allowed" : "pointer",
                opacity: viewerModeButtonDisabled ? 0.5 : 1,
              }}
            >
              閲覧
            </button>
          ) : null}
          {onOpenShareLinks ? (
            <button
              type="button"
              disabled={shareLinksButtonDisabled}
              title="チーム用（共同編集）か生徒用（閲覧）か選んで URL を発行"
              onClick={onOpenShareLinks}
              style={{
                ...btnSecondary,
                borderColor: "rgba(14, 165, 233, 0.55)",
                color: "#e0f2fe",
                fontSize: "11px",
                padding: "4px 10px",
                borderRadius: "8px",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              共有URL
            </button>
          ) : null}
          {onOpenCloudSave ? (
            <button
              type="button"
              disabled={project.viewMode === "view" || cloudSaveDisabled}
              title={cloudSaveRailTitle}
              aria-label={cloudSaveRailTitle}
              onClick={() => onOpenCloudSave()}
              style={{
                ...btnAccent,
                fontSize: "11px",
                padding: "4px 10px",
                borderRadius: "8px",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {cloudSaveRailLine1}
              {cloudSaveRailLine2 ? ` ${cloudSaveRailLine2}` : ""}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
      {!hideFloorTextToolbar && floorTextPlaceSession ? (
        <div
          style={{
            flexBasis: "100%",
            width: "100%",
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "flex-end",
            paddingTop: "8px",
            marginTop: "4px",
            borderTop: "1px solid #334155",
          }}
        >
          <textarea
            value={floorTextPlaceSession.body}
            onChange={(e) =>
              setFloorTextPlaceSession((s) =>
                s ? { ...s, body: e.target.value } : s
              )
            }
            rows={2}
            aria-label="編集画面に表示するテキスト"
            placeholder=""
            style={{
              flex: "1 1 220px",
              minWidth: "180px",
              maxWidth: "520px",
              fontSize: "12px",
              padding: "6px 8px",
              borderRadius: "8px",
              border: "1px solid #475569",
              background: "#0f172a",
              color: "#e2e8f0",
              resize: "vertical",
            }}
          />
          <input
            type="number"
            min={8}
            max={56}
            aria-label="床テキストのフォントサイズ（ピクセル）"
            value={floorTextPlaceSession.fontSizePx}
            onChange={(e) =>
              setFloorTextPlaceSession((s) =>
                s
                  ? {
                      ...s,
                      fontSizePx: Math.round(
                        Math.min(
                          56,
                          Math.max(8, Number(e.target.value) || 18)
                        )
                      ),
                    }
                  : s
              )
            }
            style={{
              width: "64px",
              padding: "4px 6px",
              borderRadius: "6px",
              border: "1px solid #475569",
              background: "#0f172a",
              color: "#e2e8f0",
              fontSize: "12px",
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              flex: "1 1 200px",
              minWidth: "160px",
            }}
          >
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => commitFloorTextPlace()}
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "1px solid #15803d",
                  background: "#22c55e",
                  color: "#052e16",
                  cursor: "pointer",
                }}
              >
                完了
              </button>
              <button
                type="button"
                onClick={() => setFloorTextPlaceSession(null)}
                style={btnSecondary}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  </div>
);
}
