import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { StageLightFixture } from "../types/choreography";
import { hexToRgba, resolveLightAxes } from "../lib/stageLighting";

export type StageLightingOverlayProps = {
  lights: readonly StageLightFixture[];
  /** 編集可（再生中・閲覧以外） */
  editable?: boolean;
  /** true のときウォッシュ（色）は描かずハンドルのみ */
  handlesOnly?: boolean;
  selectedId?: string | null;
  onSelectId?: (id: string | null) => void;
  onChangeLights?: (next: StageLightFixture[]) => void;
  floorRef?: RefObject<HTMLElement | null>;
};

type DragMode = "move" | "rx" | "ry" | "intensity";

/**
 * 点灯中の照明を床に重ねる。
 * 編集時は中央丸なし：範囲内ドラッグで移動、端の□で縦横サイズ、角で濃さ。
 */
export function StageLightingOverlay({
  lights,
  editable = false,
  handlesOnly = false,
  selectedId = null,
  onSelectId,
  onChangeLights,
  floorRef,
}: StageLightingOverlayProps) {
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    mode: DragMode;
    originIntensity: number;
    originClientY: number;
  } | null>(null);
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const [floorAspect, setFloorAspect] = useState(1);
  const activeId = selectedId ?? localSelected;

  useLayoutEffect(() => {
    const el = floorRef?.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) setFloorAspect(r.width / r.height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [floorRef]);

  const select = useCallback(
    (id: string | null) => {
      setLocalSelected(id);
      onSelectId?.(id);
    },
    [onSelectId]
  );

  const patch = useCallback(
    (id: string, partial: Partial<StageLightFixture>) => {
      if (!onChangeLights) return;
      onChangeLights(lights.map((L) => (L.id === id ? { ...L, ...partial } : L)));
    },
    [lights, onChangeLights]
  );

  const clientToPct = useCallback(
    (clientX: number, clientY: number) => {
      const el = floorRef?.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 1e-6 || r.height < 1e-6) return null;
      return {
        xPct: Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)),
        yPct: Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100)),
      };
    },
    [floorRef]
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
    const L = lights.find((x) => x.id === id);
    dragRef.current = {
      id,
      pointerId: e.pointerId,
      mode,
      originIntensity: L?.intensity ?? 0.35,
      originClientY: e.clientY,
    };
    select(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const L = lights.find((x) => x.id === d.id);
    if (!L) return;

    if (d.mode === "intensity") {
      const delta = (d.originClientY - e.clientY) / 100;
      const next = Math.max(0.05, Math.min(1, d.originIntensity + delta));
      patch(d.id, { intensity: Math.round(next * 100) / 100 });
      return;
    }

    const p = clientToPct(e.clientX, e.clientY);
    if (!p) return;

    if (d.mode === "move") {
      patch(d.id, {
        xPct: Math.round(p.xPct * 10) / 10,
        yPct: Math.round(p.yPct * 10) / 10,
      });
      return;
    }

    const shape = L.shape === "circle" ? "circle" : "ellipse";
    if (d.mode === "rx") {
      const raw = Math.abs(p.xPct - L.xPct);
      const rx = Math.round(Math.max(2, Math.min(60, raw)) * 2) / 2;
      if (shape === "circle") {
        patch(d.id, { rxPct: rx, ryPct: undefined, shape: "circle" });
      } else {
        const axes = resolveLightAxes(L, floorAspect);
        patch(d.id, { rxPct: rx, ryPct: axes.ry, shape: "ellipse" });
      }
      return;
    }

    // ry
    const raw = Math.abs(p.yPct - L.yPct);
    const ry = Math.round(Math.max(2, Math.min(60, raw)) * 2) / 2;
    if (shape === "circle") {
      // 正円: 画面上の距離から横半径へ
      const rx = Math.round(Math.max(2, Math.min(60, ry / floorAspect)) * 2) / 2;
      patch(d.id, { rxPct: rx, ryPct: undefined, shape: "circle" });
    } else {
      const axes = resolveLightAxes(L, floorAspect);
      patch(d.id, { rxPct: axes.rx, ryPct: ry, shape: "ellipse" });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  if (!lights.length) return null;

  return (
    <div
      data-stage-lighting-overlay
      style={{
        position: "absolute",
        inset: 0,
        zIndex: editable || handlesOnly ? 12 : 3,
        pointerEvents: "none",
      }}
    >
      {!handlesOnly ? (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
          aria-hidden
        >
          <defs>
            {lights.map((L) => (
              <radialGradient
                key={`lg-${L.id}`}
                id={`stage-light-${L.id}`}
                cx="50%"
                cy="50%"
                r="50%"
              >
                <stop
                  offset="0%"
                  stopColor={hexToRgba(
                    L.color,
                    Math.min(0.85, L.intensity * 0.95)
                  )}
                />
                <stop
                  offset="55%"
                  stopColor={hexToRgba(L.color, L.intensity * 0.35)}
                />
                <stop offset="100%" stopColor={hexToRgba(L.color, 0)} />
              </radialGradient>
            ))}
          </defs>
          {lights.map((L) => {
            const { rx, ry } = resolveLightAxes(L, floorAspect);
            return (
              <ellipse
                key={L.id}
                cx={L.xPct}
                cy={L.yPct}
                rx={rx}
                ry={ry}
                fill={`url(#stage-light-${L.id})`}
              />
            );
          })}
        </svg>
      ) : null}

      {editable || handlesOnly
        ? lights.map((L) => {
            const { rx, ry } = resolveLightAxes(L, floorAspect);
            const selected = activeId === L.id;
            return (
              <div key={`hit-${L.id}`} style={{ pointerEvents: "none" }}>
                {/* 範囲内ドラッグで移動（中央の丸は出さない） */}
                <div
                  role="button"
                  tabIndex={-1}
                  aria-label={`${L.label ?? "照明"} を移動`}
                  title="範囲をドラッグで移動"
                  onPointerDown={(e) => onPointerDown(e, L.id, "move")}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onClick={(e) => {
                    e.stopPropagation();
                    select(L.id);
                  }}
                  style={{
                    position: "absolute",
                    left: `${L.xPct}%`,
                    top: `${L.yPct}%`,
                    width: `${rx * 2}%`,
                    height: `${ry * 2}%`,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    border: selected
                      ? "1.5px solid rgba(253,230,138,0.85)"
                      : "1px solid transparent",
                    background: "transparent",
                    cursor: "move",
                    pointerEvents: "auto",
                    touchAction: "none",
                  }}
                />
                {/* 横サイズ */}
                <button
                  type="button"
                  aria-label={`${L.label ?? "照明"} の横サイズ`}
                  title={`横 ${rx.toFixed(0)}%`}
                  onPointerDown={(e) => onPointerDown(e, L.id, "rx")}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  style={{
                    position: "absolute",
                    left: `${Math.min(98, L.xPct + rx)}%`,
                    top: `${L.yPct}%`,
                    width: 11,
                    height: 11,
                    margin: 0,
                    padding: 0,
                    transform: "translate(-50%, -50%)",
                    borderRadius: 2,
                    border: "1px solid #0f172a",
                    background: selected ? "#fde68a" : "#e2e8f0",
                    cursor: "ew-resize",
                    pointerEvents: "auto",
                    touchAction: "none",
                  }}
                />
                {/* 縦サイズ */}
                <button
                  type="button"
                  aria-label={`${L.label ?? "照明"} の縦サイズ`}
                  title={`縦 ${ry.toFixed(0)}%`}
                  onPointerDown={(e) => onPointerDown(e, L.id, "ry")}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  style={{
                    position: "absolute",
                    left: `${L.xPct}%`,
                    top: `${Math.min(98, L.yPct + ry)}%`,
                    width: 11,
                    height: 11,
                    margin: 0,
                    padding: 0,
                    transform: "translate(-50%, -50%)",
                    borderRadius: 2,
                    border: "1px solid #0f172a",
                    background: selected ? "#fde68a" : "#e2e8f0",
                    cursor: "ns-resize",
                    pointerEvents: "auto",
                    touchAction: "none",
                  }}
                />
                {/* 濃さ（右下） */}
                <button
                  type="button"
                  aria-label={`${L.label ?? "照明"} の濃さ`}
                  title={`濃さ ${Math.round(L.intensity * 100)}% · 上下ドラッグ`}
                  onPointerDown={(e) => onPointerDown(e, L.id, "intensity")}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  style={{
                    position: "absolute",
                    left: `${Math.min(98, L.xPct + rx * 0.7)}%`,
                    top: `${Math.min(98, L.yPct + ry * 0.7)}%`,
                    width: 10,
                    height: 10,
                    margin: 0,
                    padding: 0,
                    transform: "translate(-50%, -50%)",
                    borderRadius: 999,
                    border: "1px solid #0f172a",
                    background: selected ? "#fbbf24" : "#94a3b8",
                    cursor: "ns-resize",
                    pointerEvents: "auto",
                    touchAction: "none",
                  }}
                />
                {selected ? (
                  <div
                    style={{
                      position: "absolute",
                      left: `${L.xPct}%`,
                      top: `${L.yPct}%`,
                      transform: "translate(10px, -22px)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "rgba(15,23,42,0.85)",
                      color: "#e2e8f0",
                      fontSize: 9,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      border: "1px solid #475569",
                    }}
                  >
                    {L.shape === "circle" ? "丸" : "楕円"} {Math.round(rx)}×
                    {Math.round(ry)} · {Math.round(L.intensity * 100)}%
                  </div>
                ) : null}
              </div>
            );
          })
        : null}
    </div>
  );
}
