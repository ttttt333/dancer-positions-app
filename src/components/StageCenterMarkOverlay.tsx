import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { StageCenterMark } from "../types/choreography";
import { clampCenterMarkPct } from "../lib/stageCenterMarks";

export type StageCenterMarkOverlayProps = {
  marks: readonly StageCenterMark[];
  floorRef: RefObject<HTMLElement | null>;
  /** 舞台設定パネル表示中のみ true。通常編集では触れない */
  editable: boolean;
  onChangeMarks: (next: StageCenterMark[]) => void;
};

/**
 * ヘソ／センターマークのドラッグハンドル。
 * ダンサー印より上に載せるが、editable=false のときは pointer-events なし
 * （立ち位置変更を邪魔しない）。
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
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

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
    const p = clientToPct(e.clientX, e.clientY);
    if (!p) return;
    const xPct = clampCenterMarkPct(p.xPct);
    const yPct = clampCenterMarkPct(p.yPct);
    onChangeMarks(
      marks.map((m) => (m.id === d.id ? { ...m, xPct, yPct } : m))
    );
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
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 6,
      }}
      aria-hidden={!editable}
    >
      {marks.map((m) => {
        const active = activeId === m.id;
        return (
          <button
            key={m.id}
            type="button"
            title={m.label?.trim() || "センターマーク"}
            aria-label={
              m.label?.trim()
                ? `${m.label.trim()}を移動`
                : "センターマークを移動"
            }
            disabled={!editable}
            onPointerDown={(e) => onPointerDown(e, m.id)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              position: "absolute",
              left: `${m.xPct}%`,
              top: `${m.yPct}%`,
              width: 28,
              height: 28,
              marginLeft: -14,
              marginTop: -14,
              borderRadius: "50%",
              border: active
                ? "2px solid rgba(250, 204, 21, 0.95)"
                : "1.5px solid rgba(248, 250, 252, 0.55)",
              background: active
                ? "rgba(250, 204, 21, 0.22)"
                : "rgba(15, 23, 42, 0.35)",
              boxShadow: active
                ? "0 0 0 3px rgba(250, 204, 21, 0.25)"
                : "none",
              cursor: editable ? "grab" : "default",
              pointerEvents: editable ? "auto" : "none",
              padding: 0,
              touchAction: "none",
            }}
          />
        );
      })}
    </div>
  );
}
