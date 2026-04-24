import React from "react";
import type { StageFloorTextMarkup } from "../types/choreography";

type Props = {
  markup?: StageFloorTextMarkup | null;
  onChange: (next: Partial<StageFloorTextMarkup>) => void;
};

const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "system-ui (default)", value: "system-ui, -apple-system, \"Segoe UI\", Roboto, \"Noto Sans JP\", sans-serif" },
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Noto Sans JP", value: "\"Noto Sans JP\", sans-serif" },
  { label: "Noto Serif JP", value: "\"Noto Serif JP\", serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Times New Roman", value: "\"Times New Roman\", Times, serif" },
  { label: "Courier New", value: "\"Courier New\", monospace" },
];

export default function FloorTextStylePanel({ markup, onChange }: Props) {
  const color = markup?.color ?? "#fef08a";
  const fontFamily = markup?.fontFamily ?? FONT_OPTIONS[0].value;
  const fontSizePx = markup?.fontSizePx ?? 18;
  const fontWeight = markup?.fontWeight ?? 600;

  return (
    <div className="floor-text-style-panel" style={{ padding: 8, display: "flex", gap: 8, flexDirection: "column", width: 220 }}>
      <label style={{ fontSize: 12, color: "#f5f0e6" }}>Color</label>
      <input
        aria-label="Floor text color"
        type="color"
        value={color}
        onChange={(e) => onChange({ color: e.target.value })}
        style={{ width: "100%", height: 36, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)" }}
      />

      <label style={{ fontSize: 12, color: "#f5f0e6" }}>Font family</label>
      <select
        aria-label="Floor text font family"
        value={fontFamily}
        onChange={(e) => onChange({ fontFamily: e.target.value })}
        style={{ width: "100%", height: 36, borderRadius: 6, background: "rgba(16,16,14,0.98)", color: "#f5f0e6", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {FONT_OPTIONS.map((f) => (
          <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
            {f.label}
          </option>
        ))}
      </select>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: "#f5f0e6" }}>Size</label>
          <input
            type="number"
            aria-label="Floor text size px"
            value={fontSizePx}
            min={8}
            max={120}
            onChange={(e) => onChange({ fontSizePx: Number(e.target.value) || 8 })}
            style={{ width: "100%", height: 36, borderRadius: 6 }}
          />
        </div>
        <div style={{ width: 80 }}>
          <label style={{ fontSize: 12, color: "#f5f0e6" }}>Weight</label>
          <select
            aria-label="Floor text font weight"
            value={String(fontWeight)}
            onChange={(e) => onChange({ fontWeight: Number(e.target.value) || 400 })}
            style={{ width: "100%", height: 36, borderRadius: 6 }}
          >
            <option value="300">300</option>
            <option value="400">400</option>
            <option value="500">500</option>
            <option value="600">600</option>
            <option value="700">700</option>
            <option value="800">800</option>
            <option value="900">900</option>
          </select>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#a8a29e" }}>
        Changes apply immediately to the selected floor text on the stage.
      </div>
    </div>
  );
}
