import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  ChoreographyProjectJson,
  Cue,
  StageLightFixture,
  StageLightKind,
} from "../types/choreography";
import {
  createDefaultStageLight,
  nextLightLabel,
  resolveLightAxes,
  STAGE_LIGHT_KIND_LABELS,
  STAGE_LIGHT_KINDS,
  STAGE_LIGHTS_MAX,
} from "../lib/stageLighting";

const COLOR_SWATCHES = [
  "#ffffff",
  "#fef08a",
  "#fb923c",
  "#f87171",
  "#f472b6",
  "#c084fc",
  "#60a5fa",
  "#34d399",
  "#a3e635",
  "#fcd34d",
] as const;

export type StageLightingSettingsPanelProps = {
  disabled?: boolean;
  project: ChoreographyProjectJson;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  currentTimeSec: number;
  /** タイムラインで選中のキュー（「このキュー」用） */
  selectedCueId?: string | null;
  selectedCue?: Cue | null;
  selectedLightId?: string | null;
  onSelectLightId?: (id: string | null) => void;
};

type ListFilter = "cue" | "global" | "all";

function patchLight(
  lights: StageLightFixture[],
  id: string,
  patch: Partial<StageLightFixture>
): StageLightFixture[] {
  return lights.map((L) => (L.id === id ? { ...L, ...patch } : L));
}

function cueLabel(cues: readonly Cue[], cueId: string | null | undefined): string {
  if (!cueId) return "全体";
  const c = cues.find((x) => x.id === cueId);
  if (!c) return "キュー（削除済）";
  if (c.name?.trim()) return c.name.trim();
  const idx = cues.findIndex((x) => x.id === cueId);
  return `キュー ${idx >= 0 ? idx + 1 : "?"}（${c.tStartSec.toFixed(1)}–${c.tEndSec.toFixed(1)}s）`;
}

function sortedCues(cues: readonly Cue[]): Cue[] {
  return [...cues].sort(
    (a, b) => a.tStartSec - b.tStartSec || a.id.localeCompare(b.id)
  );
}

/**
 * テキストシート内の照明タブ。
 * 全体／キュー単位で一覧を切り替え、各灯をキューに割り当てられる。
 */
