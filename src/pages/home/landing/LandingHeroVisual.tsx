import { useEffect, useMemo, useState } from "react";

type Spot = { x: number; y: number };

const SECTIONS = [
  { id: "intro", label: "INTRO", t: "0:00" },
  { id: "verse", label: "VERSE", t: "0:12" },
  { id: "pre", label: "PRE-CHORUS", t: "0:32" },
  { id: "chorus", label: "CHORUS", t: "0:48" },
  { id: "break", label: "BREAK", t: "1:18" },
  { id: "outro", label: "OUTRO", t: "1:58" },
] as const;

/** Demo formations — illustrative, not product screenshots */
const FORMATIONS: Spot[][] = [
  // INTRO — tight center cluster
  [
    { x: 42, y: 48 },
    { x: 50, y: 42 },
    { x: 58, y: 48 },
    { x: 46, y: 58 },
    { x: 54, y: 58 },
    { x: 50, y: 68 },
  ],
  // VERSE — shallow V
  [
    { x: 22, y: 62 },
    { x: 36, y: 48 },
    { x: 50, y: 38 },
    { x: 64, y: 48 },
    { x: 78, y: 62 },
    { x: 50, y: 58 },
  ],
  // PRE — wide line
  [
    { x: 18, y: 52 },
    { x: 34, y: 52 },
    { x: 50, y: 52 },
    { x: 66, y: 52 },
    { x: 82, y: 52 },
    { x: 50, y: 70 },
  ],
  // CHORUS — depth + impact
  [
    { x: 20, y: 70 },
    { x: 35, y: 55 },
    { x: 50, y: 35 },
    { x: 65, y: 55 },
    { x: 80, y: 70 },
    { x: 50, y: 58 },
  ],
  // BREAK — split wings
  [
    { x: 16, y: 40 },
    { x: 24, y: 58 },
    { x: 40, y: 70 },
    { x: 60, y: 70 },
    { x: 76, y: 58 },
    { x: 84, y: 40 },
  ],
  // OUTRO — soft arc
  [
    { x: 24, y: 58 },
    { x: 36, y: 44 },
    { x: 50, y: 36 },
    { x: 64, y: 44 },
    { x: 76, y: 58 },
    { x: 50, y: 62 },
  ],
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function interpolateFormation(from: Spot[], to: Spot[], t: number): Spot[] {
  const n = Math.min(from.length, to.length);
  const out: Spot[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: lerp(from[i].x, to[i].x, t),
      y: lerp(from[i].y, to[i].y, t),
    });
  }
  return out;
}

/**
 * Hero visual: music sections + playhead + morphing formation.
 * Pure CSS/RAF demo — not a product screenshot.
 */
export function LandingHeroVisual() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPhase(0.35);
      return;
    }
    let raf = 0;
    const started = performance.now();
    const cycleMs = 14000;

    const tick = (now: number) => {
      const p = ((now - started) % cycleMs) / cycleMs;
      setPhase(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { sectionIndex, blend, spots, inTransition } = useMemo(() => {
    const n = SECTIONS.length;
    const raw = phase * n;
    const i = Math.min(n - 1, Math.floor(raw));
    const local = raw - i;
    // Last 28% of each section = transition toward next
    const next = Math.min(n - 1, i + 1);
    const transitioning = i < n - 1 && local > 0.72;
    const blendT = transitioning ? (local - 0.72) / 0.28 : 0;
    const from = FORMATIONS[i];
    const to = FORMATIONS[next];
    return {
      sectionIndex: i,
      blend: blendT,
      spots: interpolateFormation(from, to, blendT),
      inTransition: transitioning,
    };
  }, [phase]);

  const playheadPct = phase * 100;

  return (
    <div className="lv2-hero-visual" aria-hidden>
      <div className="lv2-hero-visual__chrome">
        <span className="lv2-hero-visual__live">SYNC</span>
        <span>Music × Formation</span>
        <span className="lv2-hero-visual__mode">
          {inTransition ? "TRANSITION" : `FORMATION ${String.fromCharCode(65 + sectionIndex)}`}
        </span>
      </div>

      <div className="lv2-hero-timeline">
        <div className="lv2-hero-timeline__bars">
          {Array.from({ length: 56 }, (_, i) => (
            <i
              key={i}
              style={{
                height: `${18 + ((i * 13) % 70)}%`,
                opacity: Math.abs(i / 56 - phase) < 0.04 ? 1 : 0.28 + (i % 7) * 0.05,
              }}
            />
          ))}
          <div className="lv2-hero-playhead" style={{ left: `${playheadPct}%` }} />
        </div>
        <div className="lv2-hero-sections">
          {SECTIONS.map((s, i) => (
            <span
              key={s.id}
              className={i === sectionIndex ? "is-on" : undefined}
              style={{ flex: i === 3 || i === 1 ? 1.35 : 1 }}
            >
              <b>{s.t}</b>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className={`lv2-hero-stage ${inTransition ? "is-transitioning" : ""}`}>
        <div className="lv2-hero-stage__grid" />
        <div className="lv2-hero-stage__label lv2-hero-stage__label--back">UPSTAGE</div>
        <div className="lv2-hero-stage__label lv2-hero-stage__label--aud">AUDIENCE</div>
        {spots.map((p, i) => (
          <div
            key={i}
            className="lv2-hero-dot"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              transition: "none",
            }}
          >
            {i + 1}
          </div>
        ))}
        {inTransition ? (
          <div className="lv2-hero-transition-chip">
            Arrive for the moment · {Math.round(blend * 100)}%
          </div>
        ) : null}
      </div>

      <div className="lv2-hero-track">
        <span className={inTransition ? undefined : "is-on"}>FORMATION</span>
        <span className="lv2-hero-track__arrow">→</span>
        <span className={inTransition ? "is-on" : undefined}>TRANSITION</span>
        <span className="lv2-hero-track__arrow">→</span>
        <span>ARRIVAL</span>
      </div>
    </div>
  );
}
