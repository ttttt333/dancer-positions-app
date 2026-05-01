import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";
import type { Formation } from "../types/choreography";
import { EMPTY_FLOOR_TEXT_DRAFT } from "../lib/stageBoardModelHelpers";
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
    <>
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
          />
        ) : null}
      </div>
      <div
        role="toolbar"
        aria-label="床に線を引く・消す"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
          padding: "4px 8px",
          borderRadius: "8px",
          border: "1px solid #334155",
          background: "rgba(15, 23, 42, 0.92)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
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
          床
        </span>
        <button
          type="button"
          title="ドラッグで線（手描きの折れ線・Esc で終了）"
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
          線
        </button>
        <button
          type="button"
          title="コメントや線をタップして削除"
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
        {floorMarkupTool ? (
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
      {floorMarkupTool === "line" || floorMarkupTool === "erase" ? (
        <StageFloorMarkupLineEraseInlineHint tool={floorMarkupTool} />
      ) : null}
    </>
  );
}
