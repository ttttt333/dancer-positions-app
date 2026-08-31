import type { CSSProperties } from "react";
import {
  DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE,
  modDancerColorIndex,
} from "../lib/dancerColorPalette";
import type {
  PrevCueCompareMark,
  PrevCueCompareSummary,
} from "../lib/stagePrevCueCompare";
import { describePrevCueChangeFact } from "../lib/stageMovementGrade";

export type StagePrevCueCompareOverlayProps = {
  marks: readonly PrevCueCompareMark[];
  markerPx?: number;
  /** true: ○→● に矢印。false: 点線だけ（比較） */
  showMotionArrows?: boolean;
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
  showMotionArrows = false,
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
        {showMotionArrows
          ? marks.map((m) => {
              const color = DANCER_PALETTE[modDancerColorIndex(m.colorIndex)]!;
              const markerId = `prev-cue-arrow-${m.dancerId}`;
              return (
                <g key={`cmp-arrow-${m.dancerId}`}>
                  <defs>
                    <marker
                      id={markerId}
                      markerWidth="3.4"
                      markerHeight="3.4"
                      refX="3"
                      refY="1.7"
                      orient="auto"
                    >
                      <path d="M0 0 L3.4 1.7 L0 3.4 z" fill={color} fillOpacity={0.55} />
                    </marker>
                  </defs>
                  <line
                    x1={m.fromXPct}
                    y1={m.fromYPct}
                    x2={m.toXPct}
                    y2={m.toYPct}
                    stroke={color}
                    strokeWidth={0.38}
                    strokeOpacity={0.5}
                    strokeLinecap="round"
                    markerEnd={`url(#${markerId})`}
                  />
                </g>
              );
            })
          : marks.map((m) => {
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
  motionViewOn = false,
  fromCueOrdinal = null,
  toCueOrdinal = null,
  onToggleMotionView,
}: {
  summary: PrevCueCompareSummary;
  motionViewOn?: boolean;
  fromCueOrdinal?: number | null;
  toCueOrdinal?: number | null;
  onToggleMotionView?: () => void;
}) {
  if (summary.matchedCount <= 0) return null;
  const changeFact = describePrevCueChangeFact({
    movedCount: summary.movedCount,
    maxMovePct: summary.maxMovePct,
  });
  return (
    <div data-prev-cue-compare-summary style={summaryWrap}>
      {motionViewOn && fromCueOrdinal != null && toCueOrdinal != null ? (
        <div
          data-prev-cue-motion-heading
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#e2e8f0",
            marginBottom: 8,
            lineHeight: 1.35,
          }}
        >
          <div>キュー {fromCueOrdinal}</div>
          <div style={{ color: "#94a3b8", fontWeight: 700 }}>↓</div>
          <div>キュー {toCueOrdinal}</div>
        </div>
      ) : (
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
      )}
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
      {motionViewOn ? (
        <div
          style={{
            marginTop: 8,
            fontWeight: 800,
            color: "#fde68a",
          }}
        >
          {changeFact}
        </div>
      ) : null}
      {onToggleMotionView ? (
        <button
          type="button"
          data-prev-cue-motion-view
          aria-pressed={motionViewOn}
          title="動いた人の移動方向を矢印で見る（歩かせない）"
          onClick={() => onToggleMotionView()}
          style={{
            marginTop: 8,
            width: "100%",
            height: 32,
            borderRadius: 8,
            border: motionViewOn
              ? "1px solid rgba(148,163,184,0.95)"
              : "1px solid #334155",
            background: motionViewOn ? "#1e293b" : "#0b1220",
            color: "#e2e8f0",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          動きを見る
        </button>
      ) : null}
    </div>
  );
}
