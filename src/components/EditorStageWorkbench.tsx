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

    return (
      <>
        <div
          className="editor-right-rail-stack"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            width: "100%",
            minWidth: 0,
          }}
        >
          <div className="grid grid-cols-3 gap-4 p-3 w-full place-items-center">
          <button
            type="button"
            className="editor-right-tool-sq"
            style={{
              ...btnToolSquare,
              ...btnStage,
              ...(project.viewMode === "view" ? btnDisabled : {})
            }}
            disabled={project.viewMode === "view"}
            title="形の箱に今の立ち位置を保存"
            aria-label="形の箱に今の立ち位置を保存"
            onClick={() => saveStageToFormationBox()}
          >
            <MapPin 
              size={20} 
              style={{ 
                ...iconStage
              }} 
            />
          </button>
          <button
            type="button"
            className="editor-right-tool-sq"
            style={{
              ...btnToolSquare,
              ...btnStage,
              ...(project.viewMode === "view" ? btnDisabled : {}),
              ...(stageAreaSettingsOpen ? btnSelected : {})
            }}
            disabled={project.viewMode === "view"}
            title="舞台・客席・グリッド・名前の出し方・この URL の共有・ショートカット"
            onClick={() => setStageAreaSettingsOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" aria-hidden style={{ display: "block" }}>
              {/* 台形（舞台を上から見た形） */}
              <path
                d="M3 17 L6 6 L18 6 L21 17 Z"
                stroke="#8b5cf6"
                strokeWidth="1.5"
                strokeLinejoin="round"
                fill="none"
              />
              {/* 後列ダンサー（小さい丸・4つ） */}
              <circle cx="8.5"  cy="9.5" r="1" fill="#8b5cf6" />
              <circle cx="11"   cy="9.5" r="1" fill="#8b5cf6" />
              <circle cx="13.5" cy="9.5" r="1" fill="#8b5cf6" />
              <circle cx="16"   cy="9.5" r="1" fill="#8b5cf6" />
              {/* 前列ダンサー（大きい丸・3つ） */}
              <circle cx="9"    cy="14" r="1.5" fill="#8b5cf6" />
              <circle cx="12"   cy="13" r="1.8" fill="#8b5cf6" />
              <circle cx="15"   cy="14" r="1.5" fill="#8b5cf6" />
              {/* 支柱 */}
              <line x1="12" y1="17" x2="12" y2="20"
                stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="editor-right-tool-sq"
            style={{
              ...btnToolSquare,
              ...btnCue,
              ...(project.viewMode === "view" ? btnDisabled : {})
            }}
            disabled={project.viewMode === "view"}
            title="キュー設定"
            onClick={() => setStageAreaSettingsOpen(true)}
          >
            <Flag 
              size={20} 
              style={{ 
                ...iconCue
              }} 
            />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 p-3 w-full place-items-center">
          {onOpenCueListModal ? (
            <button
              type="button"
              className="editor-right-tool-sq"
              style={{
                ...btnToolSquare,
                ...btnCue,
                ...(project.viewMode === "view" ? btnDisabled : {})
              }}
              disabled={project.viewMode === "view"}
              title="モーダルでキュー一覧を開きます"
              aria-label="キュー一覧を開く"
              onClick={() => onOpenCueListModal()}
            >
              <List 
                size={20} 
                style={{ 
                  ...iconCue
                }} 
              />
            </button>
          ) : null}
          <button
            type="button"
            className="editor-right-tool-sq"
            style={{
              ...btnToolSquare,
              ...btnMember,
              ...(project.viewMode === "view" ? btnDisabled : {})
            }}
            disabled={project.viewMode === "view"}
            title="選択中のフォーメーションにメンバーを1人追加（中央付近）"
            onClick={() => addDancerFromStageToolbar()}
          >
            <Users 
              size={20} 
              style={{ 
                ...iconMember
              }} 
            />
          </button>
          {onOpenAudioImport ? (
            <button
              type="button"
              className="editor-right-tool-sq"
              style={{
                ...btnToolSquare,
                ...btnCue,
                ...(project.viewMode === "view" ? btnDisabled : {})
              }}
              disabled={project.viewMode === "view"}
              title="楽曲または動画から音声を読み込み（MP4 / AVI / MOV / MKV / WMV 等に対応）"
              aria-label="音源を取り込む"
              onPointerEnter={() => onPreloadFfmpegForAudio?.()}
              onClick={() => onOpenAudioImport?.()}
            >
              <Music 
                size={20} 
                style={{ 
                  ...iconCue
                }} 
              />
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-4 p-3 w-full place-items-center">
          {choreo ? (
            <ChoreoCoreToolbar
              embedInPanel
              tilesInRun
              singleTile="setPiece"
              {...choreo}
            />
          ) : null}
          {choreo ? (
            <ChoreoCoreToolbar
              embedInPanel
              tilesInRun
              singleTile="stageShape"
              {...choreo}
            />
          ) : null}
          <button
            type="button"
            className="editor-right-tool-sq"
            style={{
              ...btnSecondary,
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid #06b6d430",
              backdropFilter: "blur(10px)",
              height: "64px",
              width: "64px"
            }}
            disabled={project.viewMode === "view"}
            title="CSV / TSV を選んで新しい名簿として取り込みます（1 列目または「名前」などの見出しを検出）"
            onClick={() => importCrewCsvFromStageToolbar()}
          >
            <Upload 
              size={32} 
              strokeWidth={1.5}
              style={{ 
                color: project.viewMode === "view" ? "rgba(255,255,255,0.3)" : "#06b6d4",
                filter: `drop-shadow(0 0 8px ${project.viewMode === "view" ? "transparent" : "#06b6d4"})`,
                transition: "all 0.2s ease"
              }} 
            />
          </button>
        </div>
        {choreo ? (
          <ChoreoCoreToolbar
            embedInPanel
            tilesInRun
            singleTile="export"
            {...choreo}
          />
        ) : null}
        {choreo ? (
          <ChoreoCoreToolbar
            embedInPanel
            tilesInRun
            singleTile="help"
            {...choreo}
          />
        ) : null}

        <div className="grid grid-cols-3 gap-4 p-3 w-full place-items-center">
          {!hideUndoRedoInRail ? (
            <>
              <button
                type="button"
                className="editor-right-tool-sq"
                style={{
                  ...btnSecondary,
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid #64748b30",
                  backdropFilter: "blur(10px)",
                  height: "64px",
                  width: "64px"
                }}
                disabled={project.viewMode === "view" || stageUndoDisabled}
                title="編集を元に戻す（⌘Z / Ctrl+Z）"
                aria-label="元に戻す"
                onClick={() => undo()}
              >
                <Undo 
                  size={32} 
                  strokeWidth={1.5}
                  style={{ 
                    color: (project.viewMode === "view" || stageUndoDisabled) ? "rgba(255,255,255,0.3)" : "#64748b",
                    filter: `drop-shadow(0 0 8px ${(project.viewMode === "view" || stageUndoDisabled) ? "transparent" : "#64748b"})`,
                    transition: "all 0.2s ease"
                  }} 
                />
              </button>
              <button
                type="button"
                className="editor-right-tool-sq"
                style={{
                  ...btnSecondary,
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid #64748b30",
                  backdropFilter: "blur(10px)",
                  height: "64px",
                  width: "64px"
                }}
                disabled={project.viewMode === "view" || stageRedoDisabled}
                title="やり直す（⌘⇧Z / Ctrl+Shift+Z）"
                aria-label="やり直す"
                onClick={() => redo()}
              >
                <Redo 
                  size={32} 
                  strokeWidth={1.5}
                  style={{ 
                    color: (project.viewMode === "view" || stageRedoDisabled) ? "rgba(255,255,255,0.3)" : "#64748b",
                    filter: `drop-shadow(0 0 8px ${(project.viewMode === "view" || stageRedoDisabled) ? "transparent" : "#64748b"})`,
                    transition: "all 0.2s ease"
                  }} 
                />
              </button>
            </>
          ) : null}
          {hasRosterMembers && !project.rosterHidesTimeline ? (
            <button
              type="button"
              className="editor-right-tool-sq"
              style={{
                ...btnSecondary,
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid #10b98130",
                backdropFilter: "blur(10px)",
                height: "64px",
                width: "64px"
              }}
              disabled={project.viewMode === "view"}
              title="右列で名簿一覧を表示し、タイムライン列は隠します"
              onClick={() =>
                setProjectSafe((p) => ({
                  ...p,
                  rosterHidesTimeline: true,
                  rosterStripCollapsed: false,
                }))
              }
            >
              <Users 
                size={32} 
                strokeWidth={1.5}
                style={{ 
                  color: project.viewMode === "view" ? "rgba(255,255,255,0.3)" : "#10b981",
                  filter: `drop-shadow(0 0 8px ${project.viewMode === "view" ? "transparent" : "#10b981"})`,
                  transition: "all 0.2s ease"
                }} 
              />
            </button>
          ) : null}
          {!hideFloorTextToolbar ? (
            <button
              type="button"
              className="editor-right-tool-sq"
              style={{
                ...btnSecondary,
                background: "rgba(255, 255, 255, 0.05)",
                border: floorTextPlaceSession ? "1px solid #38bdf830" : "1px solid #f59e0b30",
                backdropFilter: "blur(10px)",
                height: "64px",
                width: "64px"
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
              <div style={{ position: "relative", width: 34, height: 34 }}>
                <Type 
                  size={22} 
                  strokeWidth={1.5}
                  style={{ 
                    color: (project.viewMode === "view" || stageView !== "2d" || (project.cues.length > 0 && !selectedCueId)) ? "rgba(255,255,255,0.3)" : (floorTextPlaceSession ? "#38bdf8" : "#f59e0b"),
                    filter: `drop-shadow(0 0 6px ${(project.viewMode === "view" || stageView !== "2d" || (project.cues.length > 0 && !selectedCueId)) ? "transparent" : (floorTextPlaceSession ? "#38bdf8" : "#f59e0b")})`,
                    transition: "all 0.2s ease"
                  }} 
                />
                <ArrowUp 
                  size={8} 
                  strokeWidth={1.5}
                  style={{ 
                    color: (project.viewMode === "view" || stageView !== "2d" || (project.cues.length > 0 && !selectedCueId)) ? "rgba(255,255,255,0.3)" : (floorTextPlaceSession ? "#38bdf8" : "#f59e0b"),
                    filter: `drop-shadow(0 0 3px ${(project.viewMode === "view" || stageView !== "2d" || (project.cues.length > 0 && !selectedCueId)) ? "transparent" : (floorTextPlaceSession ? "#38bdf8" : "#f59e0b")})`,
                    transition: "all 0.2s ease",
                    position: "absolute",
                    bottom: 0,
                    right: 0
                  }} 
                />
              </div>
            </button>
          ) : null}
          {stageZenEligible && onEnterStageZen ? (
            <button
              type="button"
              className="editor-right-tool-sq"
              style={{
                ...btnSecondary,
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid #8b5cf630",
                backdropFilter: "blur(10px)",
                height: "64px",
                width: "64px"
              }}
              disabled={project.viewMode === "view"}
              title="波形と右メニューを隠してステージだけを大きく表示（Esc で戻る）"
              aria-label="ステージを拡大表示"
              onClick={() => onEnterStageZen()}
            >
              <div style={{ position: "relative", width: 34, height: 34 }}>
                <Search 
                  size={22} 
                  strokeWidth={1.5}
                  style={{ 
                    color: project.viewMode === "view" ? "rgba(255,255,255,0.3)" : "#8b5cf6",
                    filter: `drop-shadow(0 0 6px ${project.viewMode === "view" ? "transparent" : "#8b5cf6"})`,
                    transition: "all 0.2s ease"
                  }} 
                />
                <Plus 
                  size={14} 
                  strokeWidth={1.5}
                  style={{ 
                    color: project.viewMode === "view" ? "rgba(255,255,255,0.3)" : "#8b5cf6",
                    filter: `drop-shadow(0 0 4px ${project.viewMode === "view" ? "transparent" : "#8b5cf6"})`,
                    transition: "all 0.2s ease",
                    position: "absolute",
                    bottom: 0,
                    right: 0
                  }} 
                />
              </div>
            </button>
          ) : null}
          {onOpenViewerMode || onOpenShareLinks || onOpenCloudSave ? (
            <>
              {onOpenViewerMode ? (
                <button
                  type="button"
                  className="editor-right-tool-sq"
                  style={{
                    ...btnSecondary,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid #38bdf830",
                    backdropFilter: "blur(10px)",
                    height: "64px",
                    width: "64px"
                  }}
                  disabled={viewerModeButtonDisabled}
                  title="表示する人を一人に強調。再生の確認とステージ画像の保存・共有"
                  aria-label="閲覧モード（メンバー別の強調）"
                  onClick={() => onOpenViewerMode()}
                >
                  <div style={{ position: "relative", width: 34, height: 34 }}>
                    <Eye 
                      size={22} 
                      strokeWidth={1.5}
                      style={{ 
                        color: viewerModeButtonDisabled ? "rgba(255,255,255,0.3)" : "#38bdf8",
                        filter: `drop-shadow(0 0 6px ${viewerModeButtonDisabled ? "transparent" : "#38bdf8"})`,
                        transition: "all 0.2s ease"
                      }} 
                    />
                    <Monitor 
                      size={14} 
                      strokeWidth={1.5}
                      style={{ 
                        color: viewerModeButtonDisabled ? "rgba(255,255,255,0.3)" : "#38bdf8",
                        filter: `drop-shadow(0 0 4px ${viewerModeButtonDisabled ? "transparent" : "#38bdf8"})`,
                        transition: "all 0.2s ease",
                        position: "absolute",
                        bottom: 0,
                        right: 0
                      }} 
                    />
                  </div>
                </button>
              ) : null}
              {onOpenShareLinks ? (
                <button
                  type="button"
                  className="editor-right-tool-sq"
                  style={{
                    ...btnSecondary,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid #0ea5e930",
                    backdropFilter: "blur(10px)",
                    height: "64px",
                    width: "64px"
                  }}
                  disabled={shareLinksButtonDisabled}
                  title="チーム用（共同編集）か生徒用（閲覧）か選んで URL を発行"
                  onClick={onOpenShareLinks}
                >
                  <Share2 
                    size={32} 
                    strokeWidth={1.5}
                    style={{ 
                      color: shareLinksButtonDisabled ? "rgba(255,255,255,0.3)" : "#0ea5e9",
                      filter: `drop-shadow(0 0 8px ${shareLinksButtonDisabled ? "transparent" : "#0ea5e9"})`,
                      transition: "all 0.2s ease"
                    }} 
                  />
                </button>
              ) : null}
              {onOpenCloudSave ? (
                <button
                  type="button"
                  className="editor-right-tool-sq"
                  style={{
                    ...btnSecondary,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid #3b82f630",
                    backdropFilter: "blur(10px)",
                    height: "64px",
                    width: "64px"
                  }}
                  disabled={
                    project.viewMode === "view" || cloudSaveDisabled
                  }
                  title={cloudSaveRailTitle}
                  aria-label={cloudSaveRailTitle}
                  onClick={() => onOpenCloudSave()}
                >
                  <Cloud 
                    size={32} 
                    strokeWidth={1.5}
                    style={{ 
                      color: (project.viewMode === "view" || cloudSaveDisabled) ? "rgba(255,255,255,0.3)" : "#3b82f6",
                      filter: `drop-shadow(0 0 8px ${(project.viewMode === "view" || cloudSaveDisabled) ? "transparent" : "#3b82f6"})`,
                      transition: "all 0.2s ease"
                    }} 
                  />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        {!hideFloorTextToolbar && floorTextPlaceSession ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              alignItems: "flex-end",
              paddingTop: "8px",
              marginTop: "4px",
              borderTop: "1px solid #334155",
              width: "100%",
            }}
          >
            <textarea
              value={floorTextPlaceSession?.body || ""}
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
              value={floorTextPlaceSession?.fontSizePx || 18}
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
                  title="テキストを配置して確定"
                  style={{
                    ...btnSecondary,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid #22c55e30",
                    backdropFilter: "blur(10px)",
                    height: "40px",
                    width: "80px"
                  }}
                >
                  <Save 
                    size={22} 
                    strokeWidth={1.5}
                    style={{ 
                      color: "#22c55e",
                      filter: "drop-shadow(0 0 6px #22c55e)",
                      transition: "all 0.2s ease"
                    }} 
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setFloorTextPlaceSession(null)}
                  title="テキスト配置をキャンセル"
                  style={{
                    ...btnSecondary,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid #ef444430",
                    backdropFilter: "blur(10px)",
                    height: "40px",
                    width: "80px"
                  }}
                >
                  <X 
                    size={22} 
                    strokeWidth={1.5}
                    style={{ 
                      color: "#ef4444",
                      filter: "drop-shadow(0 0 6px #ef4444)",
                      transition: "all 0.2s ease"
                    }} 
                  />
                </button>
              </div>
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
