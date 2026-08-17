import { useRef, type CSSProperties } from "react";
import { btnSecondary } from "../../components/stageButtonStyles";
import { shell } from "../../theme/choreoShell";
import { formatClock, parseClock } from "./pilotCatalog";

const input: CSSProperties = {
  background: shell.bgChrome,
  color: shell.text,
  border: `1px solid ${shell.border}`,
  borderRadius: 6,
  padding: "4px 6px",
  fontSize: 12,
  minWidth: 0,
};

const label: CSSProperties = {
  fontSize: 10,
  color: shell.textSubtle,
  display: "block",
  marginBottom: 2,
};

const tinyBtn: CSSProperties = {
  ...btnSecondary,
  padding: "3px 6px",
  fontSize: 11,
  borderRadius: 6,
};

export function TimeField({
  caption,
  value,
  onChange,
  now,
  onSeek,
}: {
  caption: string;
  value: number;
  onChange: (next: number) => void;
  now?: number;
  onSeek?: (t: number) => void;
}) {
  const nudge = (delta: number) => onChange(Math.max(0, Math.round((value + delta) * 10) / 10));
  return (
    <div>
      <span style={label}>{caption}</span>
      <div style={{ display: "flex", gap: 3, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" style={tinyBtn} onClick={() => nudge(-1)}>
          −1
        </button>
        <button type="button" style={tinyBtn} onClick={() => nudge(-0.1)}>
          −0.1
        </button>
        <input style={{ ...input, width: 68 }} value={formatClock(value)} onChange={(e) => onChange(parseClock(e.target.value))} />
        <button type="button" style={tinyBtn} onClick={() => nudge(0.1)}>
          ＋0.1
        </button>
        <button type="button" style={tinyBtn} onClick={() => nudge(1)}>
          ＋1
        </button>
        {now != null ? (
          <button type="button" style={tinyBtn} onClick={() => onChange(now)}>
            今
          </button>
        ) : null}
        {onSeek ? (
          <button type="button" style={tinyBtn} onClick={() => onSeek(value)}>
            ▶
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ScoreSlider({
  caption,
  value,
  onChange,
  suffix,
}: {
  caption: string;
  value: number;
  onChange: (next: number) => void;
  suffix?: string;
}) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "88px 1fr 40px", gap: 6, alignItems: "center", marginBottom: 4, fontSize: 12 }}>
      <span style={{ color: shell.textMuted }}>{caption}</span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span>
        {value}
        {suffix ? ` ${suffix}` : ""}
      </span>
    </label>
  );
}

export type TimelineCue = { id: string; time: number; label: string };
export type TimelineSection = { index: number; start: number; end: number; label: string };

export function AnnotateSongTimeline({
  duration,
  currentTime,
  cues,
  sections,
  selectedCueId,
  selectedSectionIndex,
  onSeek,
  onSelectCue,
  onSelectSection,
  onCueTimeChange,
  onAddCueAt,
}: {
  duration: number;
  currentTime: number;
  cues: TimelineCue[];
  sections: TimelineSection[];
  selectedCueId: string | null;
  selectedSectionIndex: number | null;
  onSeek: (t: number) => void;
  onSelectCue: (id: string) => void;
  onSelectSection: (index: number) => void;
  onCueTimeChange: (id: string, time: number) => void;
  onAddCueAt?: (time: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const total = duration > 0 ? duration : 1;
  const palette = ["#44403c", "#57534e", "#78716c", "#a8a29e"];

  const timeAt = (clientX: number) => {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return 0;
    const t = ((clientX - box.left) / box.width) * total;
    return Math.max(0, Math.min(total, Math.round(t * 10) / 10));
  };

  return (
    <div>
      <div
        ref={trackRef}
        role="slider"
        aria-label="再生位置とキュー"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={currentTime}
        style={{
          position: "relative",
          width: "100%",
          height: 56,
          borderRadius: 8,
          border: `1px solid ${shell.borderStrong}`,
          background: shell.bgChrome,
          overflow: "hidden",
          cursor: "pointer",
          userSelect: "none",
        }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-cue-marker]")) return;
          onSeek(timeAt(e.clientX));
        }}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-cue-marker]")) return;
          onAddCueAt?.(timeAt(e.clientX));
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag) return;
          drag.moved = true;
          const t = timeAt(e.clientX);
          onCueTimeChange(drag.id, t);
          onSeek(t);
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
      >
        {sections.map((s, i) => {
          const left = (s.start / total) * 100;
          const width = ((s.end - s.start) / total) * 100;
          const selected = selectedSectionIndex === s.index;
          return (
            <button
              key={`s-${s.index}`}
              type="button"
              title={`${s.label} ${formatClock(s.start)}–${formatClock(s.end)}`}
              style={{
                position: "absolute",
                left: `${left}%`,
                width: `${Math.max(width, 1.2)}%`,
                top: 4,
                height: 18,
                background: palette[i % palette.length],
                opacity: selected ? 0.95 : 0.5,
                borderRadius: 4,
                border: selected ? `1px solid ${shell.accent}` : "1px solid transparent",
                color: shell.text,
                fontSize: 10,
                overflow: "hidden",
                lineHeight: "18px",
                padding: 0,
                cursor: "pointer",
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelectSection(s.index);
                onSeek(s.start);
              }}
            >
              {s.label}
            </button>
          );
        })}
        {cues.map((cue, i) => {
          const selected = cue.id === selectedCueId;
          return (
            <button
              key={cue.id}
              type="button"
              data-cue-marker="1"
              title={`キュー ${i + 1} ${formatClock(cue.time)}`}
              style={{
                position: "absolute",
                left: `${(cue.time / total) * 100}%`,
                top: 26,
                width: 22,
                height: 22,
                marginLeft: -11,
                borderRadius: "50%",
                border: selected ? `2px solid #fff` : `1px solid ${shell.accentDeep}`,
                background: selected ? shell.accent : "#a67c2d",
                color: "#14100a",
                fontSize: 11,
                fontWeight: 700,
                zIndex: selected ? 5 : 3,
                cursor: "ew-resize",
                padding: 0,
                boxShadow: selected ? "0 0 0 3px rgba(212,175,55,0.35)" : "none",
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dragRef.current = { id: cue.id, moved: false };
                onSelectCue(cue.id);
                (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const drag = dragRef.current;
                if (!drag || drag.id !== cue.id) return;
                drag.moved = true;
                const t = timeAt(e.clientX);
                onCueTimeChange(drag.id, t);
                onSeek(t);
              }}
              onPointerUp={(e) => {
                const drag = dragRef.current;
                if (!drag || drag.id !== cue.id || !drag.moved) onSeek(cue.time);
                dragRef.current = null;
                e.stopPropagation();
              }}
            >
              {i + 1}
            </button>
          );
        })}
        <span
          style={{
            position: "absolute",
            left: `${(currentTime / total) * 100}%`,
            top: 0,
            bottom: 0,
            width: 2,
            background: shell.ruby,
            zIndex: 4,
            pointerEvents: "none",
          }}
        />
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 11, color: shell.textSubtle }}>
        金の丸がキュー。ドラッグで秒数を修正、クリックで選択。バーをダブルクリックするとそこにキューを打ちます。赤が再生位置。
      </p>
    </div>
  );
}
