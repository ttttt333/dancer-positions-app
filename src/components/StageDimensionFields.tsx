import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import {
  formatMeterCmLabel,
  mmFromMeterAndCm,
  mmToMeterCm,
  STAGE_MAIN_FLOOR_MM_MAX,
} from "../lib/stageDimensions";
import {
  deleteStagePreset,
  listStagePresets,
  renameStagePreset,
  saveStagePreset,
  updateStagePreset,
  type StagePresetItem,
} from "../lib/stagePresets";

const MAX_MM = STAGE_MAIN_FLOOR_MM_MAX;

type Props = {
  project: ChoreographyProjectJson;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  disabled: boolean;
  compact?: boolean;
  showHeading?: boolean;
  embedded?: boolean;
  showAudienceEdge?: boolean;
  onCommit?: () => void;
};

function clampMm(mm: number): number {
  if (!Number.isFinite(mm) || mm <= 0) return 0;
  return Math.min(MAX_MM, Math.round(mm));
}

function clampGuideIntervalToWidth(
  widthMm: number | null,
  intervalMm: number | null
): number | null {
  if (intervalMm == null || widthMm == null || widthMm <= 0) return intervalMm;
  const maxHalf = Math.max(1, Math.floor(widthMm / 2));
  return Math.min(Math.max(1, Math.floor(intervalMm)), maxHalf);
}

/** "12.5" → 12500mm, "12" → 12000mm, "" → null */
function parseDecimalMeterToMm(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const v = parseFloat(t);
  if (!Number.isFinite(v) || v <= 0) return null;
  return clampMm(Math.round(v * 1000));
}

/** mm → "12.50" (m単位の小数文字列) */
function mmToDecimalStr(mm: number | null | undefined): string {
  if (mm == null || mm <= 0) return "";
  const u = mmToMeterCm(mm);
  const total = u.m + u.cm / 100;
  return total % 1 === 0 ? String(total) : total.toFixed(2).replace(/0+$/, "");
}

type DraftField = string; // decimal meter string e.g. "12.5"
type Draft = {
  width: DraftField;
  depth: DraftField;
  side: DraftField;
  back: DraftField;
  guide: DraftField;
};

function draftFromProject(p: ChoreographyProjectJson): Draft {
  return {
    width: mmToDecimalStr(p.stageWidthMm),
    depth: mmToDecimalStr(p.stageDepthMm),
    side: mmToDecimalStr(p.sideStageMm),
    back: mmToDecimalStr(p.backStageMm),
    guide: mmToDecimalStr(p.centerFieldGuideIntervalMm),
  };
}

function draftDiffers(draft: Draft, project: ChoreographyProjectJson): boolean {
  const wMm = parseDecimalMeterToMm(draft.width);
  const dMm = parseDecimalMeterToMm(draft.depth);
  const sMm = parseDecimalMeterToMm(draft.side);
  const bMm = parseDecimalMeterToMm(draft.back);
  const gMm = clampGuideIntervalToWidth(wMm, parseDecimalMeterToMm(draft.guide));
  return (
    wMm !== (project.stageWidthMm ?? null) ||
    dMm !== (project.stageDepthMm ?? null) ||
    sMm !== (project.sideStageMm ?? null) ||
    bMm !== (project.backStageMm ?? null) ||
    gMm !== (project.centerFieldGuideIntervalMm ?? null)
  );
}

