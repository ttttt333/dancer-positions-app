import type { CSSProperties } from "react";
import { btnSecondary } from "../../components/stageButtonStyles";
import { shell } from "../../theme/choreoShell";
import { formatClock, parseClock } from "./pilotCatalog";

const input: CSSProperties = {
  background: shell.bgChrome,
  color: shell.text,
  border: `1px solid ${shell.border}`,
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 13,
  minWidth: 0,
};

const label: CSSProperties = {
  fontSize: 11,
  color: shell.textSubtle,
  display: "block",
  marginBottom: 4,
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
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" style={{ ...btnSecondary, padding: "4px 8px", fontSize: 12 }} onClick={() => nudge(-1)}>
          −1秒
        </button>
        <button type="button" style={{ ...btnSecondary, padding: "4px 8px", fontSize: 12 }} onClick={() => nudge(-0.1)}>
          −0.1
        </button>
        <input
          style={{ ...input, width: 84 }}
          value={formatClock(value)}
          onChange={(e) => onChange(parseClock(e.target.value))}
        />
        <button type="button" style={{ ...btnSecondary, padding: "4px 8px", fontSize: 12 }} onClick={() => nudge(0.1)}>
          ＋0.1
        </button>
        <button type="button" style={{ ...btnSecondary, padding: "4px 8px", fontSize: 12 }} onClick={() => nudge(1)}>
          ＋1秒
        </button>
        {now != null ? (
          <button type="button" style={{ ...btnSecondary, padding: "4px 8px", fontSize: 12 }} onClick={() => onChange(now)}>
            今の再生位置
          </button>
        ) : null}
        {onSeek ? (
          <button type="button" style={{ ...btnSecondary, padding: "4px 8px", fontSize: 12 }} onClick={() => onSeek(value)}>
            ここへ再生
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
    <label style={{ display: "grid", gridTemplateColumns: "110px 1fr 52px", gap: 8, alignItems: "center", marginBottom: 8, fontSize: 13 }}>
      <span style={{ color: shell.textMuted }}>{caption}</span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span>
        {value}
        {suffix ? ` ${suffix}` : ""}
      </span>
    </label>
  );
}

type Mark = { start: number; end?: number; label: string; kind: "section" | "cue" };

export function AnnotateSongTimeline({
  duration,
  currentTime,
  marks,
  onSeek,
}: {
  duration: number;
  currentTime: number;
  marks: Mark[];
  onSeek: (t: number) => void;
}) {
  const total = duration > 0 ? duration : 1;
  const palette = ["#57534e", "#78716c", "#a8a29e", "#d6d3d1"];
  return (
    <div>
      <button
        type="button"
        aria-label="再生位置"
        style={{
          position: "relative",
          width: "100%",
          height: 36,
          borderRadius: 8,
          border: `1px solid ${shell.borderStrong}`,
          background: shell.bgChrome,
          padding: 0,
          cursor: "pointer",
          overflow: "hidden",
        }}
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          onSeek(((e.clientX - box.left) / box.width) * total);
        }}
      >
        {marks
          .filter((m) => m.kind === "section")
          .map((m, i) => {
            const left = (m.start / total) * 100;
            const width = (((m.end ?? m.start + 8) - m.start) / total) * 100;
            return (
              <span
                key={`s-${i}`}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  width: `${Math.max(width, 1.2)}%`,
                  top: 4,
                  bottom: 4,
                  background: palette[i % palette.length],
                  opacity: 0.45,
                  borderRadius: 4,
                  fontSize: 10,
                  color: shell.text,
                  overflow: "hidden",
                  textAlign: "center",
                  lineHeight: "28px",
                }}
              >
                {m.label}
              </span>
            );
          })}
        {marks
          .filter((m) => m.kind === "cue")
          .map((m, i) => (
            <span
              key={`c-${i}`}
              style={{
                position: "absolute",
                left: `${(m.start / total) * 100}%`,
                top: 6,
                width: 8,
                height: 24,
                marginLeft: -4,
                borderRadius: 2,
                background: shell.accent,
              }}
            />
          ))}
        <span
          style={{
            position: "absolute",
            left: `${(currentTime / total) * 100}%`,
            top: 0,
            bottom: 0,
            width: 2,
            background: shell.ruby,
          }}
        />
      </button>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: shell.textSubtle }}>
        バーをクリックするとその位置へジャンプします。金の線がキュー、赤が再生位置です。
      </p>
    </div>
  );
}
