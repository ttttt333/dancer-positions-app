import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";
import type { Formation, StageFloorMarkup } from "../types/choreography";
import { EMPTY_FLOOR_TEXT_DRAFT } from "../lib/stageBoardModelHelpers";
import {
  FLOOR_LINE_SCOPE_OPTIONS,
  type FloorLineMarkupScope,
} from "../lib/floorLineMarkup";
import { btnSecondary } from "./stageButtonStyles";
import {
  FloorTextDraftEditorForm,
  type FloorTextDraftShape,
} from "./FloorTextDraftEditorForm";
import { StageFloorMarkupLineEraseInlineHint } from "./StageFloorMarkupLineEraseInlineHint";

export type FloorMarkupTool = null | "text" | "line" | "erase";

type FloorLineSession = {
  points: [number, number][];
  lastClientX: number;
  lastClientY: number;
} | null;

type FloorTextInlineRectState = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
} | null;

export type StageFloorMarkupFloatingToolbarsProps = {
  floorMarkupTool: FloorMarkupTool;
  setFloorMarkupTool: Dispatch<SetStateAction<FloorMarkupTool>>;
  floorTextEditId: string | null;
  setFloorTextEditId: Dispatch<SetStateAction<string | null>>;
  floorTextDraft: FloorTextDraftShape;
  setFloorTextDraft: Dispatch<SetStateAction<FloorTextDraftShape>>;
  updateActiveFormation: (updater: (f: Formation) => Formation) => void;
  floorLineSessionRef: MutableRefObject<FloorLineSession>;
  setFloorLineDraft: Dispatch<SetStateAction<[number, number][] | null>>;
  setFloorTextInlineRect: Dispatch<SetStateAction<FloorTextInlineRectState>>;
  onAddTemplateText?: (text: string) => void;
  floorTextEditIsGlobal?: boolean;
  onUpdateGlobalMarkup?: (updater: (prev: StageFloorMarkup[]) => StageFloorMarkup[]) => void;
  floorLineScope?: FloorLineMarkupScope;
  setFloorLineScope?: Dispatch<SetStateAction<FloorLineMarkupScope>>;
  /**
   * true: テキスト帯を出さない（上部ドック時など、テキストはサイドシート側）。
   * 落書きはサイドシートの「落書き」タブから起動する（舞台上には初めから出さない）。
   */
  hideTextToolbar?: boolean;
  /** true: 落書き帯を出さない（サイドシート利用時）。省略時は表示 */
  hideScribbleToolbar?: boolean;
};

