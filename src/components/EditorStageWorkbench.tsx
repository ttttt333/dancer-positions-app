import type { CSSProperties, Dispatch, SetStateAction } from "react";
import type { ChoreographyCue, ChoreographyProjectJson } from "../types/choreography";
import type { FloorTextPlaceSession } from "../components/StageBoard";
import { btnSecondary } from "../components/stageButtonStyles";
import { shell } from "../theme/choreoShell";
import { GATHER_TOWARD_OPTIONS, type GatherToward } from "../lib/gatherDancers";
import { DANCER_SPACING_PRESET_OPTIONS } from "../lib/dancerSpacing";

export type EditorStageWorkbenchProps = {
  layout: "stage" | "rail";
  project: ChoreographyProjectJson;
  setProjectSafe: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  cuesSortedForStageJump: ChoreographyCue[];
  selectedCueId: string | null;
  selectedCue: ChoreographyCue | null;
  jumpToCueByIdx: (idx: number) => void;
  cuePagerListOpen: boolean;
  setCuePagerListOpen: Dispatch<SetStateAction<boolean>>;
  stageAreaSettingsOpen: boolean;
  setStageAreaSettingsOpen: Dispatch<SetStateAction<boolean>>;
  stageSettingsOpen: boolean;
  setStageSettingsOpen: Dispatch<SetStateAction<boolean>>;
  gatherMenuOpen: boolean;
  setGatherMenuOpen: Dispatch<SetStateAction<boolean>>;
  applyGatherToward: (toward: GatherToward) => void;
  rightPaneCollapsed: boolean;
  setRightPaneCollapsed: Dispatch<SetStateAction<boolean>>;
  wideEditorLayout: boolean;
  stageUndoDisabled: boolean;
  stageRedoDisabled: boolean;
  undo: () => void;
  redo: () => void;
  setAddCueDialogOpen: Dispatch<SetStateAction<boolean>>;
  saveMenuOpen: boolean;
  setSaveMenuOpen: Dispatch<SetStateAction<boolean>>;
  saveCurrentPageStageSnapshot: () => void;
  saveStageToFormationBox: () => void;
  setFlowLibraryOpen: Dispatch<SetStateAction<boolean>>;
  addDancerFromStageToolbar: () => void;
  importCrewCsvFromStageToolbar: () => void;
  stageView: "2d" | "3d";
  setStageView: Dispatch<SetStateAction<"2d" | "3d">>;
  stageBoardFullscreen: boolean;
  toggleStageBoardFullscreen: () => void;
  floorTextPlaceSession: FloorTextPlaceSession | null;
  setFloorTextPlaceSession: Dispatch<SetStateAction<FloorTextPlaceSession | null>>;
  commitFloorTextPlace: () => void;
  hasRosterMembers: boolean;
};