// ─── Mini Stage Preview ───────────────────────────────────────────────────────
function MiniStagePreview({
  widthMm,
  depthMm,
  sideMm,
  backMm,
  audienceEdge,
}: {
  widthMm: number | null;
  depthMm: number | null;
  sideMm: number | null;
  backMm: number | null;
  audienceEdge?: ChoreographyProjectJson["audienceEdge"];
}) {
  const W = 160;
  const H = 100;
  const PAD = 8;

  const hasMain = widthMm != null && widthMm > 0 && depthMm != null && depthMm > 0;
  if (!hasMain) {
    return (
      <div
        style={{
          width: W,
          height: H,
          borderRadius: 8,
          border: "1px dashed rgba(99,102,241,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          color: "rgba(148,163,184,0.5)",
          background: "rgba(15,23,42,0.6)",
          flexShrink: 0,
        }}
      >
        寸法を入力
      </div>
    );
  }

  const wMm = widthMm!;
  const dMm = depthMm!;
  const sMm = sideMm ?? 0;
  const bMm = backMm ?? 0;

  const totalW = wMm + sMm * 2;
  const totalD = dMm + bMm;
  const scaleX = (W - PAD * 2) / totalW;
  const scaleY = (H - PAD * 2) / totalD;
  const scale = Math.min(scaleX, scaleY);

  const px = (mm: number) => mm * scale;

  const totalPxW = px(totalW);
  const totalPxD = px(totalD);
  const offsetX = (W - totalPxW) / 2;
  const offsetY = (H - totalPxD) / 2;

  const mainX = offsetX + px(sMm);
  const mainY = offsetY;
  const mainW = px(wMm);
  const mainD = px(dMm);

  const isBottom = audienceEdge !== "top";

  return (
    <svg
      width={W}
      height={H}
      style={{
        borderRadius: 8,
        border: "1px solid rgba(99,102,241,0.25)",
        background: "rgba(15,23,42,0.6)",
        flexShrink: 0,
      }}
    >
      {/* サイド (左) */}
      {sMm > 0 && (
        <rect
          x={offsetX}
          y={offsetY}
          width={px(sMm)}
          height={mainD}
          fill="rgba(99,102,241,0.12)"
          stroke="rgba(99,102,241,0.3)"
          strokeWidth={0.5}
        />
      )}
      {/* サイド (右) */}
      {sMm > 0 && (
        <rect
          x={mainX + mainW}
          y={offsetY}
          width={px(sMm)}
          height={mainD}
          fill="rgba(99,102,241,0.12)"
          stroke="rgba(99,102,241,0.3)"
          strokeWidth={0.5}
        />
      )}
      {/* バック */}
      {bMm > 0 && (
        <rect
          x={offsetX}
          y={offsetY + mainD}
          width={totalPxW}
          height={px(bMm)}
          fill="rgba(99,102,241,0.08)"
          stroke="rgba(99,102,241,0.2)"
          strokeWidth={0.5}
        />
      )}
      {/* メインステージ */}
      <rect
        x={mainX}
        y={mainY}
        width={mainW}
        height={mainD}
        fill="rgba(99,102,241,0.18)"
        stroke="rgba(129,140,248,0.8)"
        strokeWidth={1}
        rx={2}
      />
      {/* 客席方向ラベル */}
      <text
        x={mainX + mainW / 2}
        y={isBottom ? mainY + mainD + 11 : mainY - 3}
        textAnchor="middle"
        fill="rgba(252,211,77,0.85)"
        fontSize={8}
        fontWeight={600}
      >
        客席
      </text>
      {/* CENTER LINE */}
      <line
        x1={mainX + mainW / 2}
        y1={mainY + 2}
        x2={mainX + mainW / 2}
        y2={mainY + mainD - 2}
        stroke="rgba(129,140,248,0.35)"
        strokeWidth={0.5}
        strokeDasharray="3,2"
      />
    </svg>
  );
}

// ─── Decimal Input Row ────────────────────────────────────────────────────────
const inputBaseStyle: React.CSSProperties = {
  width: "90px",
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1px solid rgba(99,102,241,0.3)",
  background: "rgba(15,23,42,0.7)",
  color: "#e2e8f0",
  fontSize: "13px",
  outline: "none",
  transition: "border-color 0.15s",
};

