import type { Dispatch, SetStateAction } from "react";
import {
  FLOOR_LINE_SCOPE_OPTIONS,
  type FloorLineMarkupScope,
} from "../lib/floorLineMarkup";
import { btnSecondary } from "./stageButtonStyles";
import type { FloorMarkupTool } from "./StageFloorMarkupFloatingToolbars";

export type FloorScribblePanelProps = {
  floorMarkupTool: FloorMarkupTool;
  setFloorMarkupTool: Dispatch<SetStateAction<FloorMarkupTool>>;
  floorLineScope: FloorLineMarkupScope;
  setFloorLineScope: Dispatch<SetStateAction<FloorLineMarkupScope>>;
  disabled?: boolean;
};

/**
 * サイドシート「落書き」タブ: 書く／消すと表示範囲（このキュー／全キュー）。
 */
export function FloorScribblePanel({
  floorMarkupTool,
  setFloorMarkupTool,
  floorLineScope,
  setFloorLineScope,
  disabled = false,
}: FloorScribblePanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: "#94a3b8" }}>
        舞台をドラッグして線を描きます。ペア囲みなどに使えます。「消す」で線やメモをタップして削除します。
      </p>

      <div
        role="toolbar"
        aria-label="床に落書きを書く・消す"
        style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
      >
        <button
          type="button"
          disabled={disabled}
          title="ドラッグで手描き線（Esc で終了）"
          onClick={() =>
            setFloorMarkupTool((t) => (t === "line" ? null : "line"))
          }
          style={{
            ...btnSecondary,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 700,
            borderColor:
              floorMarkupTool === "line" ? "rgba(99,102,241,0.9)" : undefined,
            color: floorMarkupTool === "line" ? "#e0e7ff" : undefined,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          書く
        </button>
        <button
          type="button"
          disabled={disabled}
          title="落書きやメモをタップしてすぐ消す"
          onClick={() =>
            setFloorMarkupTool((t) => (t === "erase" ? null : "erase"))
          }
          style={{
            ...btnSecondary,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 700,
            borderColor:
              floorMarkupTool === "erase"
                ? "rgba(248,113,113,0.85)"
                : undefined,
            color: floorMarkupTool === "erase" ? "#fecaca" : undefined,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          消す
        </button>
        {floorMarkupTool === "line" || floorMarkupTool === "erase" ? (
          <button
            type="button"
            disabled={disabled}
            title="ツールを終了（Esc でも可）"
            onClick={() => setFloorMarkupTool(null)}
            style={{
              ...btnSecondary,
              padding: "8px 14px",
              fontSize: 13,
            }}
          >
            完了
          </button>
        ) : null}
      </div>

      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#94a3b8",
            marginBottom: 6,
            letterSpacing: "0.04em",
          }}
        >
          表示範囲
        </div>
        <div
          role="radiogroup"
          aria-label="落書きの表示範囲"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}
        >
          {FLOOR_LINE_SCOPE_OPTIONS.map((opt) => {
            const active = floorLineScope === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                title={opt.hint}
                onClick={() => setFloorLineScope(opt.value)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: active ? "2px solid #d4af37" : "1px solid #334155",
                  background: active ? "rgba(212,175,55,0.13)" : "#0a0f1e",
                  color: active ? "#f5e199" : "#94a3b8",
                  cursor: disabled ? "not-allowed" : "pointer",
                  textAlign: "left",
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>
                  {opt.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: active ? "#d4af37" : "#64748b",
                    lineHeight: 1.25,
                  }}
                >
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {floorMarkupTool === "line" ? (
        <p style={{ margin: 0, fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
          床で押したまま動かして落書きします（ペア囲みなど）
        </p>
      ) : null}
      {floorMarkupTool === "erase" ? (
        <p style={{ margin: 0, fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
          消したい落書きやメモをタップ
        </p>
      ) : null}
    </div>
  );
}
