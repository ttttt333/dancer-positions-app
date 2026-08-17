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

export type TimelineCue = { id: string; time: number; holdEnd?: number; label: string };
export type TimelineSection = { index: number; start: number; end: number; label: string };

export type CueWindow = {
  id: string;
  label: string;
  time: number;
  holdEnd: number;
  nextTime: number;
  hasMove: boolean;
};

export function resolveCueWindows(cues: TimelineCue[], duration: number): CueWindow[] {
  const total = duration > 0 ? duration : 1;
  const sorted = [...cues].sort((a, b) => a.time - b.time);
  return sorted.map((cue, i) => {
    const nextTime = sorted[i + 1]?.time ?? total;
    const raw = cue.holdEnd;
    const holdEnd = raw == null ? nextTime : Math.min(nextTime, Math.max(cue.time, raw));
    return {
      id: cue.id,
      label: cue.label,
      time: cue.time,
      holdEnd,
      nextTime,
      hasMove: nextTime - holdEnd > 0.05,
    };
  });
}

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
  onCueHoldEndChange,
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
  onCueHoldEndChange: (id: string, holdEnd: number) => void;
  onAddCueAt?: (time: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; moved: boolean; edge?: "start" | "end" } | null>(null);
  const total = duration > 0 ? duration : 1;
  const palette = ["#44403c", "#57534e", "#78716c", "#a8a29e"];
  const windows = resolveCueWindows(cues, total);

  const timeAt = (clientX: number) => {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return 0;
    const t = ((clientX - box.left) / box.width) * total;
    return Math.max(0, Math.min(total, Math.round(t * 10) / 10));
  };

  const applyEdge = (id: string, edge: "start" | "end", clientX: number) => {
    const win = windows.find((w) => w.id === id);
    if (!win) return;
    const t = timeAt(clientX);
    if (edge === "start") {
      const next = Math.min(win.holdEnd - 0.1, Math.max(0, t));
      onCueTimeChange(id, Math.max(0, next));
    } else {
      const next = Math.min(win.nextTime, Math.max(win.time + 0.1, t));
      onCueHoldEndChange(id, next);
    }
    onSeek(t);
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
          height: 78,
          borderRadius: 8,
          border: `1px solid ${shell.borderStrong}`,
          background: shell.bgChrome,
          overflow: "hidden",
          cursor: "pointer",
          userSelect: "none",
        }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-cue-marker]")) return;
          dragRef.current = { id: "__scrub__", moved: true };
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
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
          if (drag.id === "__scrub__") {
            onSeek(timeAt(e.clientX));
            return;
          }
          if (drag.edge) applyEdge(drag.id, drag.edge, e.clientX);
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
                height: 16,
                background: palette[i % palette.length],
                opacity: selected ? 0.95 : 0.5,
                borderRadius: 4,
                border: selected ? `1px solid ${shell.accent}` : "1px solid transparent",
                color: shell.text,
                fontSize: 10,
                overflow: "hidden",
                lineHeight: "16px",
                padding: 0,
                cursor: "pointer",
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelectSection(s.index);
                dragRef.current = { id: "__scrub__", moved: true };
                trackRef.current?.setPointerCapture(e.pointerId);
                onSeek(timeAt(e.clientX));
              }}
            >
              {s.label}
            </button>
          );
        })}
        {windows.map((win) => {
          const selected = win.id === selectedCueId;
          const holdLeft = (win.time / total) * 100;
          const holdWidth = Math.max(((win.holdEnd - win.time) / total) * 100, 0.8);
          const moveLeft = (win.holdEnd / total) * 100;
          const moveWidth = ((win.nextTime - win.holdEnd) / total) * 100;
          return (
            <div key={win.id}>
              <button
                type="button"
                data-cue-marker="1"
                title={`キュー ${win.label} 立ち位置 ${formatClock(win.time)}–${formatClock(win.holdEnd)}`}
                style={{
                  position: "absolute",
                  left: `${holdLeft}%`,
                  width: `${holdWidth}%`,
                  top: 24,
                  height: 48,
                  borderRadius: 3,
                  border: `1.5px solid ${selected ? "#fff" : shell.ruby}`,
                  background: selected ? "rgba(196,30,58,0.32)" : "rgba(196,30,58,0.16)",
                  boxShadow: selected ? "0 0 0 1px rgba(196,30,58,0.8)" : "none",
                  color: shell.text,
                  fontSize: 11,
                  fontWeight: 700,
                  zIndex: selected ? 5 : 3,
                  cursor: "pointer",
                  padding: 0,
                  overflow: "hidden",
                  lineHeight: "48px",
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dragRef.current = { id: win.id, moved: false };
                  onSelectCue(win.id);
                  onSeek(win.time);
                }}
              >
                {win.label}
                <span
                  data-cue-marker="1"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 8,
                    cursor: "ew-resize",
                    background: "rgba(196,30,58,0.35)",
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dragRef.current = { id: win.id, moved: true, edge: "start" };
                    onSelectCue(win.id);
                    (e.currentTarget as HTMLSpanElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (dragRef.current?.id !== win.id || dragRef.current.edge !== "start") return;
                    applyEdge(win.id, "start", e.clientX);
                  }}
                  onPointerUp={() => {
                    dragRef.current = null;
                  }}
                />
                <span
                  data-cue-marker="1"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: 8,
                    cursor: "ew-resize",
                    background: "rgba(196,30,58,0.35)",
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dragRef.current = { id: win.id, moved: true, edge: "end" };
                    onSelectCue(win.id);
                    (e.currentTarget as HTMLSpanElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (dragRef.current?.id !== win.id || dragRef.current.edge !== "end") return;
                    applyEdge(win.id, "end", e.clientX);
                  }}
                  onPointerUp={() => {
                    dragRef.current = null;
                  }}
                />
              </button>
              {win.hasMove ? (
                <button
                  type="button"
                  data-cue-marker="1"
                  title={`移動 ${formatClock(win.holdEnd)}–${formatClock(win.nextTime)}`}
                  style={{
                    position: "absolute",
                    left: `${moveLeft}%`,
                    width: `${Math.max(moveWidth, 0.6)}%`,
                    top: 28,
                    height: 40,
                    borderRadius: 3,
                    border: `1px dashed ${shell.accent}`,
                    background:
                      "repeating-linear-gradient(90deg, rgba(212,175,55,0.08) 0 5px, rgba(212,175,55,0.2) 5px 10px)",
                    color: shell.accent,
                    fontSize: 10,
                    zIndex: 2,
                    cursor: "pointer",
                    padding: 0,
                    overflow: "hidden",
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectCue(win.id);
                    onSeek(win.holdEnd);
                  }}
                >
                  移動
                </button>
              ) : null}
            </div>
          );
        })}
        <button
          type="button"
          aria-label="再生位置"
          title="ドラッグで再生位置を移動"
          style={{
            position: "absolute",
            left: `${(currentTime / total) * 100}%`,
            top: 0,
            bottom: 0,
            width: 18,
            marginLeft: -9,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "ew-resize",
            zIndex: 6,
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragRef.current = { id: "__scrub__", moved: true };
            (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
            onSeek(timeAt(e.clientX));
          }}
          onPointerMove={(e) => {
            if (dragRef.current?.id !== "__scrub__") return;
            onSeek(timeAt(e.clientX));
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 8,
              top: 0,
              bottom: 0,
              width: 2,
              background: shell.ruby,
              boxShadow: "0 0 0 1px rgba(196,30,58,0.35)",
              pointerEvents: "none",
            }}
          />
        </button>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 11, color: shell.textSubtle }}>
        赤枠が立ち位置の区間、点線が移動です。枠の左右端をドラッグして「いつまでその形か／いつ動き出すか」を直せます。
      </p>
    </div>
  );
}
