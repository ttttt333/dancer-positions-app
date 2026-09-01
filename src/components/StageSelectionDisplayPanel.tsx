import { useState, type Dispatch, type SetStateAction } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE } from "../lib/dancerColorPalette";
import { btnSecondary } from "./stageButtonStyles";
import {
  dockActionBtn,
  dockCard,
  dockSectionHint,
  dockSectionTitle,
} from "./stageDockPanelStyles";

const PRIMARY_COLOR_COUNT = 8;

export type StageSelectionDisplayPanelProps = {
  selectedCount: number;
  disabled?: boolean;
  rawDancerLabelPosition?: "inside" | "below";
  dancerLabelBelow: boolean;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  applyBulkColorToDancerIds: (ids: string[], colorIndex: number) => void;
  applyBulkMarkerClear: (ids: string[]) => void;
  applyBulkMarkerSequence: (ids: string[], start: number) => void;
  applyBulkMarkerSame: (ids: string[], badgeRaw: string) => void;
  applyBulkMarkerCenterDistance: (ids: string[]) => void;
  selectedDancerIds: readonly string[];
};

export function StageSelectionDisplayPanel({
  selectedCount,
  disabled,
  rawDancerLabelPosition,
  dancerLabelBelow,
  setProject,
  applyBulkColorToDancerIds,
  applyBulkMarkerClear,
  applyBulkMarkerSequence,
  applyBulkMarkerSame,
  applyBulkMarkerCenterDistance,
  selectedDancerIds,
}: StageSelectionDisplayPanelProps) {
  const [showAllColors, setShowAllColors] = useState(false);
  const colors = showAllColors ? DANCER_PALETTE : DANCER_PALETTE.slice(0, PRIMARY_COLOR_COUNT);
  const ids = [...selectedDancerIds];
  const busy = Boolean(disabled) || selectedCount === 0;

  return (
    <div data-selection-display-panel>
      <div style={dockCard}>
        <div style={dockSectionTitle}>名前の表示</div>
        <p style={dockSectionHint}>ステージ上のすべての印に共通です。</p>
        <div style={{ display: "flex", gap: 8, marginBottom: dancerLabelBelow ? 10 : 0 }}>
          {(["inside", "below"] as const).map((pos) => {
            const current = rawDancerLabelPosition ?? "inside";
            const on = current === pos;
            return (
              <button
                key={pos}
                type="button"
                disabled={busy}
                onClick={() => setProject((p) => ({ ...p, dancerLabelPosition: pos }))}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: on ? "1px solid rgba(251,191,36,0.9)" : "1px solid #334155",
                  background: on ? "rgba(251,191,36,0.16)" : "#020617",
                  color: on ? "#fde68a" : "#94a3b8",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {pos === "inside" ? "丸の内" : "丸の下"}
              </button>
            );
          })}
        </div>
        {dancerLabelBelow ? (
          <>
            <div style={{ ...dockSectionTitle, marginTop: 8 }}>丸の内</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                type="button"
                disabled={busy}
                style={dockActionBtn}
                onClick={() => applyBulkMarkerClear(ids)}
              >
                空白
              </button>
              <button
                type="button"
                disabled={busy}
                style={dockActionBtn}
                onClick={() => {
                  const raw = window.prompt(
                    "連番の開始番号（整数）。フォーメーション順で丸の内に入れます。",
                    "1"
                  );
                  if (raw == null || raw.trim() === "") return;
                  const v = Number.parseInt(raw.trim(), 10);
                  if (!Number.isFinite(v)) {
                    window.alert("整数として読めませんでした。");
                    return;
                  }
                  applyBulkMarkerSequence(ids, v);
                }}
              >
                連番…
              </button>
              <button
                type="button"
                disabled={busy}
                style={dockActionBtn}
                onClick={() => {
                  const raw = window.prompt("全員の丸の内を同じ内容に（最大3文字）。", "1");
                  if (raw == null || raw.trim() === "") return;
                  applyBulkMarkerSame(ids, raw);
                }}
              >
                同じ…
              </button>
              <button
                type="button"
                disabled={busy}
                style={dockActionBtn}
                onClick={() => applyBulkMarkerCenterDistance(ids)}
              >
                センター距離
              </button>
            </div>
          </>
        ) : (
          <p style={{ ...dockSectionHint, margin: "8px 0 0" }}>
            「丸の下」にすると、丸の内に連番などを入れられます。
          </p>
        )}
      </div>

      <div style={{ ...dockCard, marginBottom: 0 }}>
        <div style={dockSectionTitle}>印の色（選択に一括）</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          {colors.map((hex, i) => (
            <button
              key={`dock-color-${i}`}
              type="button"
              disabled={busy}
              title={`色 ${i + 1}`}
              onClick={() => applyBulkColorToDancerIds(ids, i)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                border: "1px solid #1e293b",
                background: hex,
                cursor: busy ? "not-allowed" : "pointer",
                padding: 0,
              }}
            />
          ))}
        </div>
        {DANCER_PALETTE.length > PRIMARY_COLOR_COUNT ? (
          <button
            type="button"
            onClick={() => setShowAllColors((v) => !v)}
            style={{
              ...btnSecondary,
              width: "100%",
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {showAllColors ? "色を減らす" : "もっと見る"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
