import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { StageSleeveCurtain } from "../types/choreography";
import type { SleeveCurtainMark } from "../lib/stageSleeveCurtains";
import { formatDepthMmLabel } from "../lib/stageLighting";

export type StageSleeveCurtainOverlayProps = {
  marks: readonly SleeveCurtainMark[];
  curtains: readonly StageSleeveCurtain[];
  stageDepthMm: number;
  floorRef: RefObject<HTMLElement | null>;
  editable: boolean;
  /** ステージ回転角（正立ラベル用） */
  rot?: number;
  onChangeCurtains: (next: StageSleeveCurtain[]) => void;
};

function formatInsetLabel(mm: number): string {
  if (mm % 1000 === 0) return `${mm / 1000} m`;
  if (mm % 10 === 0) return `${(mm / 10).toFixed(0)} cm`;
  return `${mm} mm`;
}

/**
 * そで幕の表示＋奥行ドラッグ。左右袖を掴んで前後に動かせる。
 * ラベルは下手側に出し、横長さ（inset）は設定どおり端から伸ばす。
 */
export function StageSleeveCurtainOverlay({
  marks,
  curtains,
  stageDepthMm,
  floorRef,
  editable,
  rot = 0,
  onChangeCurtains,
}: StageSleeveCurtainOverlayProps) {
  const dragRef = useRef<{
    id: string;
    pointerId: number;
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const yPctToDepthMm = useCallback(
    (yPct: number) => {
      const clamped = Math.max(0, Math.min(100, yPct));
      return Math.round(((100 - clamped) / 100) * stageDepthMm);
    },
    [stageDepthMm]
  );

  const clientToYPct = useCallback(
    (clientY: number) => {
      const el = floorRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.height < 1e-6) return null;
      return ((clientY - r.top) / r.height) * 100;
    },
    [floorRef]
  );

  const updateDepth = useCallback(
    (id: string, depthMm: number) => {
      const snapped = Math.round(depthMm / 50) * 50;
      const nextMm = Math.max(100, Math.min(stageDepthMm - 50, snapped));
      onChangeCurtains(
        curtains.map((c) => (c.id === id ? { ...c, depthMm: nextMm } : c))
      );
    },
    [curtains, onChangeCurtains, stageDepthMm]
  );

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    if (!editable || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id, pointerId: e.pointerId };
    setActiveId(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const yPct = clientToYPct(e.clientY);
    if (yPct == null) return;
    updateDepth(d.id, yPctToDepthMm(yPct));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setActiveId(null);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  if (marks.length === 0) return null;
  const upright = ((rot % 360) + 360) % 360;

  return (
    <div
      data-sleeve-curtain-overlay
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 3,
      }}
    >
      {marks.map((m) => {
        const showLeft = m.side === "both" || m.side === "left";
        const showRight = m.side === "both" || m.side === "right";
        const active = activeId === m.id;
        const thicknessPct = Math.max(1.4, Math.min(3.2, 2.2));
        const handle = (side: "left" | "right") => (
          <button
            key={`${m.id}-${side}`}
            type="button"
            aria-label={`${m.label}（${side === "left" ? "下手" : "上手"}） ${formatDepthMmLabel(m.depthMm)}・横 ${formatInsetLabel(m.insetMm)}。ドラッグで奥行調整`}
            disabled={!editable}
            onPointerDown={(e) => onPointerDown(e, m.id)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              position: "absolute",
              left: side === "left" ? 0 : undefined,
              right: side === "right" ? 0 : undefined,
              top: `${m.yPct}%`,
              width: `${m.insetPct}%`,
              height: `${thicknessPct}%`,
              minHeight: 12,
              transform: "translateY(-50%)",
              margin: 0,
              padding: 0,
              border: active
                ? "2px solid rgba(251, 113, 133, 1)"
                : "1px solid rgba(251, 113, 133, 0.85)",
              borderRadius: side === "left" ? "0 6px 6px 0" : "6px 0 0 6px",
              background: active
                ? "rgba(251, 113, 133, 0.55)"
                : "rgba(251, 113, 133, 0.32)",
              cursor: editable ? "ns-resize" : "default",
              pointerEvents: editable ? "auto" : "none",
              boxShadow: active ? "0 0 12px rgba(251, 113, 133, 0.45)" : "none",
              touchAction: "none",
            }}
          />
        );
        // ラベルは下手側（左端付近）。右袖のみのときは上手側へ。
        const labelOnLeft = showLeft || !showRight;
        return (
          <div key={m.id}>
            {showLeft ? handle("left") : null}
            {showRight ? handle("right") : null}
            <div
              style={{
                position: "absolute",
                left: labelOnLeft ? "0.6%" : undefined,
                right: labelOnLeft ? undefined : "0.6%",
                top: `${m.yPct}%`,
                transform: `translateY(-50%) rotate(${-upright}deg)`,
                transformOrigin: labelOnLeft ? "left center" : "right center",
                pointerEvents: "none",
                fontSize: 9,
                fontWeight: 700,
                color: "#fda4af",
                background: "rgba(15, 23, 42, 0.82)",
                padding: "1px 5px",
                borderRadius: 3,
                whiteSpace: "nowrap",
                border: "1px solid rgba(251, 113, 133, 0.4)",
                maxWidth: "28%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                zIndex: 4,
              }}
              title={`${m.label} · ${formatDepthMmLabel(m.depthMm)} · 横 ${formatInsetLabel(m.insetMm)}`}
            >
              {m.label} ·{" "}
              {formatDepthMmLabel(m.depthMm).replace(/^前から\s*/, "")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
