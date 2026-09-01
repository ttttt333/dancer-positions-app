import type { PrevCueCompareSummary } from "../lib/stagePrevCueCompare";
import {
  dockActionBtn,
  dockCard,
  dockSectionHint,
  dockSectionTitle,
} from "./stageDockPanelStyles";

export type StageSelectionComparePanelProps = {
  prevCueCompareAvailable: boolean;
  prevCueCompareOn: boolean;
  prevCueMotionViewOn: boolean;
  prevCueCompareSummary?: PrevCueCompareSummary | null;
  prevCueFromOrdinal?: number | null;
  prevCueToOrdinal?: number | null;
  onTogglePrevCueCompare?: () => void;
  onTogglePrevCueMotionView?: () => void;
};

export function StageSelectionComparePanel({
  prevCueCompareAvailable,
  prevCueCompareOn,
  prevCueMotionViewOn,
  prevCueCompareSummary,
  prevCueFromOrdinal,
  prevCueToOrdinal,
  onTogglePrevCueCompare,
  onTogglePrevCueMotionView,
}: StageSelectionComparePanelProps) {
  const cueLabel =
    prevCueFromOrdinal != null && prevCueToOrdinal != null
      ? `キュー ${prevCueFromOrdinal} → ${prevCueToOrdinal}`
      : "前のキュー";

  return (
    <div data-selection-compare-panel>
      <div style={{ ...dockCard, marginBottom: 0 }}>
        <div style={dockSectionTitle}>前のキューと比較</div>
        {prevCueCompareAvailable && onTogglePrevCueCompare ? (
          <>
            <p style={dockSectionHint}>
              {cueLabel}の立ち位置を薄い○で重ねます。Transition
              は作りません。
            </p>
            {prevCueCompareSummary ? (
              <p
                style={{
                  margin: "0 0 10px",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(148,163,184,0.12)",
                  border: "1px solid #334155",
                  color: "#e2e8f0",
                  fontSize: 13,
                  lineHeight: 1.45,
                  fontWeight: 600,
                }}
              >
                {prevCueCompareSummary.matchedCount}人中
                {prevCueCompareSummary.movedCount}人が移動、
                {prevCueCompareSummary.stillCount}人はそのまま
              </p>
            ) : null}
            <button
              type="button"
              style={{
                ...dockActionBtn,
                marginBottom: 8,
                background: prevCueCompareOn ? "#1e293b" : "#0b1220",
                border: prevCueCompareOn
                  ? "1px solid rgba(148,163,184,0.95)"
                  : "1px solid #334155",
              }}
              aria-pressed={prevCueCompareOn}
              onClick={() => onTogglePrevCueCompare()}
            >
              {prevCueCompareOn ? "重ね表示をオフ" : "重ねて見る"}
            </button>
            {onTogglePrevCueMotionView ? (
              <button
                type="button"
                style={{
                  ...dockActionBtn,
                  background: prevCueMotionViewOn ? "#1e293b" : "#0b1220",
                  border: prevCueMotionViewOn
                    ? "1px solid rgba(148,163,184,0.95)"
                    : "1px solid #334155",
                }}
                aria-pressed={prevCueMotionViewOn}
                onClick={() => onTogglePrevCueMotionView()}
              >
                {prevCueMotionViewOn ? "動き表示をオフ" : "動きを見る"}
              </button>
            ) : null}
          </>
        ) : (
          <p style={{ ...dockSectionHint, margin: 0 }}>
            前のキューがないため、比較できません。
          </p>
        )}
      </div>
    </div>
  );
}
