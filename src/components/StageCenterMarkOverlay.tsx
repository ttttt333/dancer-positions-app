import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { StageCenterMark } from "../types/choreography";
import {
  clampCenterMarkAxis,
  clampCenterMarkPct,
  resolveCenterMarkAxes,
  resolveCenterMarkShape,
} from "../lib/stageCenterMarks";

export type StageCenterMarkOverlayProps = {
  marks: readonly StageCenterMark[];
  floorRef: RefObject<HTMLElement | null>;
  /** 舞台設定パネル表示中のみ true。通常編集では触れない */
  editable: boolean;
  onChangeMarks: (next: StageCenterMark[]) => void;
};

type DragMode = "move" | "rx" | "ry";

/**
 * ヘソ／センターマークの移動・サイズハンドル。
 * editable=false のときは pointer-events なし（立ち位置変更を邪魔しない）。
 */
export function StageCenterMarkOverlay({
  marks,
  floorRef,
  editable,
  onChangeMarks,
}: StageCenterMarkOverlayProps) {
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    mode: DragMode;
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [floorAspect, setFloorAspect] = useState(1);

  useLayoutEffect(() => {
    if (!editable) {
      setSelectedId(null);
      return;
    }
    if (marks.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((cur) =>
      cur && marks.some((m) => m.id === cur) ? cur : marks[0]!.id
    );
  }, [editable, marks]);

  useLayoutEffect(() => {
    const el = floorRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) {
        setFloorAspect(r.width / r.height);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [floorRef]);

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

  const patch = useCallback(
    (id: string, next: Partial<StageCenterMark>) => {
      onChangeMarks(marks.map((m) => (m.id === id ? { ...m, ...next } : m)));
    },
    [marks, onChangeMarks]
  );

  const onPointerDown = (
    e: React.PointerEvent,
    id: string,
    mode: DragMode
  ) => {
    if (!editable || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id, pointerId: e.pointerId, mode };
    setActiveId(id);
    setSelectedId(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const m = marks.find((x) => x.id === d.id);
    if (!m) return;
    const p = clientToPct(e.clientX, e.clientY);
    if (!p) return;

    if (d.mode === "move") {
      patch(d.id, {
        xPct: clampCenterMarkPct(p.xPct),
        yPct: clampCenterMarkPct(p.yPct),
      });
      return;
    }

    const shape = resolveCenterMarkShape(m);
    if (d.mode === "rx") {
      const raw = Math.abs(p.xPct - m.xPct);
      const rx = clampCenterMarkAxis(raw);
      if (shape === "circle") {
        patch(d.id, { rxPct: rx, ryPct: undefined, shape: "circle" });
      } else {
        const axes = resolveCenterMarkAxes(m, floorAspect);
        patch(d.id, { rxPct: rx, ryPct: axes.ry, shape: "ellipse" });
      }
      return;
    }

    const raw = Math.abs(p.yPct - m.yPct);
    const ry = clampCenterMarkAxis(raw);
    if (shape === "circle") {
      const rx = clampCenterMarkAxis(ry / Math.max(0.15, floorAspect));
      patch(d.id, { rxPct: rx, ryPct: undefined, shape: "circle" });
    } else {
      const axes = resolveCenterMarkAxes(m, floorAspect);
      patch(d.id, { rxPct: axes.rx, ryPct: ry, shape: "ellipse" });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setActiveId(null);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  if (marks.length === 0) return null;

  return (
    <div
      data-center-mark-overlay
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 12,
      }}
      aria-hidden={!editable}
    >
      {marks.map((m) => {
        const { rx, ry } = resolveCenterMarkAxes(m, floorAspect);
        const active = activeId === m.id;
        const selected = selectedId === m.id || active;
        const shape = resolveCenterMarkShape(m);
        return (
          <div key={m.id} style={{ pointerEvents: "none" }}>
            <button
              type="button"
              title={
                m.label?.trim()
                  ? `${m.label.trim()}（ドラッグで移動）`
                  : "センターマーク（ドラッグで移動）"
              }
              aria-label={
                m.label?.trim()
                  ? `${m.label.trim()}を移動`
                  : "センターマークを移動"
              }
              disabled={!editable}
              onPointerDown={(e) => onPointerDown(e, m.id, "move")}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                position: "absolute",
                left: `${m.xPct}%`,
                top: `${m.yPct}%`,
                width: `${Math.max(rx * 2, 2)}%`,
                height: `${Math.max(ry * 2, 2)}%`,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                border: selected
                  ? "2px solid rgba(250, 204, 21, 0.95)"
                  : "1.5px solid rgba(250, 204, 21, 0.55)",
                background: selected
                  ? "rgba(250, 204, 21, 0.18)"
                  : "rgba(250, 204, 21, 0.08)",
                boxShadow: selected
                  ? "0 0 0 3px rgba(250, 204, 21, 0.22)"
                  : "none",
                cursor: editable ? "grab" : "default",
                pointerEvents: editable ? "auto" : "none",
                padding: 0,
                touchAction: "none",
              }}
            />
            {editable && selected ? (
              <>
                <button
                  type="button"
                  aria-label="横サイズ"
                  title={`横 ${rx.toFixed(1)}%`}
                  onPointerDown={(e) => onPointerDown(e, m.id, "rx")}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  style={{
                    position: "absolute",
                    left: `${Math.min(98, m.xPct + rx)}%`,
                    top: `${m.yPct}%`,
                    width: 12,
                    height: 12,
                    margin: 0,
                    padding: 0,
                    transform: "translate(-50%, -50%)",
                    borderRadius: 2,
                    border: "1px solid #0f172a",
                    background: "#fde68a",
                    cursor: "ew-resize",
                    pointerEvents: "auto",
                    touchAction: "none",
                  }}
                />
                <button
                  type="button"
                  aria-label="縦サイズ"
                  title={
                    shape === "circle"
                      ? `サイズ（正円） ${rx.toFixed(1)}%`
                      : `縦 ${ry.toFixed(1)}%`
                  }
                  onPointerDown={(e) => onPointerDown(e, m.id, "ry")}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  style={{
                    position: "absolute",
                    left: `${m.xPct}%`,
                    top: `${Math.min(98, m.yPct + ry)}%`,
                    width: 12,
                    height: 12,
                    margin: 0,
                    padding: 0,
                    transform: "translate(-50%, -50%)",
                    borderRadius: 2,
                    border: "1px solid #0f172a",
                    background: "#fde68a",
                    cursor: "ns-resize",
                    pointerEvents: "auto",
                    touchAction: "none",
                  }}
                />
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
