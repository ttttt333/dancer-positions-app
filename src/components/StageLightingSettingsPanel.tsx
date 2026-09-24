import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  ChoreographyProjectJson,
  StageLightFixture,
  StageLightKind,
} from "../types/choreography";
import {
  createDefaultStageLight,
  STAGE_LIGHT_KIND_LABELS,
  STAGE_LIGHT_KINDS,
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
};

function patchLight(
  lights: StageLightFixture[],
  id: string,
  patch: Partial<StageLightFixture>
): StageLightFixture[] {
  return lights.map((L) => (L.id === id ? { ...L, ...patch } : L));
}

/**
 * テキストシート内の照明タブ。サイド／フット等の位置・色・濃さ・時間帯を編集する。
 */
export function StageLightingSettingsPanel({
  disabled,
  project,
  setProject,
  currentTimeSec,
}: StageLightingSettingsPanelProps) {
  const lights = project.stageLights ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(
    lights[0]?.id ?? null
  );
  const selected = useMemo(
    () => lights.find((L) => L.id === selectedId) ?? null,
    [lights, selectedId]
  );

  const updateLights = (next: StageLightFixture[]) => {
    setProject((p) => ({ ...p, stageLights: next }));
  };

  const addLight = (kind: StageLightKind) => {
    const L = createDefaultStageLight(kind);
    if (kind === "sideSpot") {
      // 左右セットを追加しやすく：下手側の既定に加え上手側も
      const right: StageLightFixture = {
        ...createDefaultStageLight("sideSpot"),
        xPct: 88,
        label: "サイドスポット（上手）",
      };
      L.label = "サイドスポット（下手）";
      updateLights([...lights, L, right]);
      setSelectedId(L.id);
      return;
    }
    if (kind === "footlight") {
      L.yPct = 90;
      L.xPct = 50;
    }
    updateLights([...lights, L]);
    setSelectedId(L.id);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.45 }}>
        照明の位置・色・濃さと、点灯する時間帯を設定します。再生ヘッドが時間帯に入ると舞台上に色が出ます（いま{" "}
        {currentTimeSec.toFixed(1)}s）。
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {STAGE_LIGHT_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={disabled}
            onClick={() => addLight(kind)}
            style={{
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#e2e8f0",
              fontSize: 11,
              fontWeight: 600,
              cursor: disabled ? "not-allowed" : "pointer",
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
          maxHeight: 160,
          overflow: "auto",
        }}
      >
        {lights.length === 0 ? (
          <li style={{ fontSize: 12, color: "#64748b" }}>照明はまだありません</li>
        ) : (
          lights.map((L) => {
            const on = L.id === selectedId;
            return (
              <li key={L.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(L.id)}
                  style={{
                    width: "100%",
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
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {L.label || STAGE_LIGHT_KIND_LABELS[L.kind]}
                  </span>
                  <span style={{ fontSize: 10, color: "#64748b" }}>
                    {L.tStartSec != null || L.tEndSec != null
                      ? `${L.tStartSec ?? 0}–${L.tEndSec ?? "∞"}s`
                      : "常時"}
                  </span>
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
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#e2e8f0" }}>
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
            種類
            <select
              disabled={disabled}
              value={selected.kind}
              onChange={(e) =>
                updateLights(
                  patchLight(lights, selected.id, {
                    kind: e.target.value as StageLightKind,
                    label: STAGE_LIGHT_KIND_LABELS[e.target.value as StageLightKind],
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
                      tStartSec: raw === "" ? null : Math.max(0, Number(raw) || 0),
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
                      tEndSec: raw === "" ? null : Math.max(0, Number(raw) || 0),
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
