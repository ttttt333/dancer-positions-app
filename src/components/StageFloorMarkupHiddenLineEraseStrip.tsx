import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { btnSecondary } from "./stageButtonStyles";
import type { StageFloorMarkupLineEraseTool } from "./StageFloorMarkupLineEraseInlineHint";
import {
  FLOOR_LINE_SCOPE_OPTIONS,
  type FloorLineMarkupScope,
} from "../lib/floorLineMarkup";

export type StageFloorMarkupHiddenLineEraseStripProps = {
  tool: StageFloorMarkupLineEraseTool;
  onDone: () => void;
  stripStyle?: CSSProperties;
  floorLineScope?: FloorLineMarkupScope;
  setFloorLineScope?: Dispatch<SetStateAction<FloorLineMarkupScope>>;
};

/**
 * 外部ツールバー利用時（hideFloorMarkupFloatingToolbars）:
 * 床下に出す落書き／消しゴムのヒント＋完了。
 */
export function StageFloorMarkupHiddenLineEraseStrip({
  tool,
  onDone,
  stripStyle,
  floorLineScope = "formation",
  setFloorLineScope,
}: StageFloorMarkupHiddenLineEraseStripProps) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        bottom: 8,
        left: 8,
        right: 8,
        zIndex: 37,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #334155",
        background: "rgba(15, 23, 42, 0.94)",
        boxShadow: "0 -4px 18px rgba(0,0,0,0.35)",
        ...stripStyle,
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
            fontSize: "11px",
            color: "#94a3b8",
            flex: "1 1 180px",
            lineHeight: 1.35,
          }}
        >
          {tool === "line" &&
            "床で押したまま動かして落書きします（ペア囲みなど）"}
          {tool === "erase" && "消したい落書きやメモをタップ"}
        </span>
        <button
          type="button"
          title="ツールを終了（Esc でも可）"
          onClick={onDone}
          style={{
            ...btnSecondary,
            padding: "6px 12px",
            fontSize: "12px",
          }}
        >
          完了
        </button>
      </div>
      {tool === "line" && setFloorLineScope ? (
        <div
          role="radiogroup"
          aria-label="落書きの表示範囲"
          style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
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
                  ...btnSecondary,
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  borderColor: active ? "#d4af37" : undefined,
                  background: active ? "rgba(212,175,55,0.18)" : undefined,
                  color: active ? "#fef3c7" : undefined,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