export function EditorStageWorkbench(props: EditorStageWorkbenchProps) {
  const rail = props.layout === "rail";
  const {
    project,
    setProjectSafe,
    cuesSortedForStageJump,
    selectedCueId,
    selectedCue,
    jumpToCueByIdx,
    cuePagerListOpen,
    setCuePagerListOpen,
    stageAreaSettingsOpen,
    setStageAreaSettingsOpen,
    stageSettingsOpen,
    setStageSettingsOpen,
    gatherMenuOpen,
    setGatherMenuOpen,
    applyGatherToward,
    rightPaneCollapsed,
    setRightPaneCollapsed,
    wideEditorLayout,
    stageUndoDisabled,
    stageRedoDisabled,
    undo,
    redo,
    setAddCueDialogOpen,
    saveMenuOpen,
    setSaveMenuOpen,
    saveCurrentPageStageSnapshot,
    saveStageToFormationBox,
    setFlowLibraryOpen,
    addDancerFromStageToolbar,
    importCrewCsvFromStageToolbar,
    stageView,
    setStageView,
    stageBoardFullscreen,
    toggleStageBoardFullscreen,
    floorTextPlaceSession,
    setFloorTextPlaceSession,
    commitFloorTextPlace,
    hasRosterMembers,
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
  const row2Outer: CSSProperties = rail
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
        justifyContent: "flex-end",
        gap: "10px",
        flexWrap: "wrap",
        rowGap: "6px",
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
        gap: "6px",
        marginBottom: "6px",
      };
  const viewModeRow: CSSProperties = rail
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
        gap: "6px",
        alignItems: "center",
        flexWrap: "wrap",
      };

  return (
    <div style={rootOuter}>
      {/* 1 行目: タイトル／選択情報 + 主要アクション */}
      <div style={rowOuter}>
        <div style={cluster}>
    <h2 style={{ margin: 0, fontSize: "13px", color: shell.textMuted, fontWeight: 600 }}>
      ステージ
    </h2>
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
      設定
    </button>
    {cuesSortedForStageJump.length > 0 ? (() => {
      const total = cuesSortedForStageJump.length;
      const curIdx = selectedCueId
        ? cuesSortedForStageJump.findIndex(
            (c) => c.id === selectedCueId
          )
        : -1;
      const cur = curIdx >= 0 ? cuesSortedForStageJump[curIdx] : null;
      const canPrev =
        project.viewMode !== "view" && curIdx > 0;
      const canNext =
        project.viewMode !== "view" &&
        curIdx >= 0 &&
        curIdx < total - 1;
      const navBtnStyle = (enabled: boolean): CSSProperties => ({
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
      });
      return (
        <div
          style={{
            position: "relative",
            display: rail ? "flex" : "inline-flex",
            flexDirection: rail ? "column" : "row",
            alignItems: rail ? "stretch" : "center",
            gap: "4px",
            flexShrink: 0,
            width: rail ? "100%" : undefined,
          }}
          title="ステージのキュー（ページ）切替。タイムラインも区間の頭に移動します。"
        >
          <button
            type="button"
            onClick={() => jumpToCueByIdx(curIdx - 1)}
            disabled={!canPrev}
            title="前のキューへ"
            aria-label="前のキューへ"
            style={navBtnStyle(canPrev)}
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => setCuePagerListOpen((v) => !v)}
            disabled={project.viewMode === "view"}
            aria-haspopup="listbox"
            aria-expanded={cuePagerListOpen}
            title={
              cur
                ? cur.name?.trim()
                  ? `「${cur.name.trim()}」を編集中。クリックで全キュー一覧。`
                  : "無名のキューを編集中。クリックで全キュー一覧。"
                : "クリックで全キュー一覧から選択"
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 9px",
              borderRadius: "8px",
              border: cur
                ? "1px solid #818cf8"
                : "1px solid #334155",
              background: cur ? "rgba(99,102,241,0.18)" : "#0f172a",
              color: cur ? "#e0e7ff" : "#94a3b8",
              fontSize: "12px",
              fontWeight: 700,
              cursor:
                project.viewMode === "view"
                  ? "not-allowed"
                  : "pointer",
              flexShrink: 0,
              minHeight: "26px",
              maxWidth: "240px",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span
              style={{
                fontSize: "9px",
                color: cur ? "#c7d2fe" : "#64748b",
                letterSpacing: "0.04em",
              }}
            >
              キュー
            </span>
            <span style={{ whiteSpace: "nowrap" }}>
              {curIdx >= 0 ? curIdx + 1 : "—"} / {total}
            </span>
            {cur && cur.name?.trim() ? (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "#e2e8f0",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "120px",
                }}
              >
                {cur.name.trim()}
              </span>
            ) : null}
            <span
              aria-hidden
              style={{
                fontSize: "9px",
                color: cur ? "#c7d2fe" : "#64748b",
                marginLeft: "1px",
              }}
            >
              ▾
            </span>
          </button>
          <button
            type="button"
            onClick={() => jumpToCueByIdx(curIdx + 1)}
            disabled={!canNext}
            title="次のキューへ"
            aria-label="次のキューへ"
            style={navBtnStyle(canNext)}
          >
            ▶
          </button>
          {cuePagerListOpen ? (
            <>
              <div
                onClick={() => setCuePagerListOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 30,
                }}
                aria-hidden
              />
              <ul
                role="listbox"
                aria-label="キュー一覧"
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: "30px",
                  zIndex: 31,
                  listStyle: "none",
                  margin: 0,
                  padding: "4px",
                  maxHeight: "320px",
                  minWidth: "240px",
                  overflowY: "auto",
                  background: "#0b1220",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                }}
              >
                {cuesSortedForStageJump.map((c, i) => {
                  const isCur = i === curIdx;
                  const fname =
                    project.formations.find(
                      (f) => f.id === c.formationId
                    )?.name ?? "";
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isCur}
                        onClick={() => {
                          jumpToCueByIdx(i);
                          setCuePagerListOpen(false);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "5px 8px",
                          border: "none",
                          borderRadius: "6px",
                          background: isCur
                            ? "rgba(99,102,241,0.22)"
                            : "transparent",
                          color: isCur ? "#e0e7ff" : "#cbd5e1",
                          fontSize: "12px",
                          cursor: "pointer",
                          textAlign: "left",
                          fontWeight: isCur ? 700 : 500,
                        }}
                      >
                        <span
                          style={{
                            minWidth: "22px",
                            fontVariantNumeric: "tabular-nums",
                            color: isCur ? "#a5b4fc" : "#64748b",
                            fontSize: "11px",
                            fontWeight: 700,
                          }}
                        >
                          {i + 1}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.name?.trim() ?? ""}
                          {fname ? (
                            <span
                              style={{
                                marginLeft: "6px",
                                color: "#64748b",
                                fontWeight: 400,
                                fontSize: "10px",
                              }}
                            >
                              · {fname}
                            </span>
                          ) : null}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#64748b",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {Math.round(c.tStartSec)}s
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>
      );
    })() : null}
    <button
      type="button"
      disabled={project.viewMode === "view"}
      title="舞台の大きさ・客席の位置・袖・バック・場ミリを編集"
      aria-haspopup="dialog"
      aria-expanded={stageSettingsOpen}
      onClick={() => setStageSettingsOpen(true)}
      style={{
        fontSize: "11px",
        lineHeight: 1.2,
        padding: "3px 8px",
        borderRadius: "6px",
        border: "1px solid #334155",
        background: "#0f172a",
        color: "#94a3b8",
        cursor: project.viewMode === "view" ? "not-allowed" : "pointer",
        flexShrink: 0,
      }}
    >
      ステージ設定
    </button>
    {(() => {
      const canGather =
        project.viewMode !== "view" &&
        (project.cues.length === 0 || Boolean(selectedCueId)) &&
        (project.formations.find(
          (x) => x.id === (selectedCue?.formationId ?? project.activeFormationId)
        )?.dancers.length ?? 0) > 0;
      return (
        <div
          style={{
            position: "relative",
            display: "inline-flex",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            disabled={!canGather}
            title="全員を前・奥・上手・下手へ寄せて整列（行を分けて重なりにくくします）。元に戻すは「戻る」"
            aria-haspopup="menu"
            aria-expanded={gatherMenuOpen}
            onClick={() => setGatherMenuOpen((v) => !v)}
            style={{
              fontSize: "11px",
              lineHeight: 1.2,
              padding: "3px 8px",
              borderRadius: "6px",
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#94a3b8",
              cursor: canGather ? "pointer" : "not-allowed",
            }}
          >
            寄せる
          </button>
          {gatherMenuOpen ? (
            <>
              <div
                onClick={() => setGatherMenuOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 30,
                }}
                aria-hidden
              />
              <div
                role="menu"
                aria-label="寄せる方向"
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  zIndex: 31,
                  minWidth: "220px",
                  padding: "6px",
                  background: "#0b1220",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                }}
              >
                {GATHER_TOWARD_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="menuitem"
                    onClick={() => applyGatherToward(o.id)}
                    title={o.hint}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      marginBottom: "2px",
                      borderRadius: "6px",
                      border: "1px solid #1e293b",
                      background: "#0f172a",
                      color: "#e2e8f0",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{o.label}</span>
                    <span
                      style={{
                        display: "block",
                        marginTop: "2px",
                        fontSize: "10px",
                        color: "#64748b",
                        fontWeight: 400,
                      }}
                    >
                      {o.hint}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      );
    })()}
    {wideEditorLayout ? (
      <button
        type="button"
        onClick={() => setRightPaneCollapsed((v) => !v)}
        aria-pressed={rightPaneCollapsed}
        aria-label={
          rightPaneCollapsed
            ? "右列（キュー一覧・タイムライン）を表示"
            : "右列を隠してステージを最大化"
        }
        title={
          rightPaneCollapsed
            ? "右列（キュー一覧・タイムライン）を表示"
            : "右列を隠してステージを最大化"
        }
        style={{
          fontSize: "11px",
          lineHeight: 1,
          padding: "4px 7px",
          borderRadius: "6px",
          border: rightPaneCollapsed
            ? "1px solid #14532d"
            : "1px solid #334155",
          background: rightPaneCollapsed
            ? "rgba(34,197,94,0.18)"
            : "#0f172a",
          color: rightPaneCollapsed ? "#bbf7d0" : "#94a3b8",
          cursor: "pointer",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
        }}
      >
        <svg
          viewBox="0 0 16 12"
          width="16"
          height="12"
          aria-hidden
          style={{ display: "block" }}
        >
          <circle cx="2.5" cy="2.5" r="1" fill="currentColor" />
          <line
            x1="5"
            y1="2.5"
            x2="13.5"
            y2="2.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="2.5" cy="6" r="1" fill="currentColor" />
          <line
            x1="5"
            y1="6"
            x2="13.5"
            y2="6"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="2.5" cy="9.5" r="1" fill="currentColor" />
          <line
            x1="5"
            y1="9.5"
            x2="13.5"
            y2="9.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
        <span aria-hidden style={{ fontSize: "13px", lineHeight: 1, fontWeight: 700 }}>
          {rightPaneCollapsed ? "‹" : "›"}
        </span>
      </button>
    ) : null}
    {project.cues.length === 0 ? (
      <span style={{ fontSize: "11px", color: "#64748b" }}>
        キューなし（フォーメーションを直接編集）
      </span>
    ) : null}
        </div>
        <div
          style={clusterEnd}
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
      <span style={{ fontSize: "12px", fontWeight: 700 }}>キュー</span>
    </button>
    {(() => {
      const editFid =
        selectedCue?.formationId ?? project.activeFormationId;
      const editFormation = project.formations.find(
        (x) => x.id === editFid
      );
      const canSaveSpots =
        project.viewMode !== "view" &&
        (editFormation?.dancers.length ?? 0) > 0;
      const saveSpotsHint =
        project.viewMode === "view"
          ? "閲覧モードでは使えません"
          : (editFormation?.dancers.length ?? 0) === 0
            ? "いまのフォーメーションにダンサーがいません"
            : "いまステージの形をそのまま「形の箱」に保存";
      return (
        <div
          style={{
            position: "relative",
            display: "inline-flex",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            style={{
              ...btnSecondary,
              borderColor: "#1e3a8a",
              color: "#bfdbfe",
              padding: "6px 10px",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
            title="流れ（キュー並び）か、いまの立ち位置（形の箱）を保存"
            aria-haspopup="menu"
            aria-expanded={saveMenuOpen}
            onClick={() => setSaveMenuOpen((v) => !v)}
          >
            <svg
              viewBox="0 0 18 14"
              width="18"
              height="14"
              aria-hidden
              style={{ display: "block" }}
            >
              <circle cx="2.5" cy="7" r="1.4" fill="currentColor" />
              <path
                d="M4 7 L7 7"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <circle cx="9" cy="7" r="1.4" fill="currentColor" />
              <path
                d="M10.5 7 L13.5 7"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <circle cx="15.5" cy="7" r="1.4" fill="currentColor" />
            </svg>
            <span style={{ fontSize: "12px", fontWeight: 600 }}>
              保存
            </span>
            <span
              aria-hidden
              style={{
                fontSize: "10px",
                color: "#93c5fd",
                marginLeft: "1px",
              }}
            >
              ▾
            </span>
          </button>
          {saveMenuOpen ? (
            <>
              <div
                onClick={() => setSaveMenuOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 30,
                }}
                aria-hidden
              />
              <div
                role="menu"
                aria-label="保存の種類"
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  zIndex: 31,
                  minWidth: "260px",
                  padding: "6px",
                  background: "#0b1220",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={
                    project.viewMode === "view" ||
                    (project.cues.length > 0 && !selectedCueId)
                  }
                  onClick={() => {
                    setSaveMenuOpen(false);
                    saveCurrentPageStageSnapshot();
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    marginBottom: "4px",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    background: "#0f172a",
                    color: "#e2e8f0",
                    fontSize: "12px",
                    cursor:
                      project.viewMode === "view" ||
                      (project.cues.length > 0 && !selectedCueId)
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    このページの舞台設定を保存
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: "3px",
                      fontSize: "10px",
                      color: "#64748b",
                      fontWeight: 400,
                    }}
                  >
                    横幅・客席・変形舞台などをいまのフォーメーションに記録。キューを切替えると自動で保存・復元されます。
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSaveMenuOpen(false);
                    setFlowLibraryOpen(true);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    marginBottom: "4px",
                    borderRadius: "6px",
                    border: "1px solid #1e3a8a",
                    background: "#0f172a",
                    color: "#e2e8f0",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    今までの流れを保存
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: "3px",
                      fontSize: "10px",
                      color: "#64748b",
                      fontWeight: 400,
                    }}
                  >
                    作ったキューの並び（立ち位置の流れ）を名前をつけて端末に保存・呼び出し
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canSaveSpots}
                  onClick={() => {
                    setSaveMenuOpen(false);
                    saveStageToFormationBox();
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid #14532d",
                    background: "#0f172a",
                    color: "#e2e8f0",
                    fontSize: "12px",
                    cursor: canSaveSpots ? "pointer" : "not-allowed",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    作った立ち位置を保存
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: "3px",
                      fontSize: "10px",
                      color: "#64748b",
                      fontWeight: 400,
                    }}
                  >
                    {saveSpotsHint}
                  </span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      );
    })()}
    <button
      type="button"
      style={btnSecondary}
      disabled={
        project.viewMode === "view" ||
        (project.cues.length > 0 && !selectedCueId)
      }
      title={
        project.cues.length > 0 && !selectedCueId
          ? "タイムラインでキューを選んでから保存できます"
          : "立ち位置・床のテキスト・メモは作品に常に含まれます。ここでは横幅・客席・変形舞台などの舞台設定を、このページ（フォーメーション）用に記録します。別ページへ切り替えるときも自動で保存・復元されます。"
      }
      onClick={() => saveCurrentPageStageSnapshot()}
    >
      ページ保存
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
          ...(stageView === "2d"
            ? { borderColor: "#6366f1", color: "#c7d2fe" }
            : {}),
        }}
        onClick={() => setStageView("2d")}
      >
        2D
      </button>
      <button
        type="button"
        style={{
          ...btnSecondary,
          ...(stageView === "3d"
            ? { borderColor: "#6366f1", color: "#c7d2fe" }
            : {}),
        }}
        onClick={() => setStageView("3d")}
      >
        3D
      </button>
      <button
        type="button"
        style={{
          ...btnSecondary,
          ...(stageBoardFullscreen
            ? {
                borderColor: "rgba(34,197,94,0.75)",
                color: "#bbf7d0",
              }
            : {}),
        }}
        disabled={project.viewMode === "view"}
        title={
          stageBoardFullscreen
            ? "全画面を終了（Esc でも終了できます）"
            : "ステージの表示エリアだけをブラウザ全画面にします（2D / 3D どちらでも可）"
        }
        onClick={() => {
          if (project.viewMode === "view") return;
          void toggleStageBoardFullscreen();
        }}
      >
        {stageBoardFullscreen ? "全画面終了" : "全画面"}
      </button>
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
                : "舞台上のテキストを入力・プレビューし、完了で設置します"
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
                  yPct: 42,
                }
          );
        }}
      >
        {floorTextPlaceSession ? "テキストやめる" : "テキスト"}
      </button>
      {hasRosterMembers ? (
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
      {floorTextPlaceSession ? (
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
            placeholder="舞台上に表示するテキスト"
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
          <label
            style={{
              display: "inline-flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "11px",
              color: "#94a3b8",
            }}
          >
            サイズ (px)
            <input
              type="number"
              min={8}
              max={56}
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
          </label>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              flex: "1 1 200px",
              minWidth: "160px",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                color: "#64748b",
                lineHeight: 1.35,
              }}
            >
              ステージの点線枠で内容を確認。床をクリックするか枠をドラッグして位置を決め、「完了」で設置します。
            </span>
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
      {/* 2 行目: 印の直径・規格（グリッド・名前・客席は「設定」ボタンへ集約） */}
      <div style={row2Outer}>
    <label
      style={{
        display: rail ? "flex" : "inline-flex",
        flexDirection: rail ? "column" : "row",
        alignItems: rail ? "stretch" : "center",
        gap: "6px",
        fontSize: "12px",
        color: "#94a3b8",
        cursor: project.viewMode === "view" ? "default" : "pointer",
        userSelect: "none",
      }}
    >
      <span style={{ whiteSpace: "nowrap" }}>印の直径</span>
      <input
        type="range"
        min={20}
        max={120}
        step={1}
        value={Math.max(
          20,
          Math.min(120, Math.round(project.dancerMarkerDiameterPx ?? 44))
        )}
        disabled={project.viewMode === "view"}
        onChange={(e) =>
          setProjectSafe((p) => ({
            ...p,
            dancerMarkerDiameterPx: Number(e.target.value),
          }))
        }
        aria-label="ダンサー印の直径（ピクセル）"
        style={{ width: rail ? "100%" : "88px", verticalAlign: "middle" }}
      />
      <span style={{ color: "#cbd5e1", minWidth: "38px", fontVariantNumeric: "tabular-nums" }}>
        {Math.max(
          20,
          Math.min(120, Math.round(project.dancerMarkerDiameterPx ?? 44))
        )}
        px
      </span>
    </label>
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
    <label
      title={
        project.stageWidthMm != null && project.stageWidthMm > 0
          ? "ダンサー隣同士の間隔（流派の場ミリ規格）。\n偶数人はセンターを「割って」±半 step、奇数人はセンター乗せで自動配置されます。\n「＋ダンサー」「フォーメーション案」「ドラッグ吸着」「規格ドット表示」が連動。"
          : "ステージ幅を設定すると流派の場ミリ規格を選べます"
      }
      style={{
        display: rail ? "flex" : "inline-flex",
        flexDirection: rail ? "column" : "row",
        alignItems: rail ? "stretch" : "center",
        gap: "4px",
        fontSize: "11px",
        color: "#94a3b8",
        userSelect: "none",
      }}
    >
      <span style={{ whiteSpace: "nowrap" }}>規格</span>
      <select
        value={(() => {
          const v = project.dancerSpacingMm;
          if (v == null || v <= 0) return 0;
          return DANCER_SPACING_PRESET_OPTIONS.some((o) => o.mm === v)
            ? v
            : -1;
        })()}
        disabled={
          project.viewMode === "view" ||
          !(project.stageWidthMm != null && project.stageWidthMm > 0)
        }
        onChange={(e) => {
          const mm = Number(e.target.value);
          setProjectSafe((p) => {
            if (!mm || mm <= 0) {
              return { ...p, dancerSpacingMm: undefined };
            }
            return { ...p, dancerSpacingMm: mm };
          });
        }}
        aria-label="ダンサー隣同士の間隔（場ミリ規格）"
        style={{
          width: rail ? "100%" : undefined,
          padding: "4px 6px",
          borderRadius: "6px",
          border: "1px solid #334155",
          background: "#0f172a",
          color: "#e2e8f0",
          fontSize: "12px",
        }}
      >
        <option value={0}>—</option>
        {DANCER_SPACING_PRESET_OPTIONS.map((opt) => (
          <option key={opt.mm} value={opt.mm}>
            {opt.label}
          </option>
        ))}
        <option value={-1} disabled hidden>
          カスタム
        </option>
      </select>
      <input
        type="number"
        min={20}
        max={500}
        step={5}
        value={
          project.dancerSpacingMm != null && project.dancerSpacingMm > 0
            ? Math.round(project.dancerSpacingMm / 10)
            : ""
        }
        onChange={(e) => {
          const cm = Number(e.target.value);
          setProjectSafe((p) => {
            if (!Number.isFinite(cm) || cm <= 0) {
              return { ...p, dancerSpacingMm: undefined };
            }
            const mm = Math.max(200, Math.min(5000, Math.round(cm * 10)));
            return { ...p, dancerSpacingMm: mm };
          });
        }}
        disabled={
          project.viewMode === "view" ||
          !(project.stageWidthMm != null && project.stageWidthMm > 0)
        }
        placeholder="cm"
        aria-label="場ミリ規格をカスタム入力（cm）"
        title="cm 単位でカスタム指定。例: 150 → 1.5 m 間隔"
        style={{
          width: "52px",
          padding: "4px 6px",
          borderRadius: "6px",
          border: "1px solid #334155",
          background: "#0f172a",
          color: "#e2e8f0",
          fontSize: "12px",
          textAlign: "right",
        }}
      />
      <span
        style={{ fontSize: "10px", color: "#64748b", whiteSpace: "nowrap" }}
        aria-hidden
      >
        cm
      </span>
    </label>
    <label
      title={
        project.stageWidthMm != null && project.stageWidthMm > 0
          ? "○の直径を実寸（メートル）で指定（ステージ幅に連動）"
          : "ステージ幅を設定すると実寸で指定できます"
      }
      style={{
        display: rail ? "flex" : "inline-flex",
        flexDirection: rail ? "column" : "row",
        alignItems: rail ? "stretch" : "center",
        gap: "4px",
        fontSize: "11px",
        color: shell.textMuted,
        userSelect: "none",
      }}
    >
      <span style={{ whiteSpace: "nowrap" }}>○実寸</span>
      <select
        value={project.dancerMarkerDiameterMm ?? 0}
        disabled={
          project.viewMode === "view" ||
          !(project.stageWidthMm != null && project.stageWidthMm > 0)
        }
        onChange={(e) => {
          const mm = Number(e.target.value);
          setProjectSafe((p) => {
            if (!mm || mm <= 0) {
              return { ...p, dancerMarkerDiameterMm: undefined };
            }
            return { ...p, dancerMarkerDiameterMm: mm };
          });
        }}
        aria-label="○の直径（メートル）"
        style={{
          width: rail ? "100%" : undefined,
          padding: "4px 6px",
          borderRadius: "6px",
          border: `1px solid ${shell.borderStrong}`,
          background: shell.surfaceRaised,
          color: shell.text,
          fontSize: "12px",
        }}
      >
        <option value={0}>—</option>
        <option value={300}>30 cm</option>
        <option value={500}>50 cm</option>
        <option value={750}>75 cm</option>
        <option value={1000}>1 m</option>
        <option value={1500}>1.5 m</option>
      </select>
    </label>
  </div>
</div>
  );

}
