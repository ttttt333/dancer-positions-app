import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { StageLightFixture } from "../types/choreography";
import {
  hexToRgba,
  resolveLightAxes,
  STAGE_LIGHTS_MAX,
} from "../lib/stageLighting";

export type StageLightingOverlayProps = {
  lights: readonly StageLightFixture[];
  /** 編集可（再生中・閲覧以外） */
  editable?: boolean;
  /** true のときウォッシュ（色）は描かずハンドルのみ */
  handlesOnly?: boolean;
  selectedId?: string | null;
  onSelectId?: (id: string | null) => void;
  onChangeLights?: (next: StageLightFixture[]) => void;
  /** 全灯リストを返す（複製・削除用。省略時は lights を全件とみなす） */
  onChangeAllLights?: (next: StageLightFixture[]) => void;
  allLights?: readonly StageLightFixture[];
  floorRef?: RefObject<HTMLElement | null>;
};

type DragMode = "move" | "rx" | "ry" | "intensity";

/**
 * 点灯中の照明を床に重ねる。
 * 編集印は範囲クリック時のみ表示。範囲外クリックで非表示。舞台上で削除・複製可。
 */
export function StageLightingOverlay({
  lights,
  editable = false,
  handlesOnly = false,
  selectedId = null,
  onSelectId,
  onChangeLights,
  onChangeAllLights,
  allLights,
  floorRef,
}: StageLightingOverlayProps) {
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    mode: DragMode;
    originIntensity: number;
    originClientY: number;
    moved: boolean;
  } | null>(null);
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const [floorAspect, setFloorAspect] = useState(1);

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

  useEffect(() => {
    setLocalSelected(selectedId ?? null);
  }, [selectedId]);

  const resolvedSelected = localSelected;

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

  const replaceAll = useCallback(
    (next: StageLightFixture[]) => {
      if (onChangeAllLights) {
        onChangeAllLights(next);
        return;
      }
      onChangeLights?.(next);
    },
    [onChangeAllLights, onChangeLights]
  );

  const fullList = allLights ?? lights;

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

  /** 範囲外クリックで編集印を消す（ダンサー操作は妨げない） */
  useEffect(() => {
    if (!editable && !handlesOnly) return;
    if (!resolvedSelected) return;
    const floor = floorRef?.current;
    if (!floor) return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("[data-stage-light-ui]")) return;
      const p = (() => {
        const r = floor.getBoundingClientRect();
        if (r.width < 1e-6 || r.height < 1e-6) return null;
        return {
          xPct: ((e.clientX - r.left) / r.width) * 100,
          yPct: ((e.clientY - r.top) / r.height) * 100,
        };
      })();
      if (!p) {
        select(null);
        return;
      }
      const inside = lights.some((L) => {
        const { rx, ry } = resolveLightAxes(L, floorAspect);
        if (rx < 1e-6 || ry < 1e-6) return false;
        const dx = (p.xPct - L.xPct) / rx;
        const dy = (p.yPct - L.yPct) / ry;
        return dx * dx + dy * dy <= 1;
      });
      if (!inside) select(null);
    };
    floor.addEventListener("pointerdown", onDown, true);
    return () => floor.removeEventListener("pointerdown", onDown, true);
  }, [
    editable,
    handlesOnly,
    resolvedSelected,
    floorRef,
    lights,
    floorAspect,
    select,
  ]);

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
      moved: false,
    };
    select(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const L = lights.find((x) => x.id === d.id);
    if (!L) return;

    if (d.mode === "intensity") {
      d.moved = true;
      const delta = (d.originClientY - e.clientY) / 100;
      const next = Math.max(0.05, Math.min(1, d.originIntensity + delta));
      patch(d.id, { intensity: Math.round(next * 100) / 100 });
      return;
    }

    const p = clientToPct(e.clientX, e.clientY);
    if (!p) return;

    if (d.mode === "move") {
      // 未選択からの初回クリックは移動せず選択のみ（わずかな移動は無視）
      if (resolvedSelected !== d.id && !d.moved) {
        const dx = Math.abs(p.xPct - L.xPct);
        const dy = Math.abs(p.yPct - L.yPct);
        if (dx < 0.8 && dy < 0.8) return;
      }
      d.moved = true;
      patch(d.id, {
        xPct: Math.round(p.xPct * 10) / 10,
        yPct: Math.round(p.yPct * 10) / 10,
      });
      return;
    }

    d.moved = true;
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

    const raw = Math.abs(p.yPct - L.yPct);
    const ry = Math.round(Math.max(2, Math.min(60, raw)) * 2) / 2;
    if (shape === "circle") {
      const rx =
        Math.round(Math.max(2, Math.min(60, ry / floorAspect)) * 2) / 2;
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

  const deleteSelected = () => {
    if (!resolvedSelected) return;
    const next = fullList.filter((L) => L.id !== resolvedSelected);
    replaceAll([...next]);
    select(null);
  };

  const duplicateSelected = () => {
    if (!resolvedSelected) return;
    if (fullList.length >= STAGE_LIGHTS_MAX) return;
    const src = fullList.find((L) => L.id === resolvedSelected);
    if (!src) return;
    const copy: StageLightFixture = {
      ...src,
      id: crypto.randomUUID(),
      label: `${(src.label ?? "照明").replace(/\s*コピー\d*$/, "")} コピー`,
      xPct: Math.min(95, src.xPct + 4),
      yPct: Math.min(95, src.yPct + 4),
    };
    replaceAll([...fullList, copy]);
    select(copy.id);
  };

  if (!lights.length && !handlesOnly) return null;
  if (!lights.length && handlesOnly) return null;

  const showChrome = Boolean(editable || handlesOnly);

  return (
    <div
      data-stage-lighting-overlay
      style={{
        position: "absolute",
        inset: 0,
        zIndex: showChrome ? 12 : 3,
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

      {showChrome ? (
        <>
          {lights.map((L) => {
            const { rx, ry } = resolveLightAxes(L, floorAspect);
            const selected = resolvedSelected === L.id;
            return (
              <div key={`hit-${L.id}`} style={{ pointerEvents: "none" }}>
                {/* 常時: 透明ヒットのみ（印は出さない） */}
                <div
                  data-stage-light-ui
                  role="button"
                  tabIndex={-1}
                  aria-label={`${L.label ?? "照明"} を選択`}
                  title={selected ? "ドラッグで移動" : "クリックで編集"}
                  onPointerDown={(e) => onPointerDown(e, L.id, "move")}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  style={{
                    position: "absolute",
                    left: `${L.xPct}%`,
                    top: `${L.yPct}%`,
                    width: `${rx * 2}%`,
                    height: `${ry * 2}%`,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    border: selected
                      ? "1.5px solid rgba(253,230,138,0.9)"
                      : "none",
                    background: "transparent",
                    cursor: selected ? "move" : "pointer",
                    pointerEvents: "auto",
                    touchAction: "none",
                    zIndex: 1,
                  }}
                />

                {selected ? (
                  <>
                    <button
                      type="button"
                      data-stage-light-ui
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
                        background: "#fde68a",
                        cursor: "ew-resize",
                        pointerEvents: "auto",
                        touchAction: "none",
                        zIndex: 2,
                      }}
                    />
                    <button
                      type="button"
                      data-stage-light-ui
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
                        background: "#fde68a",
                        cursor: "ns-resize",
                        pointerEvents: "auto",
                        touchAction: "none",
                        zIndex: 2,
                      }}
                    />
                    <button
                      type="button"
                      data-stage-light-ui
                      aria-label={`${L.label ?? "照明"} の濃さ`}
                      title={`濃さ ${Math.round(L.intensity * 100)}% · 上下ドラッグ`}
                      onPointerDown={(e) =>
                        onPointerDown(e, L.id, "intensity")
                      }
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
                        background: "#fbbf24",
                        cursor: "ns-resize",
                        pointerEvents: "auto",
                        touchAction: "none",
                        zIndex: 2,
                      }}
                    />
                    <div
                      data-stage-light-ui
                      style={{
                        position: "absolute",
                        left: `${L.xPct}%`,
                        top: `${L.yPct}%`,
                        transform: "translate(-50%, calc(-50% - 28px))",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 5px",
                        borderRadius: 6,
                        background: "rgba(15,23,42,0.92)",
                        border: "1px solid #475569",
                        pointerEvents: "auto",
                        zIndex: 3,
                        whiteSpace: "nowrap",
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          color: "#e2e8f0",
                          padding: "0 4px",
                        }}
                      >
                        {L.shape === "circle" ? "丸" : "楕円"} {Math.round(rx)}×
                        {Math.round(ry)} · {Math.round(L.intensity * 100)}%
                      </span>
                      <button
                        type="button"
                        title="複製"
                        aria-label="照明を複製"
                        disabled={fullList.length >= STAGE_LIGHTS_MAX}
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateSelected();
                        }}
                        style={{
                          margin: 0,
                          padding: "2px 7px",
                          borderRadius: 4,
                          border: "1px solid #475569",
                          background: "#1e293b",
                          color: "#e2e8f0",
                          fontSize: 10,
                          fontWeight: 700,
                          cursor:
                            fullList.length >= STAGE_LIGHTS_MAX
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        複製
                      </button>
                      <button
                        type="button"
                        title="削除"
                        aria-label="照明を削除"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSelected();
                        }}
                        style={{
                          margin: 0,
                          padding: "2px 7px",
                          borderRadius: 4,
                          border: "1px solid rgba(248,113,113,0.5)",
                          background: "rgba(127,29,29,0.45)",
                          color: "#fecaca",
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
