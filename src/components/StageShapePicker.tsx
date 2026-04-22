import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { StageShape, StageShapePresetId } from "../types/choreography";
import {
  buildStageShape,
  clonePolygonPct,
  defaultParamsFor,
  DEFAULT_STAGE_RECT_POLYGON,
  polygonToSvgPoints,
  sanitizePolygonPct,
  STAGE_SHAPE_PRESETS,
  STAGE_SHAPE_PRESET_MAP,
} from "../lib/stageShapes";
import { btnPrimary, btnSecondary } from "./stageButtonStyles";

type Props = {
  open: boolean;
  /** 現在のプロジェクトに保存されている形状（undefined = 長方形扱い） */
  currentShape?: StageShape;
  /** 旧仕様の 花道（stageShape 未設定時の表示） */
  legacyHanamichi?: {
    enabled: boolean;
    depthPct: number;
  };
  onClose: () => void;
  /** 確定した形状を保存する。rectangle を選んだときは undefined を渡す */
  onConfirm: (shape: StageShape | undefined) => void;
  disabled?: boolean;
};

/** 形状プレビュー（SVG サムネイル）。親の color がアウトライン、塗りは半透明。 */
function ShapeThumb({
  polygonPct,
  size = 66,
  highlight = false,
}: {
  polygonPct: [number, number][];
  size?: number;
  highlight?: boolean;
}) {
  const pts = polygonToSvgPoints(polygonPct);
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden
      style={{
        display: "block",
        color: highlight ? "#c7d2fe" : "#94a3b8",
        flexShrink: 0,
      }}
    >
      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        rx="6"
        ry="6"
        fill="#020617"
        stroke="#1e293b"
        strokeWidth="1"
      />
      <polygon
        points={pts}
        fill={highlight ? "rgba(99,102,241,0.35)" : "rgba(148,163,184,0.22)"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* 客席方向（下辺）の帯 */}
      <rect
        x="0"
        y="92"
        width="100"
        height="8"
        fill="currentColor"
        fillOpacity={0.1}
      />
    </svg>
  );
}

/**
 * 「変形舞台」プリセットを選んで確定するモーダル。
 *
 * 選択するだけで即時プレビューにはしない（閉じるまで現舞台は変わらない）。
 * 「決定」を押して初めて onConfirm に形状を渡す。
 */
