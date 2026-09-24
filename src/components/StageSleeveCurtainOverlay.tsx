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
  /** 片側そでスペース mm */
  sideStageMm?: number;
  floorRef: RefObject<HTMLElement | null>;
  editable: boolean;
  onChangeCurtains: (next: StageSleeveCurtain[]) => void;
};

/** depth=奥行 / inset=舞台端から内側 / wing=舞台端からそで側 */
type DragMode = "depth" | "inset" | "wing";

function formatLen(mm: number): string {
  if (mm <= 0) return "0";
  if (mm % 1000 === 0) return `${mm / 1000} m`;
  if (mm % 10 === 0) return `${(mm / 10).toFixed(0)} cm`;
  return `${mm} mm`;
}

/**
 * そで幕。基準は舞台端。
 * - 内側ハンドル: 舞台へはみ出す長さ
 * - 外側ハンドル: そでスペース側（一番奥）への長さ
 * - 本体上下: 奥行
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

  const maxInsetMm = Math.max(0, Math.round(stageWidthMm * 0.5));
  const maxWingMm = Math.max(0, sideStageMm);

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
      const depthMm = Math.round(
        ((100 - Math.max(0, Math.min(100, p.yPct))) / 100) * stageDepthMm
      );
      const snapped = Math.round(depthMm / 50) * 50;
      patchCurtain(d.id, {
        depthMm: Math.max(100, Math.min(stageDepthMm - 50, snapped)),
      });
      return;
    }

    // 基準: 舞台端（左=0% / 右=100%）
    if (d.mode === "inset") {
      // 内側へ（舞台上）
      let ontoPct: number;
      if (d.side === "left") {
        ontoPct = Math.max(0, p.xPct);
      } else {
        ontoPct = Math.max(0, 100 - p.xPct);
      }
      const rawMm = (ontoPct / 100) * stageWidthMm;
      const snapped = Math.round(rawMm / 50) * 50;
      patchCurtain(d.id, {
        insetMm: Math.max(0, Math.min(maxInsetMm, snapped)),
      });
      return;
    }

    // wing: そで側（一番奥）
    if (maxWingMm <= 0) return;
    let wingPct: number;
    if (d.side === "left") {
      // xPct < 0 がそで側
      wingPct = Math.max(0, -p.xPct);
    } else {
      wingPct = Math.max(0, p.xPct - 100);
    }
    const rawMm = (wingPct / 100) * stageWidthMm;
    const snapped = Math.round(rawMm / 50) * 50;
    patchCurtain(d.id, {
      wingExtentMm: Math.max(0, Math.min(maxWingMm, snapped)),
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
        const thicknessPct = 1.1;
        // 見た目の幅がほぼ 0 でも掴めるよう最低幅を確保
        const visualWidthPct = Math.max(m.wingPct + m.insetPct, 0.8);

        const bar = (side: "left" | "right") => (
          <div
            key={`${m.id}-${side}`}
            style={{
              position: "absolute",
              // 舞台端を基準: そで側へ wingPct、内側へ insetPct
              left:
                side === "left"
                  ? `${-m.wingPct}%`
                  : undefined,
              right:
                side === "right"
                  ? `${-m.wingPct}%`
                  : undefined,
              top: `${m.yPct}%`,
              width: `${visualWidthPct}%`,
              height: `${thicknessPct}%`,
              minHeight: 6,
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
            {/* 奥行 */}
            <button
              type="button"
              aria-label={`${m.label} 奥行 ${formatDepthMmLabel(m.depthMm)}`}
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
            {/* 内側＝舞台端から内側への長さ */}
            <button
              type="button"
              aria-label={`${m.label} 舞台端から内側 ${formatLen(m.insetMm)}`}
              disabled={!editable}
              onPointerDown={(e) => onPointerDown(e, m.id, "inset", side)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              title={`内側 ${formatLen(m.insetMm)}`}
              style={{
                position: "absolute",
                top: -4,
                bottom: -4,
                width: 10,
                ...(side === "left" ? { right: -5 } : { left: -5 }),
                margin: 0,
                padding: 0,
                border: "none",
                borderRadius: 4,
                background: editable
                  ? "rgba(251, 113, 133, 0.95)"
                  : "rgba(251, 113, 133, 0.4)",
                cursor: editable ? "ew-resize" : "default",
                pointerEvents: editable ? "auto" : "none",
                touchAction: "none",
                boxShadow: "0 0 0 1px rgba(15,23,42,0.5)",
              }}
            />
            {/* 外側＝そで側（一番奥）。サイドがあるときだけ */}
            {maxWingMm > 0 ? (
              <button
                type="button"
                aria-label={`${m.label} そで側 ${formatLen(m.wingExtentMm)}`}
                disabled={!editable}
                onPointerDown={(e) => onPointerDown(e, m.id, "wing", side)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                title={`そで側 ${formatLen(m.wingExtentMm)}`}
                style={{
                  position: "absolute",
                  top: -4,
                  bottom: -4,
                  width: 10,
                  ...(side === "left" ? { left: -5 } : { right: -5 }),
                  margin: 0,
                  padding: 0,
                  border: "none",
                  borderRadius: 4,
                  background: editable
                    ? "rgba(244, 114, 182, 0.95)"
                    : "rgba(244, 114, 182, 0.4)",
                  cursor: editable ? "ew-resize" : "default",
                  pointerEvents: editable ? "auto" : "none",
                  touchAction: "none",
                  boxShadow: "0 0 0 1px rgba(15,23,42,0.5)",
                }}
              />
            ) : null}
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
