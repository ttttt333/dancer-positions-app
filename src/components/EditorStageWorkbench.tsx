import type { CSSProperties, ComponentProps, Dispatch, SetStateAction } from "react";
import type { ChoreographyProjectJson, Cue } from "../types/choreography";
import type { FloorTextPlaceSession } from "../components/StageBoard";
import { btnSecondary } from "../components/stageButtonStyles";
import { ChoreoGridToolbar } from "./ChoreoGridToolbar";

export type EditorWorkbenchChoreoToolbarProps = Omit<
  ComponentProps<typeof ChoreoGridToolbar>,
  "layout" | "embedInPanel" | "tilesInRun" | "singleTile"
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
  /** 右レール用: ChoreoGrid の単体タイルに渡すプロップ */
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
};

export function EditorStageWorkbench(props: EditorStageWorkbenchProps) {
  const rail = props.layout === "rail";
  const {
    project,
    setProjectSafe,
    selectedCueId,
    selectedCue,
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
    setStageView,
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
    const editFidR = selectedCue?.formationId ?? project.activeFormationId;
    const editFormationR = project.formations.find((x) => x.id === editFidR);
    const canSaveSpotsR =
      project.viewMode !== "view" &&
      (editFormationR?.dancers.length ?? 0) > 0;

    return (
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
        <div className="editor-right-tools-grid-3">
          <button
            type="button"
            className="editor-right-tool-sq"
            style={{
              ...btnSecondary,
              borderColor: "#0284c7",
              background: "#0ea5e9",
              color: "#0b1220",
            }}
            disabled={project.viewMode === "view"}
            title="キュー設定：人数と立ち位置の決め方（変更／複製／雛形／保存リスト）を選んで追加"
            aria-label="キュー設定"
            onClick={() => setAddCueDialogOpen(true)}
          >
            <span>キュー</span>
            <span>設定</span>
          </button>
          <button
            type="button"
            className="editor-right-tool-sq"
            aria-haspopup="dialog"
            aria-expanded={stageAreaSettingsOpen}
            disabled={project.viewMode === "view"}
            title="舞台・客席・グリッド・名前の出し方・この URL の共有・ショートカット"
            onClick={() => setStageAreaSettingsOpen(true)}
          >
            <span>舞台</span>
            <span>設定</span>
          </button>
          <button
            type="button"
            className="editor-right-tool-sq"
            style={btnSecondary}
            disabled={project.viewMode === "view"}
            title="選択中のフォーメーションにダンサーを1人追加（中央付近）"
            onClick={() => addDancerFromStageToolbar()}
          >
            <span>＋</span>
            <span>ダンサー</span>
          </button>
        </div>

        <div className="editor-right-tools-col-ordered">
          {onOpenCueListModal ? (
            <button
              type="button"
              className="editor-right-tool-sq"
              disabled={project.viewMode === "view"}
              title="モーダルでキュー一覧を開きます"
              aria-label="キュー一覧を開く"
              onClick={() => onOpenCueListModal()}
            >
              <span>キュー</span>
              <span>一覧</span>
            </button>
          ) : null}
          <button
            type="button"
            className="editor-right-tool-sq"
            style={{
              ...btnSecondary,
              borderColor: "#14532d",
              color: "#dcfce7",
            }}
            disabled={project.viewMode === "view" || !canSaveSpotsR}
            title="形の箱に今の立ち位置を保存"
            onClick={() => saveStageToFormationBox()}
          >
            <span>立ち位置</span>
            <span>保存</span>
          </button>
          <button
            type="button"
            className="editor-right-tool-sq"
            style={btnSecondary}
            disabled={project.viewMode === "view"}
            title="今までの流れをフローライブラリに保存"
            onClick={() => setFlowLibraryOpen(true)}
          >
            <span>ライブラリ</span>
            <span>に保存</span>
          </button>
          {onOpenAudioImport ? (
            <button
              type="button"
              className="editor-right-tool-sq"
              disabled={project.viewMode === "view"}
              title="楽曲または動画から音声を読み込み（MP4 / AVI / MOV / MKV / WMV 等に対応）"
              aria-label="音源を取り込む"
              onPointerEnter={() => onPreloadFfmpegForAudio?.()}
              onClick={() => onOpenAudioImport()}
            >
              <span>音源</span>
              <span>取込</span>
            </button>
          ) : null}
          {choreo ? (
            <>
              <ChoreoGridToolbar
                embedInPanel
                tilesInRun
                singleTile="setPiece"
                {...choreo}
              />
              <ChoreoGridToolbar
                embedInPanel
                tilesInRun
                singleTile="stageShape"
                {...choreo}
              />
            </>
          ) : null}
          <button
            type="button"
            className="editor-right-tool-sq"
            style={btnSecondary}
            disabled={project.viewMode === "view"}
            title="CSV / TSV を選んで新しい名簿として取り込みます（1 列目または「名前」などの見出しを検出）"
            onClick={() => importCrewCsvFromStageToolbar()}
          >
            <span>名簿</span>
            <span>取込</span>
          </button>
          {choreo ? (
            <ChoreoGridToolbar
              embedInPanel
              tilesInRun
              singleTile="export"
              {...choreo}
            />
          ) : null}
          {!hideFloorTextToolbar ? (
            <button
              type="button"
              className="editor-right-tool-sq"
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
              <span>テキスト</span>
            </button>
          ) : null}
        </div>

        <div className="editor-right-tools-col-rest">
          {!hideUndoRedoInRail ? (
            <>
              <button
                type="button"
                className="editor-right-tool-sq"
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
                className="editor-right-tool-sq"
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
          {hasRosterMembers && !project.rosterHidesTimeline ? (
            <button
              type="button"
              className="editor-right-tool-sq"
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
                ...btnSecondary,
                borderColor: "#14532d",
                background: "#14532d",
                color: "#dcfce7",
                cursor:
                  project.viewMode === "view" ? "not-allowed" : "pointer",
              }}
            >
              <span>メンバー</span>
              <span>表示</span>
            </button>
          ) : null}
          {choreo ? (
            <ChoreoGridToolbar
              embedInPanel
              tilesInRun
              singleTile="help"
              {...choreo}
            />
          ) : null}
          {stageZenEligible && onEnterStageZen ? (
            <button
              type="button"
              className="editor-right-tool-sq"
              style={btnSecondary}
              disabled={project.viewMode === "view"}
              title="波形と右メニューを隠してステージだけを大きく表示（Esc で戻る）"
              aria-label="ステージを拡大表示"
              onClick={() => onEnterStageZen()}
            >
              <span>拡大</span>
            </button>
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
        viewBox="0 0 22 14"
        width="22"
        height="14"
        aria-hidden
        style={{ display: "block" }}
      >
        <path
          d="M3 7 L9 7 M6 4 L6 10"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="13" cy="3" r="1.2" fill="currentColor" />
        <circle cx="17" cy="3" r="1.2" fill="currentColor" />
        <circle cx="12" cy="8" r="1.2" fill="currentColor" />
        <circle cx="15" cy="8" r="1.2" fill="currentColor" />
        <circle cx="18" cy="8" r="1.2" fill="currentColor" />
        <circle cx="13.5" cy="12" r="1" fill="currentColor" opacity="0.7" />
        <circle cx="16.5" cy="12" r="1" fill="currentColor" opacity="0.7" />
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
      ライブラリに保存
    </button>
    <button
      type="button"
      style={btnSecondary}
      disabled={project.viewMode === "view"}
      title="選択中のフォーメーションにダンサーを1人追加（中央付近）"
      onClick={() => addDancerFromStageToolbar()}
    >
      ＋ダンサー
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
