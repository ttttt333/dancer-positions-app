import type { DancerSpot } from "../types/choreography";
import {
  DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE,
  modDancerColorIndex,
} from "../lib/dancerColorPalette";

export type StageBoardBulkColorToolbarProps = {
  /** パレットを表示するか（選択あり＋ツールバー表示フラグ） */
  open: boolean;
  /** 選択ダンサー人数 */
  selectedCount: number;
  primarySelectedDancer: DancerSpot | null;
  onSelectPaletteIndex: (index: number) => void;
};

export function StageBoardBulkColorToolbar({
  open,
  selectedCount,
  primarySelectedDancer,
  onSelectPaletteIndex,
}: StageBoardBulkColorToolbarProps) {
  if (!open) return null;

  return (
    <div
      role="toolbar"
      aria-label="選択した立ち位置の色を一括変更"
      style={{
        flexShrink: 0,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px",
        width: "100%",
        padding: "8px 10px",
        borderRadius: "10px",
        border: "1px solid #334155",
        background: "rgba(15, 23, 42, 0.96)",
        boxSizing: "border-box",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "#94a3b8",
          whiteSpace: "nowrap",
        }}
      >
        選択中 {selectedCount} 人の色
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
        {DANCER_PALETTE.map((hex, i) => (
          <button
            key={i}
            type="button"
            title={`色を一括で ${i + 1} に変更`}
            onClick={() => onSelectPaletteIndex(i)}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border:
                primarySelectedDancer &&
                modDancerColorIndex(primarySelectedDancer.colorIndex) === i
                  ? "2px solid #fbbf24"
                  : "1px solid #1e293b",
              background: hex,
              cursor: "pointer",
              padding: 0,
              boxSizing: "border-box",
            }}
          />
        ))}
      </div>
    </div>
  );
}