function DimRow({
  label,
  hint,
  value,
  onChange,
  disabled,
  previewMm,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  previewMm: number | null;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "rgba(148,163,184,0.8)", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
          {hint && <span style={{ marginLeft: 4, color: "rgba(100,116,139,0.7)", fontSize: 9 }}>{hint}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            step="0.01"
            min={0}
            max={999}
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="例: 12.5"
            style={{
              ...inputBaseStyle,
              borderColor: focused
                ? "rgba(129,140,248,0.8)"
                : value
                ? "rgba(99,102,241,0.5)"
                : "rgba(51,65,85,0.8)",
              boxShadow: focused ? "0 0 0 2px rgba(99,102,241,0.15)" : "none",
            }}
          />
          <span style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", userSelect: "none" }}>m</span>
          {previewMm != null && (
            <span style={{ fontSize: 10, color: "rgba(100,116,139,0.8)", fontVariantNumeric: "tabular-nums" }}>
              {formatMeterCmLabel(previewMm)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Card section ─────────────────────────────────────────────────────────────
function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid rgba(99,102,241,0.2)",
        background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.6) 100%)",
        backdropFilter: "blur(8px)",
        padding: "12px 14px",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginBottom: 10,
          fontSize: 11,
          fontWeight: 700,
          color: "rgba(148,163,184,0.9)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: "rgba(129,140,248,0.9)", display: "flex" }}>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────
const IconRuler = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 20L20 2M7 20l1.5-1.5M12 20l1.5-1.5M17 20l1.5-1.5M2 7l1.5-1.5M2 12l1.5-1.5M2 17l1.5-1.5" />
  </svg>
);
const IconBookmark = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

// ─── Main component ───────────────────────────────────────────────────────────
export function StageDimensionFields({
  project,
  setProject,
  disabled,
  compact = false,
  showHeading = true,
  embedded = false,
  showAudienceEdge = false,
  onCommit,
}: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFromProject(project));

  useEffect(() => {
    setDraft(draftFromProject(project));
  }, [
    project.stageWidthMm,
    project.stageDepthMm,
    project.sideStageMm,
    project.backStageMm,
    project.centerFieldGuideIntervalMm,
  ]);

  const update = useCallback((key: keyof Draft, v: string) => {
    setDraft((d) => ({ ...d, [key]: v }));
  }, []);

  const previewMm = useMemo(() => {
    const wMm = parseDecimalMeterToMm(draft.width);
    return {
      width: wMm,
      depth: parseDecimalMeterToMm(draft.depth),
      side: parseDecimalMeterToMm(draft.side),
      back: parseDecimalMeterToMm(draft.back),
      guide: clampGuideIntervalToWidth(wMm, parseDecimalMeterToMm(draft.guide)),
    };
  }, [draft]);

  const dirty = useMemo(() => draftDiffers(draft, project), [draft, project]);

  const commit = useCallback(() => {
    if (disabled) return;
    const { width, depth, side, back, guide } = previewMm;
    setProject((p) => ({
      ...p,
      stageWidthMm: width,
      stageDepthMm: depth,
      sideStageMm: side,
      backStageMm: back,
      centerFieldGuideIntervalMm: guide,
    }));
    onCommit?.();
  }, [disabled, previewMm, setProject, onCommit]);

  const reset = useCallback(() => {
    setDraft(draftFromProject(project));
  }, [project]);

  // Presets
  const [presets, setPresets] = useState<StagePresetItem[]>(() => listStagePresets());
  const reloadPresets = useCallback(() => setPresets(listStagePresets()), []);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const applyPreset = useCallback((p: StagePresetItem) => {
    setDraft({
      width: mmToDecimalStr(p.stageWidthMm),
      depth: mmToDecimalStr(p.stageDepthMm),
      side: mmToDecimalStr(p.sideStageMm),
      back: mmToDecimalStr(p.backStageMm),
      guide: mmToDecimalStr(p.centerFieldGuideIntervalMm),
    });
    setSelectedPresetId(p.id);
  }, []);

  const saveAsNewPreset = useCallback(() => {
    if (disabled) return;
    const { width, depth, side, back, guide } = previewMm;
    if (width == null && depth == null && side == null && back == null && guide == null) {
      window.alert("保存する寸法が入っていません。");
      return;
    }
    const defaultName = `ステージ ${presets.length + 1}`;
    const name = window.prompt("保存プリセットの名前（あとで変更可）", defaultName);
    if (name === null) return;
    const result = saveStagePreset(name.trim() || defaultName, {
      stageWidthMm: width,
      stageDepthMm: depth,
      sideStageMm: side,
      backStageMm: back,
      centerFieldGuideIntervalMm: guide,
    });
    if (!result.ok) { window.alert(result.message); return; }
    setSelectedPresetId(result.item.id);
    reloadPresets();
  }, [disabled, previewMm, presets.length, reloadPresets]);

  const overwriteSelectedPreset = useCallback(() => {
    if (disabled || !selectedPresetId) return;
    const target = presets.find((x) => x.id === selectedPresetId);
    if (!target) return;
    if (!window.confirm(`「${target.name}」を現在の入力内容で上書き保存しますか？`)) return;
    const { width, depth, side, back, guide } = previewMm;
    const result = updateStagePreset(selectedPresetId, { stageWidthMm: width, stageDepthMm: depth, sideStageMm: side, backStageMm: back, centerFieldGuideIntervalMm: guide });
    if (!result.ok) { window.alert(result.message); return; }
    reloadPresets();
  }, [disabled, selectedPresetId, presets, previewMm, reloadPresets]);

  const renameSelectedPreset = useCallback(() => {
    if (disabled || !selectedPresetId) return;
    const target = presets.find((x) => x.id === selectedPresetId);
    if (!target) return;
    const name = window.prompt("新しい名前", target.name);
    if (name === null) return;
    const n = name.trim();
    if (!n) return;
    if (!renameStagePreset(selectedPresetId, n)) { window.alert("改名に失敗しました。"); return; }
    reloadPresets();
  }, [disabled, selectedPresetId, presets, reloadPresets]);

  const deleteSelectedPreset = useCallback(() => {
    if (disabled || !selectedPresetId) return;
    const target = presets.find((x) => x.id === selectedPresetId);
    if (!target) return;
    if (!window.confirm(`「${target.name}」を削除しますか？`)) return;
    deleteStagePreset(selectedPresetId);
    setSelectedPresetId(null);
    reloadPresets();
  }, [disabled, selectedPresetId, presets, reloadPresets]);

  return (
    <div style={{ padding: embedded ? 0 : "10px", background: embedded ? "transparent" : "transparent" }}>
      {showHeading && (
        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 10, letterSpacing: "0.05em" }}>
          ステージ形状・寸法
        </div>
      )}

      {/* ─── CARD A: 物理寸法 ─── */}
      <Card title="ステージ寸法" icon={<IconRuler />}>
        {/* ミニプレビュー + 入力 横並び */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {/* プレビュー */}
          <MiniStagePreview
            widthMm={previewMm.width}
            depthMm={previewMm.depth}
            sideMm={previewMm.side}
            backMm={previewMm.back}
            audienceEdge={project.audienceEdge}
          />
          {/* 入力群 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <DimRow label="メイン幅（上手〜下手）" value={draft.width} onChange={(v) => update("width", v)} disabled={disabled} previewMm={previewMm.width} />
            <DimRow label="奥行（客席方向）" value={draft.depth} onChange={(v) => update("depth", v)} disabled={disabled} previewMm={previewMm.depth} />
          </div>
        </div>

        {/* サイド・バック・場ミリ 2カラム */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          <DimRow label="サイド（片側）" value={draft.side} onChange={(v) => update("side", v)} disabled={disabled} previewMm={previewMm.side} />
          <DimRow label="バック" value={draft.back} onChange={(v) => update("back", v)} disabled={disabled} previewMm={previewMm.back} />
          <div style={{ gridColumn: "1 / -1" }}>
            <DimRow label="場ミリ（センターから）" hint="等間隔縦点線の間隔" value={draft.guide} onChange={(v) => update("guide", v)} disabled={disabled} previewMm={previewMm.guide} />
          </div>
        </div>

        {/* 客席位置 */}
        {showAudienceEdge && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(30,41,59,0.8)" }}>
            <div style={{ fontSize: 10, color: "rgba(100,116,139,0.9)", marginBottom: 6 }}>客席の位置</div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["top", "bottom"] as const).map((edge) => {
                const active = project.audienceEdge === edge;
                return (
                  <button
                    key={edge}
                    type="button"
                    disabled={disabled}
                    onClick={() => setProject((p) => ({ ...p, audienceEdge: edge }))}
                    style={{
                      flex: 1,
                      padding: "7px 10px",
                      borderRadius: 8,
                      border: active ? "1px solid rgba(252,211,77,0.7)" : "1px solid rgba(51,65,85,0.8)",
                      background: active ? "rgba(252,211,77,0.12)" : "rgba(15,23,42,0.5)",
                      color: active ? "#fcd34d" : "rgba(148,163,184,0.7)",
                      fontSize: 11,
                      fontWeight: active ? 700 : 400,
                      cursor: disabled ? "not-allowed" : "pointer",
                      transition: "all 0.15s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                    }}
                  >
                    {edge === "bottom" ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                        画面下が客席
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                        画面上が客席
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* ─── CARD B: プリセット ─── */}
      <Card title="プリセット" icon={<IconBookmark />}>
        {presets.length === 0 ? (
          <div style={{ fontSize: 10, color: "rgba(71,85,105,0.8)", padding: "4px 0 6px" }}>
            保存されたプリセットはまだありません
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {presets.map((p) => {
              const selected = selectedPresetId === p.id;
              const dims: string[] = [];
              if (p.stageWidthMm != null) dims.push(`W ${formatMeterCmLabel(p.stageWidthMm)}`);
              if (p.stageDepthMm != null) dims.push(`D ${formatMeterCmLabel(p.stageDepthMm)}`);
              return (
                <div
                  key={p.id}
                  style={{
                    borderRadius: 8,
                    border: `1px solid ${selected ? "rgba(99,102,241,0.7)" : "rgba(30,41,59,0.9)"}`,
                    background: selected ? "rgba(99,102,241,0.15)" : "rgba(15,23,42,0.5)",
                    display: "flex",
                    alignItems: "center",
                    gap: 0,
                    overflow: "hidden",
                    minWidth: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedPresetId(p.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: selected ? "#c7d2fe" : "#94a3b8",
                      padding: "5px 8px",
                      cursor: "pointer",
                      textAlign: "left",
                      minWidth: 0,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 90 }}>{p.name}</div>
                    <div style={{ fontSize: 9, color: "rgba(100,116,139,0.7)", whiteSpace: "nowrap" }}>{dims.length > 0 ? dims.join(" · ") : "寸法なし"}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(p)}
                    disabled={disabled}
                    title="この寸法を入力欄に読み込み（決定で反映）"
                    style={{
                      background: "rgba(99,102,241,0.15)",
                      border: "none",
                      borderLeft: "1px solid rgba(99,102,241,0.2)",
                      color: disabled ? "rgba(71,85,105,0.7)" : "#a5b4fc",
                      padding: "5px 7px",
                      cursor: disabled ? "not-allowed" : "pointer",
                      fontSize: 10,
                      fontWeight: 600,
                      alignSelf: "stretch",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    読込
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button
            type="button"
            onClick={saveAsNewPreset}
            disabled={disabled}
            style={{
              padding: "5px 12px",
              fontSize: 11,
              borderRadius: 7,
              border: "1px solid rgba(20,83,45,0.8)",
              background: disabled ? "rgba(30,41,59,0.5)" : "rgba(5,46,22,0.7)",
              color: disabled ? "rgba(71,85,105,0.7)" : "#bbf7d0",
              cursor: disabled ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            名前を付けて保存
          </button>
          {selectedPresetId && (
            <>
              <button type="button" onClick={overwriteSelectedPreset} disabled={disabled}
                style={{ padding: "5px 10px", fontSize: 10, borderRadius: 7, border: "1px solid rgba(51,65,85,0.8)", background: "rgba(15,23,42,0.5)", color: disabled ? "rgba(71,85,105,0.7)" : "#e2e8f0", cursor: disabled ? "not-allowed" : "pointer" }}>
                上書
              </button>
              <button type="button" onClick={renameSelectedPreset} disabled={disabled}
                style={{ padding: "5px 10px", fontSize: 10, borderRadius: 7, border: "1px solid rgba(51,65,85,0.8)", background: "rgba(15,23,42,0.5)", color: disabled ? "rgba(71,85,105,0.7)" : "#e2e8f0", cursor: disabled ? "not-allowed" : "pointer" }}>
                改名
              </button>
              <button type="button" onClick={deleteSelectedPreset} disabled={disabled}
                style={{ padding: "5px 10px", fontSize: 10, borderRadius: 7, border: "1px solid rgba(127,29,29,0.8)", background: "rgba(15,23,42,0.5)", color: disabled ? "rgba(71,85,105,0.7)" : "#fecaca", cursor: disabled ? "not-allowed" : "pointer" }}>
                削除
              </button>
            </>
          )}
        </div>
      </Card>

      {/* ─── Actions ─── */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={reset}
          disabled={disabled || !dirty}
          style={{
            flex: 1,
            padding: "8px 14px",
            fontSize: 12,
            borderRadius: 10,
            border: "1px solid rgba(51,65,85,0.8)",
            background: "rgba(15,23,42,0.5)",
            color: dirty ? "#e2e8f0" : "rgba(71,85,105,0.7)",
            cursor: disabled || !dirty ? "not-allowed" : "pointer",
            fontWeight: 500,
          }}
        >
          取消
        </button>
        <button
          type="button"
          onClick={commit}
          disabled={disabled}
          style={{
            flex: 2,
            padding: "8px 18px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            border: "1px solid rgba(129,140,248,0.5)",
            background: disabled
              ? "rgba(30,41,59,0.5)"
              : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)",
            color: disabled ? "rgba(71,85,105,0.7)" : "#ffffff",
            cursor: disabled ? "not-allowed" : "pointer",
            boxShadow: disabled ? "none" : "0 0 16px rgba(99,102,241,0.4), 0 2px 8px rgba(0,0,0,0.4)",
            transition: "box-shadow 0.2s",
            letterSpacing: "0.03em",
          }}
          title={dirty ? "入力した値をステージに反映" : "変更はありません（押すと閉じます）"}
        >
          ✓ 決定
        </button>
      </div>
    </div>
  );
}
