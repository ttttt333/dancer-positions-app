import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import {
  formatMeterCmLabel,
  mmFromMeterAndCm,
  mmToMeterCm,
} from "../lib/stageDimensions";

const MAX_MM = 999_000;

type Props = {
  project: ChoreographyProjectJson;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  disabled: boolean;
  /** ヘッダー等の狭いスペース用（説明文を省略し密度を上げる） */
  compact?: boolean;
  /** 見出し「ステージサイズ／舞台の大きさ」を出さない（親がタイトルを付けるとき） */
  showHeading?: boolean;
  /** モーダル内など：外枠の枠線・背景を付けない */
  embedded?: boolean;
  /** 「決定」押下後に呼ばれる。親ダイアログを閉じるなど用途に。 */
  onCommit?: () => void;
};

function clampMm(mm: number): number {
  if (!Number.isFinite(mm) || mm <= 0) return 0;
  return Math.min(MAX_MM, Math.round(mm));
}

/** 間隔はメイン幅の半分以下に収める（袖まで等間隔点線用） */
function clampGuideIntervalToWidth(
  widthMm: number | null,
  intervalMm: number | null
): number | null {
  if (intervalMm == null || widthMm == null || widthMm <= 0) return intervalMm;
  const maxHalf = Math.max(1, Math.floor(widthMm / 2));
  return Math.min(Math.max(1, Math.floor(intervalMm)), maxHalf);
}

type DraftField = { m: string; cm: string };
type Draft = {
  width: DraftField;
  depth: DraftField;
  side: DraftField;
  back: DraftField;
  guide: DraftField;
};

function mmToDraftField(mm: number | null | undefined): DraftField {
  if (mm == null) return { m: "", cm: "" };
  const u = mmToMeterCm(mm);
  return { m: String(u.m), cm: String(u.cm) };
}

function draftFromProject(p: ChoreographyProjectJson): Draft {
  return {
    width: mmToDraftField(p.stageWidthMm),
    depth: mmToDraftField(p.stageDepthMm),
    side: mmToDraftField(p.sideStageMm),
    back: mmToDraftField(p.backStageMm),
    guide: mmToDraftField(p.centerFieldGuideIntervalMm),
  };
}

/** m/cm 文字列から mm（>0）へ。空欄なら null を返す。 */
function parseDraftFieldToMm(f: DraftField): number | null {
  const mT = f.m.trim();
  const cT = f.cm.trim();
  if (mT === "" && cT === "") return null;
  const m = mT === "" ? 0 : parseInt(mT, 10);
  const cm = cT === "" ? 0 : parseInt(cT, 10);
  if (!Number.isFinite(m) || !Number.isFinite(cm)) return null;
  const mm = clampMm(mmFromMeterAndCm(m, cm));
  return mm > 0 ? mm : null;
}

/** ドラフトの内容が現在のプロジェクトと異なるか */
function draftDiffers(draft: Draft, project: ChoreographyProjectJson): boolean {
  const wMm = parseDraftFieldToMm(draft.width);
  const dMm = parseDraftFieldToMm(draft.depth);
  const sMm = parseDraftFieldToMm(draft.side);
  const bMm = parseDraftFieldToMm(draft.back);
  const gMm = clampGuideIntervalToWidth(wMm, parseDraftFieldToMm(draft.guide));
  return (
    wMm !== (project.stageWidthMm ?? null) ||
    dMm !== (project.stageDepthMm ?? null) ||
    sMm !== (project.sideStageMm ?? null) ||
    bMm !== (project.backStageMm ?? null) ||
    gMm !== (project.centerFieldGuideIntervalMm ?? null)
  );
}

