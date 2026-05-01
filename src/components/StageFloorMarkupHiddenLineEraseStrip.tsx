import type { CSSProperties } from "react";
import { btnSecondary } from "./stageButtonStyles";
import type { StageFloorMarkupLineEraseTool } from "./StageFloorMarkupLineEraseInlineHint";

export type StageFloorMarkupHiddenLineEraseStripProps = {
  tool: StageFloorMarkupLineEraseTool;
  onDone: () => void;
  stripStyle?: CSSProperties;
};

/**
 * 外部ツールバー利用時（hideFloorMarkupFloatingToolbars）:
 * 床下に出す線／消しゴムのヒント＋完了。
 */
export function StageFloorMarkupHiddenLineEraseStrip({
  tool,
  onDone,
  stripStyle,
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
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #334155",
        background: "rgba(15, 23, 42, 0.94)",
        boxShadow: "0 -4px 18px rgba(0,0,0,0.35)",
        ...stripStyle,
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
        {tool === "line" && "床で押したまま動かして線を描きます"}
        {tool === "erase" && "削除したいメモや線をタップ"}
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
  );
}