export function StageShapePicker({
  open,
  currentShape,
  legacyHanamichi,
  onClose,
  onConfirm,
  disabled = false,
}: Props) {
  const titleId = useId();

  /** 編集中のプリセット id */
  const [presetId, setPresetId] = useState<StageShapePresetId>("rectangle");
  /** 編集中の params（プリセット別） */
  const [params, setParams] = useState<Record<string, number>>({});
  /** presetId === "custom" のときの頂点列（%）。決定時にそのまま保存する。 */
  const [customPoly, setCustomPoly] = useState<[number, number][]>(() =>
    clonePolygonPct(DEFAULT_STAGE_RECT_POLYGON)
  );

  useEffect(() => {
    if (!open) return;
    /** モーダルを開くたびに「現在保存されている形状」を起点に復元 */
    if (currentShape) {
      setPresetId(currentShape.presetId);
      setParams({
        ...defaultParamsFor(currentShape.presetId),
        ...(currentShape.params ?? {}),
      });
      if (currentShape.presetId === "custom") {
        setCustomPoly(sanitizePolygonPct(currentShape.polygonPct));
      } else {
        setCustomPoly(clonePolygonPct(DEFAULT_STAGE_RECT_POLYGON));
      }
    } else if (legacyHanamichi?.enabled) {
      /** 旧仕様の花道ありプロジェクトは、UI 上は花道プリセット選択状態で開く */
      setPresetId("hanamichi_front");
      setParams({
        ...defaultParamsFor("hanamichi_front"),
        depthPct: Math.min(36, Math.max(8, legacyHanamichi.depthPct)),
      });
    } else {
      setPresetId("rectangle");
      setParams({});
      setCustomPoly(clonePolygonPct(DEFAULT_STAGE_RECT_POLYGON));
    }
  }, [open, currentShape, legacyHanamichi]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /** プリセット切替時に params を初期化 */
  const selectPreset = useCallback((id: StageShapePresetId) => {
    setPresetId(id);
    setParams(defaultParamsFor(id));
    if (id === "custom") {
      setCustomPoly(clonePolygonPct(DEFAULT_STAGE_RECT_POLYGON));
    }
  }, []);

  /** 画面プレビュー用に現在の選択から polygon を組む */
  const previewShape = useMemo(() => {
    if (presetId === "custom") {
      return {
        presetId: "custom" as const,
        polygonPct: sanitizePolygonPct(customPoly),
      };
    }
    return buildStageShape(presetId, params);
  }, [presetId, params, customPoly]);

  const paramDefs = STAGE_SHAPE_PRESET_MAP[presetId]?.paramDefs ?? [];

  const submit = useCallback(() => {
    if (disabled) return;
    if (presetId === "rectangle") {
      onConfirm(undefined);
      return;
    }
    if (presetId === "custom") {
      const poly = sanitizePolygonPct(customPoly);
      if (poly.length < 3) {
        window.alert("カスタム形状には頂点が 3 つ以上必要です。");
        return;
      }
      onConfirm({ presetId: "custom", polygonPct: poly });
      return;
    }
    onConfirm(buildStageShape(presetId, params));
  }, [disabled, presetId, params, customPoly, onConfirm]);

  /** 選択しているプリセットの情報 */
  const selectedInfo = STAGE_SHAPE_PRESET_MAP[presetId];

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 65,
        background: "rgba(15, 23, 42, 0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "760px",
          maxHeight: "92vh",
          background: "#0f172a",
          borderRadius: "12px",
          border: "1px solid #334155",
          padding: "16px 18px 18px",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.5)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "10px",
          }}
        >
          <h3
            id={titleId}
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 600,
              color: "#e2e8f0",
            }}
          >
            変形舞台（舞台の形をカスタマイズ）
          </h3>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            style={{
              ...btnSecondary,
              fontSize: "18px",
              lineHeight: 1,
              padding: "4px 12px",
            }}
          >
            ×
          </button>
        </div>

        <p
          style={{
            margin: "0 0 12px",
            fontSize: "12px",
            color: "#94a3b8",
            lineHeight: 1.5,
          }}
        >
          プリセットを選んでから寸法スライダーや頂点（カスタム）で調整し、「決定」で反映します。
          菱形・楕円は横幅・縦幅を細かく変えられます。舞台外は薄暗く表示されます。
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 260px",
            gap: "14px",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* 左: プリセット一覧 */}
          <div
            style={{
              overflowY: "auto",
              paddingRight: "4px",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(148px, 1fr))",
              gap: "8px",
              alignContent: "start",
              maxHeight: "60vh",
            }}
          >
            {STAGE_SHAPE_PRESETS.map((opt) => {
              const on = presetId === opt.id;
              const poly = buildStageShape(
                opt.id,
                defaultParamsFor(opt.id)
              ).polygonPct;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectPreset(opt.id)}
                  title={opt.description}
                  style={{
                    ...btnSecondary,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: "6px",
                    padding: "10px 10px 8px",
                    textAlign: "left",
                    borderColor: on ? "#6366f1" : undefined,
                    color: on ? "#c7d2fe" : undefined,
                    background: on ? "rgba(99, 102, 241, 0.12)" : undefined,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <ShapeThumb polygonPct={poly} highlight={on} size={46} />
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          lineHeight: 1.25,
                        }}
                      >
                        {opt.label}
                      </span>
                      {opt.paramDefs && (
                        <span
                          style={{
                            fontSize: "10px",
                            color: on ? "#c7d2fe" : "#64748b",
                            lineHeight: 1.2,
                          }}
                        >
                          寸法を調整できます
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 右: プレビュー & パラメータ */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              border: "1px solid #1e293b",
              borderRadius: "10px",
              padding: "12px",
              background: "#020617",
              overflowY: "auto",
              maxHeight: "60vh",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center" }}>
              <ShapeThumb
                polygonPct={previewShape.polygonPct}
                size={180}
                highlight
              />
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#e2e8f0",
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              {selectedInfo?.label ?? "長方形"}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                lineHeight: 1.4,
              }}
            >
              {selectedInfo?.description ?? ""}
            </div>

            {paramDefs.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  marginTop: "6px",
                  borderTop: "1px solid #1e293b",
                  paddingTop: "10px",
                }}
              >
                {paramDefs.map((def) => {
                  const val =
                    typeof params[def.key] === "number"
                      ? params[def.key]!
                      : def.default;
                  return (
                    <label
                      key={def.key}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        fontSize: "11px",
                        color: "#cbd5e1",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "6px",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{def.label}</span>
                        <span style={{ color: "#94a3b8" }}>
                          {Math.round(val)}
                          {def.unit ?? ""}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={def.min}
                        max={def.max}
                        step={def.step}
                        value={val}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          if (!Number.isFinite(next)) return;
                          setParams((prev) => ({ ...prev, [def.key]: next }));
                        }}
                        style={{ width: "100%", accentColor: "#6366f1" }}
                      />
                    </label>
                  );
                })}
              </div>
            )}

            {presetId === "custom" && (
              <div
                style={{
                  marginTop: "10px",
                  borderTop: "1px solid #1e293b",
                  paddingTop: "10px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#a5b4fc",
                    marginBottom: "8px",
                  }}
                >
                  頂点（ステージ内の位置・0〜100%）
                </div>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: "10px",
                    color: "#64748b",
                    lineHeight: 1.45,
                  }}
                >
                  上が奥・下が客席側の座標です。時計回りに並ぶ凸形を想定しています。
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {customPoly.map((pt, idx) => (
                    <div
                      key={`cv-${idx}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "22px 1fr 1fr 28px",
                        gap: "6px",
                        alignItems: "center",
                        fontSize: "11px",
                        color: "#94a3b8",
                      }}
                    >
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {idx + 1}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={pt[0]}
                        disabled={disabled}
                        aria-label={`頂点${idx + 1}の左右位置%`}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isFinite(v)) return;
                          setCustomPoly((prev) => {
                            const next = [...prev];
                            const row = next[idx];
                            if (!row) return prev;
                            next[idx] = [v, row[1]] as [number, number];
                            return next;
                          });
                        }}
                        style={{
                          padding: "4px 6px",
                          borderRadius: "6px",
                          border: "1px solid #334155",
                          background: "#0f172a",
                          color: "#e2e8f0",
                          fontSize: "11px",
                        }}
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={pt[1]}
                        disabled={disabled}
                        aria-label={`頂点${idx + 1}の前後位置%`}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isFinite(v)) return;
                          setCustomPoly((prev) => {
                            const next = [...prev];
                            const row = next[idx];
                            if (!row) return prev;
                            next[idx] = [row[0], v] as [number, number];
                            return next;
                          });
                        }}
                        style={{
                          padding: "4px 6px",
                          borderRadius: "6px",
                          border: "1px solid #334155",
                          background: "#0f172a",
                          color: "#e2e8f0",
                          fontSize: "11px",
                        }}
                      />
                      <button
                        type="button"
                        disabled={disabled || customPoly.length <= 3}
                        title="この頂点を削除（3 点以上必要）"
                        onClick={() =>
                          setCustomPoly((prev) =>
                            prev.length <= 3
                              ? prev
                              : prev.filter((_, j) => j !== idx)
                          )
                        }
                        style={{
                          ...btnSecondary,
                          padding: "2px 0",
                          fontSize: "10px",
                          lineHeight: 1.2,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginTop: "10px",
                  }}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      setCustomPoly((prev) => {
                        if (prev.length < 1)
                          return clonePolygonPct(DEFAULT_STAGE_RECT_POLYGON);
                        const a = prev[prev.length - 1]!;
                        const b = prev[0]!;
                        const mx = (a[0] + b[0]) / 2;
                        const my = (a[1] + b[1]) / 2;
                        return [...prev, [mx, my] as [number, number]];
                      })
                    }
                    style={{ ...btnSecondary, fontSize: "11px", padding: "6px 10px" }}
                  >
                    頂点を追加
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      setCustomPoly(clonePolygonPct(DEFAULT_STAGE_RECT_POLYGON))
                    }
                    style={{ ...btnSecondary, fontSize: "11px", padding: "6px 10px" }}
                  >
                    長方形に戻す
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
            marginTop: "14px",
          }}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              selectPreset("rectangle");
            }}
            style={{
              ...btnSecondary,
              padding: "8px 12px",
              fontSize: "12px",
            }}
            title="長方形（変形なし）に戻す"
          >
            変形を解除
          </button>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              disabled={disabled}
              onClick={onClose}
              style={{ ...btnSecondary, padding: "8px 14px", fontSize: "13px" }}
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={submit}
              style={{
                ...btnPrimary,
                padding: "8px 18px",
                fontSize: "13px",
              }}
            >
              決定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
