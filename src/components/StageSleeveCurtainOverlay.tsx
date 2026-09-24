import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { StageSleeveCurtain } from "../types/choreography";
import type { SleeveCurtainMark } from "../lib/stageSleeveCurtains";
import { formatDepthMmLabel } from "../lib/stageLighting";

export type StageSleeveCurtainOverlayProps = {
  marks: readonly SleeveCurtainMark[];
  curtains: readonly StageSleeveCurtain[];
  stageDepthMm: number;
  stageWidthMm: number;
  /** 片側そでスペース mm。0 ならメイン床端から */
  sideStageMm?: number;
  floorRef: RefObject<HTMLElement | null>;
  editable: boolean;
  onChangeCurtains: (next: StageSleeveCurtain[]) => void;
};

type DragMode = "depth" | "length";

function formatInsetLabel(mm: number): string {
  if (mm % 1000 === 0) return `${mm / 1000} m`;
  if (mm % 10 === 0) return `${(mm / 10).toFixed(0)} cm`;
  return `${mm} mm`;
}

/**
 * そで幕の表示。
 * - 本体ドラッグ: 奥行
 * - 内側端ハンドル: 横の長さ（そでスペースがあるときは外側へも伸ばせる）
 * 数字ラベルは出さず、右パネルで確認する。
 */
export function StageSleeveCurtainOverlay({
  marks,
  curtains,
  stageDepthMm,
  stageWidthMm,
  sideStageMm = 0,
  floorRef,
  editable,
  onChangeCurtains,
}: StageSleeveCurtainOverlayProps) {
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    mode: DragMode;
    side: "left" | "right";
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sideOverflowPct =
    sideStageMm > 0 && stageWidthMm > 0
      ? (sideStageMm / stageWidthMm) * 100
      : 0;
  const maxInsetMm = Math.max(
    100,
    Math.round(sideStageMm + stageWidthMm * 0.5)
  );

  const clientToPct = useCallback(
    (clientX: number, clientY: number) => {
      const el = floorRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 1e-6 || r.height < 1e-6) return null;
      return {
        xPct: ((clientX - r.left) / r.width) * 100,
        yPct: ((clientY - r.top) / r.height) * 100,
      };
    },
    [floorRef]
  );

  const patchCurtain = useCallback(
    (id: string, patch: Partial<StageSleeveCurtain>) => {
      onChangeCurtains(
        curtains.map((c) => (c.id === id ? { ...c, ...patch } : c))
      );
    },
    [curtains, onChangeCurtains]
  );

  const onPointerDown = (
    e: React.PointerEvent,
    id: string,
    mode: DragMode,
    side: "left" | "right"
  ) => {
    if (!editable || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id, pointerId: e.pointerId, mode, side };
    setActiveId(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const p = clientToPct(e.clientX, e.clientY);
    if (!p) return;
    if (d.mode === "depth") {
      const depthMm = Math.round(((100 - Math.max(0, Math.min(100, p.yPct))) / 100) * stageDepthMm);
      const snapped = Math.round(depthMm / 50) * 50;
      patchCurtain(d.id, {
        depthMm: Math.max(100, Math.min(stageDepthMm - 50, snapped)),
      });
      return;
    }
    // length: 内側端の位置から横長さを算出（そで側へは負の xPct まで含む）
    let insetPct: number;
    if (d.side === "left") {
      insetPct = p.xPct + sideOverflowPct;
    } else {
      insetPct = 100 + sideOverflowPct - p.xPct;
    }
    const rawMm = (insetPct / 100) * stageWidthMm;
    const snapped = Math.round(rawMm / 50) * 50;
    patchCurtain(d.id, {
      insetMm: Math.max(100, Math.min(maxInsetMm, snapped)),
    });
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

  return (
    <div
      data-sleeve-curtain-overlay
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 3,
        overflow: "visible",
      }}
    >
      {marks.map((m) => {
        const showLeft = m.side === "both" || m.side === "left";
        const showRight = m.side === "both" || m.side === "right";
        const active = activeId === m.id;
        const thicknessPct = 2.2;
        const bar = (side: "left" | "right") => (
          <div
            key={`${m.id}-${side}`}
            style={{
              position: "absolute",
              left: side === "left" ? `${-sideOverflowPct}%` : undefined,
              right: side === "right" ? `${-sideOverflowPct}%` : undefined,
              top: `${m.yPct}%`,
              width: `${m.insetPct}%`,
              height: `${thicknessPct}%`,
              minHeight: 12,
              transform: "translateY(-50%)",
              border: active
                ? "2px solid rgba(251, 113, 133, 1)"
                : "1px solid rgba(251, 113, 133, 0.85)",
              borderRadius: side === "left" ? "0 6px 6px 0" : "6px 0 0 6px",
              background: active
                ? "rgba(251, 113, 133, 0.55)"
                : "rgba(251, 113, 133, 0.32)",
              boxShadow: active ? "0 0 12px rgba(251, 113, 133, 0.45)" : "none",
              pointerEvents: "none",
            }}
          >
            {/* 奥行ドラッグ（本体） */}
            <button
              type="button"
              aria-label={`${m.label}（${side === "left" ? "下手" : "上手"}）奥行 ${formatDepthMmLabel(m.depthMm)}。上下ドラッグで奥行`}
              disabled={!editable}
              onPointerDown={(e) => onPointerDown(e, m.id, "depth", side)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                position: "absolute",
                inset: 0,
                margin: 0,
                padding: 0,
                border: "none",
                background: "transparent",
                cursor: editable ? "ns-resize" : "default",
                pointerEvents: editable ? "auto" : "none",
                touchAction: "none",
              }}
            />
            {/* 横長さドラッグ（内側端） */}
            <button
              type="button"
              aria-label={`${m.label} 横の長さ ${formatInsetLabel(m.insetMm)}。左右ドラッグで長さ`}
              disabled={!editable}
              onPointerDown={(e) => onPointerDown(e, m.id, "length", side)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              title={`横 ${formatInsetLabel(m.insetMm)}`}
              style={{
                position: "absolute",
                top: -4,
                bottom: -4,
                width: 10,
                ...(side === "left"
                  ? { right: -5 }
                  : { left: -5 }),
                margin: 0,
                padding: 0,
                border: "none",
                borderRadius: 4,
                background: editable
                  ? "rgba(251, 113, 133, 0.85)"
                  : "rgba(251, 113, 133, 0.4)",
                cursor: editable ? "ew-resize" : "default",
                pointerEvents: editable ? "auto" : "none",
                touchAction: "none",
                boxShadow: "0 0 0 1px rgba(15,23,42,0.5)",
              }}
            />
          </div>
        );
        return (
          <div key={m.id}>
            {showLeft ? bar("left") : null}
            {showRight ? bar("right") : null}
          </div>
        );
      })}
    </div>
  );
}