export function StageDimensionFields({
  project,
  setProject,
  disabled,
  compact = false,
  showHeading = true,
  embedded = false,
  onCommit,
}: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFromProject(project));

  /**
   * project 側の値が外部要因（プロジェクト切替・初期化など）で変わったら
   * ドラフトも追従させる。入力中の値はユーザ編集でしか変わらないので
   * 完全に上書きして OK。
   */
  useEffect(() => {
    setDraft(draftFromProject(project));
  }, [
    project.stageWidthMm,
    project.stageDepthMm,
    project.sideStageMm,
    project.backStageMm,
    project.centerFieldGuideIntervalMm,
  ]);

  const updateField = useCallback(
    <K extends keyof Draft>(key: K, patch: Partial<DraftField>) => {
      setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
    },
    []
  );

  /** ドラフトから mm を割り出した「確定されたらこうなる」値（表示用） */
  const previewMm = useMemo(() => {
    const wMm = parseDraftFieldToMm(draft.width);
    return {
      width: wMm,
      depth: parseDraftFieldToMm(draft.depth),
      side: parseDraftFieldToMm(draft.side),
      back: parseDraftFieldToMm(draft.back),
      guide: clampGuideIntervalToWidth(wMm, parseDraftFieldToMm(draft.guide)),
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

  const inputStyle = {
    width: compact ? ("52px" as const) : ("64px" as const),
    padding: compact ? ("4px" as const) : ("6px" as const),
    borderRadius: "6px" as const,
    border: "1px solid #334155" as const,
    background: "#0f172a" as const,
    color: "#e2e8f0" as const,
  };
  const inputStyleCm = {
    ...inputStyle,
    width: compact ? ("44px" as const) : ("56px" as const),
  };
  const rowGap = compact ? "6px" : "10px";
  const labelSize = compact ? "9px" : "10px";

  return (
    <div
      style={{
        padding: embedded ? 0 : compact ? "6px 8px" : "10px",
        borderRadius: embedded ? 0 : compact ? "8px" : "10px",
        border: embedded ? "none" : "1px solid #334155",
        background: embedded ? "transparent" : "#020617",
      }}
    >
      {showHeading ? (
        <div
          style={{
            fontSize: compact ? "10px" : "11px",
            fontWeight: 600,
            color: "#94a3b8",
            marginBottom: compact ? "6px" : "8px",
          }}
        >
          {compact ? "舞台の大きさ（詳細）" : "ステージサイズ"}
        </div>
      ) : null}
      {!compact && (
        <p style={{ margin: "0 0 10px", fontSize: "10px", color: "#64748b", lineHeight: 1.45 }}>
          メインの幅・奥行・サイド・バックは m / cm（センチは 0〜99、10 mm 単位）。
          <strong style={{ color: "#cbd5e1" }}>「決定」</strong>
          を押すまでステージには反映されません。
        </p>
      )}

      <div
        style={
          compact
            ? {
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                marginBottom: rowGap,
              }
            : { marginBottom: rowGap }
        }
      >
        <div style={compact ? {} : { marginBottom: rowGap }}>
          <div style={{ fontSize: labelSize, color: "#64748b", marginBottom: "4px" }}>
            メイン幅（上手〜下手）
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
            <input
              type="number"
              min={0}
              max={999}
              disabled={disabled}
              placeholder="m"
              value={draft.width.m}
              onChange={(e) => updateField("width", { m: e.target.value })}
              style={inputStyle}
            />
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>m</span>
            <input
              type="number"
              min={0}
              max={99}
              disabled={disabled}
              placeholder="cm"
              value={draft.width.cm}
              onChange={(e) => updateField("width", { cm: e.target.value })}
              style={inputStyleCm}
            />
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>cm</span>
            <span style={{ fontSize: compact ? "9px" : "10px", color: "#475569", marginLeft: "4px" }}>
              → {previewMm.width != null ? `${previewMm.width} mm` : "未設定"}
            </span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: labelSize, color: "#64748b", marginBottom: "4px" }}>
            メイン奥行（客席方向の深さ）
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
            <input
              type="number"
              min={0}
              max={999}
              disabled={disabled}
              placeholder="m"
              value={draft.depth.m}
              onChange={(e) => updateField("depth", { m: e.target.value })}
              style={inputStyle}
            />
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>m</span>
            <input
              type="number"
              min={0}
              max={99}
              disabled={disabled}
              placeholder="cm"
              value={draft.depth.cm}
              onChange={(e) => updateField("depth", { cm: e.target.value })}
              style={inputStyleCm}
            />
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>cm</span>
            <span style={{ fontSize: compact ? "9px" : "10px", color: "#475569", marginLeft: "4px" }}>
              → {previewMm.depth != null ? `${previewMm.depth} mm` : "未設定"}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: compact ? "8px" : "10px",
          marginBottom: rowGap,
        }}
      >
        <div>
          <div style={{ fontSize: labelSize, color: "#64748b", marginBottom: "4px" }}>サイド（片側）</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
            <input
              type="number"
              min={0}
              max={999}
              disabled={disabled}
              placeholder="m"
              value={draft.side.m}
              onChange={(e) => updateField("side", { m: e.target.value })}
              style={{ ...inputStyle, width: "52px" }}
            />
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>m</span>
            <input
              type="number"
              min={0}
              max={99}
              disabled={disabled}
              placeholder="cm"
              value={draft.side.cm}
              onChange={(e) => updateField("side", { cm: e.target.value })}
              style={{ ...inputStyleCm, width: "48px" }}
            />
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>cm</span>
          </div>
          <div style={{ fontSize: "9px", color: "#475569", marginTop: "4px" }}>
            {previewMm.side != null ? formatMeterCmLabel(previewMm.side) : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: labelSize, color: "#64748b", marginBottom: "4px" }}>バックステージ</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
            <input
              type="number"
              min={0}
              max={999}
              disabled={disabled}
              placeholder="m"
              value={draft.back.m}
              onChange={(e) => updateField("back", { m: e.target.value })}
              style={{ ...inputStyle, width: "52px" }}
            />
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>m</span>
            <input
              type="number"
              min={0}
              max={99}
              disabled={disabled}
              placeholder="cm"
              value={draft.back.cm}
              onChange={(e) => updateField("back", { cm: e.target.value })}
              style={{ ...inputStyleCm, width: "48px" }}
            />
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>cm</span>
          </div>
          <div style={{ fontSize: "9px", color: "#475569", marginTop: "4px" }}>
            {previewMm.back != null ? formatMeterCmLabel(previewMm.back) : "—"}
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: labelSize, color: "#64748b", marginBottom: "4px" }}>
          センターからの場ミリ
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          <input
            type="number"
            min={0}
            max={999}
            disabled={disabled}
            placeholder="m"
            value={draft.guide.m}
            onChange={(e) => updateField("guide", { m: e.target.value })}
            style={inputStyle}
          />
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>m</span>
          <input
            type="number"
            min={0}
            max={99}
            disabled={disabled}
            placeholder="cm"
            value={draft.guide.cm}
            onChange={(e) => updateField("guide", { cm: e.target.value })}
            style={inputStyleCm}
          />
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>cm</span>
          <span style={{ fontSize: compact ? "9px" : "10px", color: "#475569", marginLeft: "4px" }}>
            → {previewMm.guide != null ? `${previewMm.guide} mm` : "未設定"}
          </span>
        </div>
        {!compact && (
          <p style={{ margin: "6px 0 0", fontSize: "10px", color: "#64748b", lineHeight: 1.45 }}>
            この間隔でセンターから袖（メイン幅の左右端）まで等間隔の縦点線を表示します。メイン幅が入っていると半分以下に自動調整されます（未設定でも入力できます）。
          </p>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "8px",
          marginTop: compact ? "8px" : "12px",
          paddingTop: compact ? "6px" : "10px",
          borderTop: "1px solid #1e293b",
        }}
      >
        <button
          type="button"
          onClick={reset}
          disabled={disabled || !dirty}
          style={{
            padding: compact ? "4px 10px" : "6px 14px",
            fontSize: compact ? "11px" : "12px",
            borderRadius: "6px",
            border: "1px solid #334155",
            background: "#0f172a",
            color: dirty ? "#e2e8f0" : "#475569",
            cursor: disabled || !dirty ? "not-allowed" : "pointer",
          }}
          title="直前に決定した値に戻す"
        >
          取消
        </button>
        <button
          type="button"
          onClick={commit}
          disabled={disabled || !dirty}
          style={{
            padding: compact ? "4px 14px" : "6px 18px",
            fontSize: compact ? "11px" : "12px",
            fontWeight: 600,
            borderRadius: "6px",
            border: "1px solid #2563eb",
            background: dirty && !disabled ? "#2563eb" : "#1e293b",
            color: dirty && !disabled ? "#ffffff" : "#64748b",
            cursor: disabled || !dirty ? "not-allowed" : "pointer",
          }}
          title={dirty ? "入力した値をステージに反映" : "変更はありません"}
        >
          決定
        </button>
      </div>
    </div>
  );
}