/** メイン床左上: 床テキストツールバー＋線／消しゴムツールバー＋ヒント */
export function StageFloorMarkupFloatingToolbars({
  floorMarkupTool,
  setFloorMarkupTool,
  floorTextEditId,
  setFloorTextEditId,
  floorTextDraft,
  setFloorTextDraft,
  updateActiveFormation,
  floorLineSessionRef,
  setFloorLineDraft,
  setFloorTextInlineRect,
  onAddTemplateText,
  floorTextEditIsGlobal,
  onUpdateGlobalMarkup,
  floorLineScope = "formation",
  setFloorLineScope,
  hideTextToolbar = false,
  hideScribbleToolbar = false,
}: StageFloorMarkupFloatingToolbarsProps) {
  const clearAllMarkupTools = () => {
    setFloorMarkupTool(null);
    floorLineSessionRef.current = null;
    setFloorLineDraft(null);
    setFloorTextEditId(null);
    setFloorTextDraft({ ...EMPTY_FLOOR_TEXT_DRAFT });
    setFloorTextInlineRect(null);
  };

  return (
    <div className="stage-floor-markup-floating-cluster">
      {!hideTextToolbar ? (
        <div
          role="toolbar"
          aria-label="ステージ床テキスト"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "8px 10px",
            borderRadius: "8px",
            border: "1px solid #334155",
            background: "rgba(15, 23, 42, 0.95)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: "10px",
                color: "#94a3b8",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              テキスト
            </span>
            <button
              type="button"
              title="文面とサイズを指定し、床をクリックして配置（Esc で終了）"
              onClick={() => {
                setFloorMarkupTool((t) => {
                  if (t === "text") {
                    setFloorTextEditId(null);
                    return null;
                  }
                  return "text";
                });
              }}
              style={{
                ...btnSecondary,
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 600,
                borderColor:
                  floorMarkupTool === "text"
                    ? "rgba(99,102,241,0.9)"
                    : undefined,
                color: floorMarkupTool === "text" ? "#e0e7ff" : undefined,
              }}
            >
              書き込み
            </button>
            {floorMarkupTool === "text" && floorTextEditId ? (
              <button
                type="button"
                title="選択を解除し、新しいテキストを置けるようにします"
                onClick={() => setFloorTextEditId(null)}
                style={{
                  ...btnSecondary,
                  padding: "4px 8px",
                  fontSize: "11px",
                }}
              >
                新規へ
              </button>
            ) : null}
          </div>
          {floorMarkupTool === "text" ? (
            <FloorTextDraftEditorForm
              draft={floorTextDraft}
              setDraft={setFloorTextDraft}
              floorTextEditId={floorTextEditId}
              updateActiveFormation={updateActiveFormation}
              onAddTemplateText={onAddTemplateText}
              floorTextEditIsGlobal={floorTextEditIsGlobal}
              onUpdateGlobalMarkup={onUpdateGlobalMarkup}
            />
          ) : null}
        </div>
      ) : null}
      {!hideScribbleToolbar ? (
        <div
          role="toolbar"
          aria-label="床に落書きを書く・消す"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "6px 8px",
            borderRadius: "8px",
            border: "1px solid #334155",
            background: "rgba(15, 23, 42, 0.92)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: "9px",
                color: "#64748b",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              落書き
            </span>
            <button
              type="button"
              title="ドラッグで手描き線（ペア囲みなど・Esc で終了）"
              onClick={() =>
                setFloorMarkupTool((t) => (t === "line" ? null : "line"))
              }
              style={{
                ...btnSecondary,
                padding: "4px 8px",
                fontSize: "11px",
                fontWeight: 600,
                borderColor:
                  floorMarkupTool === "line"
                    ? "rgba(99,102,241,0.9)"
                    : undefined,
                color: floorMarkupTool === "line" ? "#e0e7ff" : undefined,
              }}
            >
              書く
            </button>
            <button
              type="button"
              title="落書きやメモをタップしてすぐ消す"
              onClick={() =>
                setFloorMarkupTool((t) => (t === "erase" ? null : "erase"))
              }
              style={{
                ...btnSecondary,
                padding: "4px 8px",
                fontSize: "11px",
                fontWeight: 600,
                borderColor:
                  floorMarkupTool === "erase"
                    ? "rgba(248,113,113,0.85)"
                    : undefined,
                color: floorMarkupTool === "erase" ? "#fecaca" : undefined,
              }}
            >
              消す
            </button>
            {floorMarkupTool === "line" || floorMarkupTool === "erase" ? (
              <button
                type="button"
                title="ツールを終了（Esc でも可）"
                onClick={clearAllMarkupTools}
                style={{
                  ...btnSecondary,
                  padding: "4px 8px",
                  fontSize: "11px",
                }}
              >
                完了
              </button>
            ) : null}
          </div>
          {floorMarkupTool === "line" && setFloorLineScope ? (
            <div
              role="radiogroup"
              aria-label="落書きの表示範囲"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 4,
              }}
            >
              {FLOOR_LINE_SCOPE_OPTIONS.map((opt) => {
                const active = floorLineScope === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={opt.hint}
                    onClick={() => setFloorLineScope(opt.value)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 1,
                      padding: "5px 7px",
                      borderRadius: 7,
                      border: active
                        ? "2px solid #d4af37"
                        : "1px solid #334155",
                      background: active
                        ? "rgba(212,175,55,0.13)"
                        : "#0a0f1e",
                      color: active ? "#f5e199" : "#94a3b8",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2 }}
                    >
                      {opt.label}
                    </span>
                    <span
                      style={{
                        fontSize: 9.5,
                        color: active ? "#d4af37" : "#64748b",
                        lineHeight: 1.2,
                      }}
                    >
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      {!hideScribbleToolbar &&
      (floorMarkupTool === "line" || floorMarkupTool === "erase") ? (
        <StageFloorMarkupLineEraseInlineHint tool={floorMarkupTool} />
      ) : null}
    </div>
  );
}