export function StageLightingSettingsPanel({
  disabled,
  project,
  setProject,
  currentTimeSec,
  selectedCueId = null,
  selectedCue = null,
  selectedLightId = null,
  onSelectLightId,
}: StageLightingSettingsPanelProps) {
  const lights = project.stageLights ?? [];
  const cues = useMemo(() => sortedCues(project.cues ?? []), [project.cues]);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(
    lights[0]?.id ?? null
  );
  const [listFilter, setListFilter] = useState<ListFilter>(() =>
    selectedCueId ? "cue" : "all"
  );

  const selectedId = selectedLightId ?? localSelectedId;

  const setSelectedId = (id: string | null) => {
    setLocalSelectedId(id);
    onSelectLightId?.(id);
  };

  useEffect(() => {
    if (selectedLightId != null) setLocalSelectedId(selectedLightId);
  }, [selectedLightId]);

  // タイムラインでキューを選んだら「このキュー」一覧へ自動切替
  useEffect(() => {
    if (selectedCueId) setListFilter("cue");
  }, [selectedCueId]);

  const updateLights = (next: StageLightFixture[]) => {
    setProject((p) => ({ ...p, stageLights: next }));
  };

  const filteredLights = useMemo(() => {
    if (listFilter === "all") return lights;
    if (listFilter === "global") {
      return lights.filter((L) => !L.cueId);
    }
    if (!selectedCueId) return [];
    return lights.filter((L) => L.cueId === selectedCueId);
  }, [lights, listFilter, selectedCueId]);

  // 絞り込みで選択灯が見えなくなったら先頭へ
  useEffect(() => {
    if (!selectedId) return;
    if (filteredLights.some((L) => L.id === selectedId)) return;
    setSelectedId(filteredLights[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-pick when filter membership changes
  }, [filteredLights, selectedId]);

  const selected = useMemo(
    () => lights.find((L) => L.id === selectedId) ?? null,
    [lights, selectedId]
  );

  const addLight = (kind: StageLightKind) => {
    if (lights.length >= STAGE_LIGHTS_MAX) return;
    const L = createDefaultStageLight(kind);
    L.label = nextLightLabel(kind, lights);

    const bindToCue =
      listFilter === "cue" && selectedCueId
        ? selectedCueId
        : listFilter === "global"
          ? null
          : selectedCueId;
    if (bindToCue) {
      L.cueId = bindToCue;
      L.tStartSec = null;
      L.tEndSec = null;
    } else {
      L.cueId = null;
    }

    if (kind === "sideSpot") {
      const sides = lights.filter((x) => x.kind === "sideSpot");
      L.xPct = sides.length % 2 === 0 ? 12 : 88;
      L.yPct = 40 + (sides.length % 5) * 8;
    }
    if (kind === "footlight") {
      const foots = lights.filter((x) => x.kind === "footlight");
      L.yPct = 90;
      L.xPct = 20 + (foots.length % 5) * 15;
    }
    if (kind === "suspension" || kind === "backlight" || kind === "pinSpot") {
      const same = lights.filter((x) => x.kind === kind);
      L.xPct = Math.min(85, 25 + (same.length % 4) * 18);
      L.yPct = Math.min(80, L.yPct + (same.length % 3) * 10);
    }
    updateLights([...lights, L]);
    setSelectedId(L.id);
  };

  const assignCue = (lightId: string, cueId: string | null) => {
    updateLights(
      patchLight(lights, lightId, {
        cueId,
        ...(cueId
          ? { tStartSec: null, tEndSec: null }
          : {}),
      })
    );
  };

  const scopeIsCue = Boolean(selected?.cueId);
  const axes = selected ? resolveLightAxes(selected) : null;
  const cueMissing = !selectedCueId;
  const currentCueLabel = selectedCue
    ? selectedCue.name?.trim() ||
      `${selectedCue.tStartSec.toFixed(1)}–${selectedCue.tEndSec.toFixed(1)}s`
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #334155",
          background: selectedCueId
            ? "rgba(251,191,36,0.08)"
            : "rgba(15,23,42,0.6)",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0" }}>
          {selectedCueId
            ? `編集中のキュー: ${currentCueLabel}`
            : "キュー未選択"}
        </div>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
          {selectedCueId
            ? "「このキュー」タブの照明だけが、そのキュー再生時に点灯します。全体は全キュー共通です。"
            : "タイムラインでキューを選ぶと、キュー専用の照明を追加・編集できます。"}
        </p>
      </div>

      <div
        role="tablist"
        aria-label="照明の一覧"
        style={{ display: "flex", gap: 4 }}
      >
        {(
          [
            {
              id: "cue" as const,
              label: selectedCueId ? "このキュー" : "このキュー",
              disabled: cueMissing,
            },
            { id: "global" as const, label: "全体", disabled: false },
            { id: "all" as const, label: "すべて", disabled: false },
          ] as const
        ).map((tab) => {
          const active = listFilter === tab.id;
          const count =
            tab.id === "cue" && selectedCueId
              ? lights.filter((L) => L.cueId === selectedCueId).length
              : tab.id === "global"
                ? lights.filter((L) => !L.cueId).length
                : lights.length;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={tab.disabled}
              title={
                tab.disabled
                  ? "タイムラインでキューを選んでください"
                  : undefined
              }
              onClick={() => setListFilter(tab.id)}
              style={{
                flex: 1,
                padding: "7px 6px",
                borderRadius: 8,
                border: active
                  ? "1px solid rgba(251,191,36,0.7)"
                  : "1px solid #334155",
                background: active ? "rgba(251,191,36,0.14)" : "#0f172a",
                color: tab.disabled ? "#64748b" : "#e2e8f0",
                fontSize: 11,
                fontWeight: 700,
                cursor: tab.disabled ? "not-allowed" : "pointer",
              }}
            >
              {tab.label}
              <span style={{ opacity: 0.7, fontWeight: 600 }}> ({count})</span>
            </button>
          );
        })}
      </div>

      <p style={{ margin: 0, fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
        種類を追加（最大 {STAGE_LIGHTS_MAX}）· いま {currentTimeSec.toFixed(1)}s
        {listFilter === "cue" && selectedCueId
          ? " · 追加分はこのキュー専用"
          : listFilter === "global"
            ? " · 追加分は全体（全キュー）"
            : ""}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {STAGE_LIGHT_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={
              disabled ||
              lights.length >= STAGE_LIGHTS_MAX ||
              (listFilter === "cue" && cueMissing)
            }
            onClick={() => addLight(kind)}
            style={{
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#e2e8f0",
              fontSize: 11,
              fontWeight: 600,
              cursor:
                disabled ||
                lights.length >= STAGE_LIGHTS_MAX ||
                (listFilter === "cue" && cueMissing)
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            ＋{STAGE_LIGHT_KIND_LABELS[kind]}
          </button>
        ))}
      </div>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          maxHeight: 180,
          overflow: "auto",
        }}
      >
        {listFilter === "cue" && cueMissing ? (
          <li style={{ fontSize: 12, color: "#fbbf24" }}>
            タイムラインでキューを選んでください
          </li>
        ) : filteredLights.length === 0 ? (
          <li style={{ fontSize: 12, color: "#64748b" }}>
            {listFilter === "cue"
              ? "このキュー専用の照明はまだありません。上の＋で追加できます。"
              : listFilter === "global"
                ? "全体（全キュー共通）の照明はまだありません。"
                : "照明はまだありません"}
          </li>
        ) : (
          filteredLights.map((L) => {
            const on = L.id === selectedId;
            return (
              <li
                key={L.id}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  gap: 4,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(L.id)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: on
                      ? "1px solid rgba(251,191,36,0.7)"
                      : "1px solid #334155",
                    background: on ? "rgba(251,191,36,0.12)" : "#0f172a",
                    color: "#e2e8f0",
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      background: L.color,
                      opacity: L.enabled === false ? 0.3 : L.intensity,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {L.label || STAGE_LIGHT_KIND_LABELS[L.kind]}
                  </span>
                  <span style={{ fontSize: 10, color: "#64748b", flexShrink: 0 }}>
                    {L.cueId ? cueLabel(cues, L.cueId) : "全体"}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  title="削除"
                  aria-label={`${L.label || STAGE_LIGHT_KIND_LABELS[L.kind]} を削除`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = lights.filter((x) => x.id !== L.id);
                    updateLights(next);
                    if (selectedId === L.id) {
                      setSelectedId(next[0]?.id ?? null);
                    }
                  }}
                  style={{
                    flexShrink: 0,
                    width: 32,
                    borderRadius: 8,
                    border: "1px solid rgba(248,113,113,0.45)",
                    background: "rgba(127,29,29,0.28)",
                    color: "#fecaca",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: disabled ? "not-allowed" : "pointer",
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </li>
            );
          })
        )}
      </ul>

      {selected ? (
        <div
          style={{
            border: "1px solid #334155",
            borderRadius: 10,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            background: "rgba(15,23,42,0.6)",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#e2e8f0",
            }}
          >
            <input
              type="checkbox"
              disabled={disabled}
              checked={selected.enabled !== false}
              onChange={(e) =>
                updateLights(
                  patchLight(lights, selected.id, { enabled: e.target.checked })
                )
              }
            />
            有効
          </label>

          <label style={{ fontSize: 11, color: "#94a3b8" }}>
            適用キュー
            <select
              disabled={disabled || cues.length === 0}
              value={selected.cueId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                assignCue(selected.id, v === "" ? null : v);
              }}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: 8,
                borderRadius: 8,
                border: "1px solid #334155",
                background: "#0f172a",
                color: "#e2e8f0",
                fontSize: 12,
              }}
            >
              <option value="">全体（全キュー共通）</option>
              {cues.map((c, i) => (
                <option key={c.id} value={c.id}>
                  {c.name?.trim() ||
                    `キュー ${i + 1}（${c.tStartSec.toFixed(1)}–${c.tEndSec.toFixed(1)}s）`}
                </option>
              ))}
            </select>
          </label>

          {selectedCueId ? (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                disabled={disabled || selected.cueId === selectedCueId}
                onClick={() => assignCue(selected.id, selectedCueId)}
                style={{
                  flex: 1,
                  padding: "7px 8px",
                  borderRadius: 8,
                  border:
                    selected.cueId === selectedCueId
                      ? "1px solid rgba(251,191,36,0.7)"
                      : "1px solid #334155",
                  background:
                    selected.cueId === selectedCueId
                      ? "rgba(251,191,36,0.14)"
                      : "#0f172a",
                  color: "#e2e8f0",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor:
                    disabled || selected.cueId === selectedCueId
                      ? "default"
                      : "pointer",
                }}
              >
                このキューだけ
              </button>
              <button
                type="button"
                disabled={disabled || !selected.cueId}
                onClick={() => assignCue(selected.id, null)}
                style={{
                  flex: 1,
                  padding: "7px 8px",
                  borderRadius: 8,
                  border: !selected.cueId
                    ? "1px solid rgba(251,191,36,0.7)"
                    : "1px solid #334155",
                  background: !selected.cueId
                    ? "rgba(251,191,36,0.14)"
                    : "#0f172a",
                  color: "#e2e8f0",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor:
                    disabled || !selected.cueId ? "default" : "pointer",
                }}
              >
                全体にする
              </button>
            </div>
          ) : null}

          {!scopeIsCue ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ fontSize: 11, color: "#94a3b8" }}>
                開始秒（空＝先頭）
                <input
                  type="number"
                  disabled={disabled}
                  min={0}
                  step={0.1}
                  value={selected.tStartSec ?? ""}
                  placeholder="常時"
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    updateLights(
                      patchLight(lights, selected.id, {
                        tStartSec:
                          raw === "" ? null : Math.max(0, Number(raw) || 0),
                      })
                    );
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #334155",
                    background: "#0f172a",
                    color: "#e2e8f0",
                  }}
                />
              </label>
              <label style={{ fontSize: 11, color: "#94a3b8" }}>
                終了秒（空＝末尾）
                <input
                  type="number"
                  disabled={disabled}
                  min={0}
                  step={0.1}
                  value={selected.tEndSec ?? ""}
                  placeholder="常時"
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    updateLights(
                      patchLight(lights, selected.id, {
                        tEndSec:
                          raw === "" ? null : Math.max(0, Number(raw) || 0),
                      })
                    );
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 4,
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #334155",
                    background: "#0f172a",
                    color: "#e2e8f0",
                  }}
                />
              </label>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
              紐づけキュー（{cueLabel(cues, selected.cueId)}
              ）の時間帯に合わせて点灯します。
            </p>
          )}

          <label style={{ fontSize: 11, color: "#94a3b8" }}>
            種類
            <select
              disabled={disabled}
              value={selected.kind}
              onChange={(e) => {
                const kind = e.target.value as StageLightKind;
                const a = resolveLightAxes(selected);
                updateLights(
                  patchLight(lights, selected.id, {
                    kind,
                    label: nextLightLabel(
                      kind,
                      lights.filter((x) => x.id !== selected.id)
                    ),
                    rxPct: a.rx,
                    ryPct: selected.shape === "circle" ? undefined : a.ry,
                  })
                );
              }}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                padding: 8,
                borderRadius: 8,
                border: "1px solid #334155",
                background: "#0f172a",
                color: "#e2e8f0",
              }}
            >
              {STAGE_LIGHT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {STAGE_LIGHT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ fontSize: 11, color: "#94a3b8" }}>
              横位置 %
              <input
                type="number"
                disabled={disabled}
                min={0}
                max={100}
                step={1}
                value={Math.round(selected.xPct)}
                onChange={(e) =>
                  updateLights(
                    patchLight(lights, selected.id, {
                      xPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                    })
                  )
                }
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 4,
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #334155",
                  background: "#0f172a",
                  color: "#e2e8f0",
                }}
              />
            </label>
            <label style={{ fontSize: 11, color: "#94a3b8" }}>
              奥行 %（大＝手前）
              <input
                type="number"
                disabled={disabled}
                min={0}
                max={100}
                step={1}
                value={Math.round(selected.yPct)}
                onChange={(e) =>
                  updateLights(
                    patchLight(lights, selected.id, {
                      yPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                    })
                  )
                }
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 4,
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #334155",
                  background: "#0f172a",
                  color: "#e2e8f0",
                }}
              />
            </label>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
              形
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(
                [
                  { id: "circle" as const, label: "正円" },
                  { id: "ellipse" as const, label: "楕円" },
                ] as const
              ).map((opt) => {
                const active =
                  (selected.shape === "circle" ? "circle" : "ellipse") ===
                  opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const a = resolveLightAxes(selected);
                      if (opt.id === "circle") {
                        updateLights(
                          patchLight(lights, selected.id, {
                            shape: "circle",
                            rxPct: a.rx,
                            ryPct: undefined,
                          })
                        );
                      } else {
                        updateLights(
                          patchLight(lights, selected.id, {
                            shape: "ellipse",
                            rxPct: a.rx,
                            ryPct: a.ry,
                          })
                        );
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: "7px 8px",
                      borderRadius: 8,
                      border: active
                        ? "1px solid rgba(251,191,36,0.7)"
                        : "1px solid #334155",
                      background: active
                        ? "rgba(251,191,36,0.14)"
                        : "#0f172a",
                      color: "#e2e8f0",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>色</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COLOR_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  disabled={disabled}
                  title={hex}
                  onClick={() =>
                    updateLights(patchLight(lights, selected.id, { color: hex }))
                  }
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border:
                      selected.color === hex
                        ? "2px solid #fde68a"
                        : "1px solid #475569",
                    background: hex,
                    cursor: disabled ? "not-allowed" : "pointer",
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>

          {axes && selected.shape === "circle" ? (
            <label style={{ fontSize: 11, color: "#94a3b8" }}>
              大きさ {Math.round(axes.rx)}%
              <input
                type="range"
                disabled={disabled}
                min={2}
                max={60}
                step={0.5}
                value={axes.rx}
                onChange={(e) =>
                  updateLights(
                    patchLight(lights, selected.id, {
                      shape: "circle",
                      rxPct: Number(e.target.value),
                      ryPct: undefined,
                    })
                  )
                }
                style={{ display: "block", width: "100%", marginTop: 6 }}
              />
            </label>
          ) : axes ? (
            <>
              <label style={{ fontSize: 11, color: "#94a3b8" }}>
                横半径 {Math.round(axes.rx)}%
                <input
                  type="range"
                  disabled={disabled}
                  min={2}
                  max={60}
                  step={0.5}
                  value={axes.rx}
                  onChange={(e) =>
                    updateLights(
                      patchLight(lights, selected.id, {
                        shape: "ellipse",
                        rxPct: Number(e.target.value),
                        ryPct: axes.ry,
                      })
                    )
                  }
                  style={{ display: "block", width: "100%", marginTop: 6 }}
                />
              </label>
              <label style={{ fontSize: 11, color: "#94a3b8" }}>
                縦半径 {Math.round(axes.ry)}%
                <input
                  type="range"
                  disabled={disabled}
                  min={2}
                  max={60}
                  step={0.5}
                  value={axes.ry}
                  onChange={(e) =>
                    updateLights(
                      patchLight(lights, selected.id, {
                        shape: "ellipse",
                        rxPct: axes.rx,
                        ryPct: Number(e.target.value),
                      })
                    )
                  }
                  style={{ display: "block", width: "100%", marginTop: 6 }}
                />
              </label>
            </>
          ) : null}

          <label style={{ fontSize: 11, color: "#94a3b8" }}>
            濃さ {Math.round(selected.intensity * 100)}%
            <input
              type="range"
              disabled={disabled}
              min={0.05}
              max={1}
              step={0.05}
              value={selected.intensity}
              onChange={(e) =>
                updateLights(
                  patchLight(lights, selected.id, {
                    intensity: Number(e.target.value),
                  })
                )
              }
              style={{ display: "block", width: "100%", marginTop: 6 }}
            />
          </label>

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const next = lights.filter((L) => L.id !== selected.id);
              updateLights(next);
              setSelectedId(next[0]?.id ?? null);
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(248,113,113,0.5)",
              background: "rgba(127,29,29,0.25)",
              color: "#fecaca",
              fontSize: 12,
              fontWeight: 600,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            この照明を削除
          </button>
        </div>
      ) : null}
    </div>
  );
}
