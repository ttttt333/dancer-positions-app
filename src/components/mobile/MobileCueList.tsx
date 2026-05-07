/**
 * MobileCueList — キュー一覧タブ
 *
 * キュー配列をリスト表示。タップで選択、＋ボタンで追加。
 */
import type { Dispatch, SetStateAction } from "react";
import type { Cue } from "../../types/choreography";
import { shell } from "../../theme/choreoShell";
import { formatMmSsClock } from "../../lib/timeFormat";
import { sortCuesByStart } from "../../lib/cueInterval";

export type MobileCueListProps = {
  cues: Cue[];
  selectedCueId: string | null;
  onSelectCue: (id: string) => void;
  onAddCue: () => void;
  isView?: boolean;
  currentTime?: number;
};

export function MobileCueList({
  cues,
  selectedCueId,
  onSelectCue,
  onAddCue,
  isView = false,
  currentTime,
}: MobileCueListProps) {
  const sorted = sortCuesByStart(cues);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: shell.bgDeep,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px 8px",
          flexShrink: 0,
          borderBottom: `1px solid ${shell.border}`,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: shell.textMuted,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          キュー一覧
        </span>
        {!isView && (
          <button
            type="button"
            onClick={onAddCue}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 12px",
              borderRadius: 20,
              border: "1px solid #22c55e50",
              background: "#22c55e18",
              color: "#22c55e",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
            aria-label="キューを追加"
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            追加
          </button>
        )}
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 32,
            color: shell.textSubtle,
          }}
        >
          <svg width={48} height={48} viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2" stroke={shell.textSubtle} strokeWidth="1.2" fill="none" />
            <path d="M7 8h4M7 12h4M7 16h4" stroke={shell.textSubtle} strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
            <path d="M15 14 V20 M12 17 H18" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 14, textAlign: "center", lineHeight: 1.5 }}>
            キューがまだありません{"\n"}「追加」から最初のキューを作成
          </span>
        </div>
      )}

      {/* Cue list */}
      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((cue, idx) => {
          const isSelected = cue.id === selectedCueId;
          const isActive =
            currentTime !== undefined &&
            currentTime >= cue.tStartSec &&
            currentTime < cue.tEndSec;

          return (
            <button
              key={cue.id}
              type="button"
              onClick={() => onSelectCue(cue.id)}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 12,
                border: `1px solid ${
                  isSelected
                    ? shell.accent + "60"
                    : isActive
                    ? "#22c55e40"
                    : shell.border
                }`,
                background: isSelected
                  ? shell.accent + "14"
                  : isActive
                  ? "#22c55e12"
                  : shell.surface,
                cursor: "pointer",
                textAlign: "left",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
                transition: "background 0.12s",
              }}
              aria-label={`キュー ${cue.name ?? idx + 1} を選択`}
              aria-pressed={isSelected}
            >
              {/* Index bubble */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  minWidth: 28,
                  borderRadius: 8,
                  background: isSelected
                    ? shell.accent + "30"
                    : isActive
                    ? "#22c55e25"
                    : shell.surfaceRaised,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: isSelected ? shell.accent : isActive ? "#22c55e" : shell.textMuted,
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </div>

              {/* Name + time */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? shell.text : shell.textMuted,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cue.name?.trim() || `キュー ${idx + 1}`}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: shell.textSubtle,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatMmSsClock(cue.tStartSec)} – {formatMmSsClock(cue.tEndSec)}
                  <span style={{ marginLeft: 6, opacity: 0.6 }}>
                    ({formatMmSsClock(cue.tEndSec - cue.tStartSec)})
                  </span>
                </span>
              </div>

              {/* Active indicator */}
              {isActive && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    background: "#22c55e",
                    flexShrink: 0,
                    boxShadow: "0 0 6px #22c55e",
                  }}
                />
              )}

              {/* Selected chevron */}
              {isSelected && !isActive && (
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
                  <path d="M9 6 L15 12 L9 18" stroke={shell.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom padding for safe area */}
      <div style={{ height: 8, flexShrink: 0 }} />
    </div>
  );
}
