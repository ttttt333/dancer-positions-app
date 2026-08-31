import type { CSSProperties } from "react";
import {
  DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE,
  modDancerColorIndex,
} from "../lib/dancerColorPalette";
import type {
  PrevCueCompareMark,
  PrevCueCompareSummary,
} from "../lib/stagePrevCueCompare";

export type StagePrevCueCompareOverlayProps = {
  marks: readonly PrevCueCompareMark[];
  markerPx?: number;
};

const wrap: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  zIndex: 5,
  overflow: "visible",
};

/**
 * 前キュー位置を ○、現位置への線だけ出す。名前は出さない。
 * pointer-events なし。Project は触らない。
 */
export function StagePrevCueCompareOverlay({
  marks,
  markerPx = 16,
}: StagePrevCueCompareOverlayProps) {
  if (marks.length === 0) return null;
  const r = markerPx / 2;

  return (
    <div data-prev-cue-compare aria-hidden style={wrap}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        {marks.map((m) => {
          const color = DANCER_PALETTE[modDancerColorIndex(m.colorIndex)]!;
          return (
            <line
              key={`cmp-line-${m.dancerId}`}
              x1={m.fromXPct}
              y1={m.fromYPct}
              x2={m.toXPct}
              y2={m.toYPct}
              stroke={color}
              strokeWidth={0.45}
              strokeOpacity={0.4}
              strokeDasharray="1.4 1.1"
            />
          );
        })}
      </svg>
      {marks.map((m) => {
        const color = DANCER_PALETTE[modDancerColorIndex(m.colorIndex)]!;
        return (
          <div
            key={`cmp-from-${m.dancerId}`}
            title="前のキュー"
            style={{
              position: "absolute",
              left: `${m.fromXPct}%`,
              top: `${m.fromYPct}%`,
              width: markerPx,
              height: markerPx,
              marginLeft: -r,
              marginTop: -r,
              borderRadius: "50%",
              border: `2px solid ${color}`,
              background: "transparent",
              opacity: 0.5,
              boxSizing: "border-box",
            }}
          />
        );
      })}
    </div>
  );
}

const summaryWrap: CSSProperties = {
  marginTop: 8,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #334155",
  background: "rgba(8, 11, 18, 0.94)",
  color: "#cbd5e1",
  fontSize: 12,
  lineHeight: 1.45,
  textAlign: "left",
};

export function StagePrevCueCompareSummary({
  summary,
}: {
  summary: PrevCueCompareSummary;
}) {
  if (summary.matchedCount <= 0) return null;
  return (
    <div data-prev-cue-compare-summary style={summaryWrap}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.04em",
          color: "#94a3b8",
          marginBottom: 6,
        }}
      >
        前のキューと比較
      </div>
      <div>
        {summary.matchedCount}人中
      </div>
      <div style={{ fontWeight: 700, color: "#e2e8f0" }}>
        {summary.movedCount}人が移動
      </div>
      <div>{summary.stillCount}人はそのまま</div>
      {summary.movedCount > 0 ? (
        <>
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 8,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span>小 {summary.smallCount}</span>
            <span>中 {summary.mediumCount}</span>
            <span>大 {summary.largeCount}</span>
          </div>
          <div style={{ marginTop: 4, color: "#94a3b8" }}>
            最大移動 {Math.round(summary.maxMovePct)}%
          </div>
        </>
      ) : null}
    </div>
  );
}
