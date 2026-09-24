import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { StageLightFixture } from "../types/choreography";
import { hexToRgba, resolveLightRadiusPct } from "../lib/stageLighting";

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

type DragMode = "move" | "radius" | "intensity";

/**
 * 点灯中の照明を床に重ねる。editable 時は位置・大きさ・濃さをドラッグ調整できる。
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
  const activeId = selectedId ?? localSelected;

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
        rect: r,
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
      // 上へドラッグで濃く、下で薄く（100px ≈ 全レンジ）
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

    // radius: 中心からの距離
    const dx = p.xPct - L.xPct;
    const dy = (p.yPct - L.yPct) / 0.72; // 楕円の縦圧縮に合わせる
    const raw = Math.sqrt(dx * dx + dy * dy);
    const snapped = Math.round(Math.max(3, Math.min(55, raw)) * 2) / 2;
    patch(d.id, { radiusPct: snapped });
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
          const r = resolveLightRadiusPct(L);
          return (
            <ellipse
              key={L.id}
              cx={L.xPct}
              cy={L.yPct}
              rx={r}
              ry={r * 0.72}
              fill={`url(#stage-light-${L.id})`}
            />
          );
        })}
      </svg>
      ) : null}

      {editable || handlesOnly
        ? lights.map((L) => {
            const r = resolveLightRadiusPct(L);
            const selected = activeId === L.id;
            return (
              <div key={`hit-${L.id}`} style={{ pointerEvents: "none" }}>
                {/* 移動 */}
                <button
                  type="button"
                  aria-label={`${L.label ?? "照明"} を移動`}
                  title="ドラッグで移動"
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
                    width: 28,
                    height: 28,
                    margin: 0,
                    padding: 0,
                    transform: "translate(-50%, -50%)",
                    borderRadius: 999,
                    border: selected
                      ? "2px solid #fde68a"
                      : "2px solid rgba(255,255,255,0.7)",
                    background: L.color,
                    boxShadow: selected
                      ? "0 0 0 3px rgba(251,191,36,0.45)"
                      : "0 0 0 1px rgba(15,23,42,0.5)",
                    cursor: "move",
                    pointerEvents: "auto",
                    touchAction: "none",
                    opacity: 0.95,
                  }}
                />
                {/* 大きさ（右） */}
                <button
                  type="button"
                  aria-label={`${L.label ?? "照明"} の大きさ`}
                  title={`大きさ ${r.toFixed(0)}% · ドラッグで変更`}
                  onPointerDown={(e) => onPointerDown(e, L.id, "radius")}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  style={{
                    position: "absolute",
                    left: `${Math.min(98, L.xPct + r)}%`,
                    top: `${L.yPct}%`,
                    width: 12,
                    height: 12,
                    margin: 0,
                    padding: 0,
                    transform: "translate(-50%, -50%)",
                    borderRadius: 3,
                    border: "1px solid #0f172a",
                    background: selected ? "#fde68a" : "#e2e8f0",
                    cursor: "ew-resize",
                    pointerEvents: "auto",
                    touchAction: "none",
                    boxShadow: "0 0 0 1px rgba(15,23,42,0.35)",
                  }}
                />
                {/* 濃さ（下） */}
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
                    left: `${L.xPct}%`,
                    top: `${Math.min(98, L.yPct + r * 0.72)}%`,
                    width: 12,
                    height: 12,
                    margin: 0,
                    padding: 0,
                    transform: "translate(-50%, -50%)",
                    borderRadius: 999,
                    border: "1px solid #0f172a",
                    background: selected ? "#fbbf24" : "#94a3b8",
                    cursor: "ns-resize",
                    pointerEvents: "auto",
                    touchAction: "none",
                    boxShadow: "0 0 0 1px rgba(15,23,42,0.35)",
                  }}
                />
                {selected ? (
                  <div
                    style={{
                      position: "absolute",
                      left: `${L.xPct}%`,
                      top: `${L.yPct}%`,
                      transform: "translate(16px, -18px)",
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
                    {Math.round(r)}% · {Math.round(L.intensity * 100)}%
                  </div>
                ) : null}
              </div>
            );
          })
        : null}
    </div>
  );
}
