import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
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

export function StageDimensionFields({
  project,
  setProject,
  disabled,
  compact = false,
  showHeading = true,
  embedded = false,
}: Props) {
  const {
    stageWidthMm,
    stageDepthMm,
    sideStageMm,
    backStageMm,
    centerFieldGuideIntervalMm,
  } = project;

  const w = stageWidthMm != null ? mmToMeterCm(stageWidthMm) : null;
  const d = stageDepthMm != null ? mmToMeterCm(stageDepthMm) : null;
  const s = sideStageMm != null ? mmToMeterCm(sideStageMm) : null;
  const b = backStageMm != null ? mmToMeterCm(backStageMm) : null;

  const setWidth = (mStr: string, cmStr: string) => {
    const mT = mStr.trim();
    const cT = cmStr.trim();
    if (mT === "" && cT === "") {
      setProject((p) => ({
        ...p,
        stageWidthMm: null,
        centerFieldGuideIntervalMm: null,
      }));
      return;
    }
    const m = mT === "" ? 0 : parseInt(mT, 10);
    const cm = cT === "" ? 0 : parseInt(cT, 10);
    if (!Number.isFinite(m) || !Number.isFinite(cm)) return;
    const mm = clampMm(mmFromMeterAndCm(m, cm));
    setProject((p) => ({
      ...p,
      stageWidthMm: mm > 0 ? mm : null,
      centerFieldGuideIntervalMm: clampGuideIntervalToWidth(
        mm > 0 ? mm : null,
        p.centerFieldGuideIntervalMm
      ),
    }));
  };

  const setDepth = (mStr: string, cmStr: string) => {
    const mT = mStr.trim();
    const cT = cmStr.trim();
    if (mT === "" && cT === "") {
      setProject((p) => ({ ...p, stageDepthMm: null }));
      return;
    }
    const m = mT === "" ? 0 : parseInt(mT, 10);
    const cm = cT === "" ? 0 : parseInt(cT, 10);
    if (!Number.isFinite(m) || !Number.isFinite(cm)) return;
    const mm = clampMm(mmFromMeterAndCm(m, cm));
    setProject((p) => ({ ...p, stageDepthMm: mm > 0 ? mm : null }));
  };

  const setSide = (mStr: string, cmStr: string) => {
    const mT = mStr.trim();
    const cT = cmStr.trim();
    if (mT === "" && cT === "") {
      setProject((p) => ({ ...p, sideStageMm: null }));
      return;
    }
    const m = mT === "" ? 0 : parseInt(mT, 10);
    const cm = cT === "" ? 0 : parseInt(cT, 10);
    if (!Number.isFinite(m) || !Number.isFinite(cm)) return;
    const mm = clampMm(mmFromMeterAndCm(m, cm));
    setProject((p) => ({ ...p, sideStageMm: mm > 0 ? mm : null }));
  };

  const setBack = (mStr: string, cmStr: string) => {
    const mT = mStr.trim();
    const cT = cmStr.trim();
    if (mT === "" && cT === "") {
      setProject((p) => ({ ...p, backStageMm: null }));
      return;
    }
    const m = mT === "" ? 0 : parseInt(mT, 10);
    const cm = cT === "" ? 0 : parseInt(cT, 10);
    if (!Number.isFinite(m) || !Number.isFinite(cm)) return;
    const mm = clampMm(mmFromMeterAndCm(m, cm));
    setProject((p) => ({ ...p, backStageMm: mm > 0 ? mm : null }));
  };

  /** センターからの場ミリ（m/cm）— 入力途中も保持するためローカル state */
  const [guideM, setGuideM] = useState("");
  const [guideCm, setGuideCm] = useState("");

  useEffect(() => {
    if (centerFieldGuideIntervalMm == null) {
      setGuideM("");
      setGuideCm("");
    } else {
      const u = mmToMeterCm(centerFieldGuideIntervalMm);
      setGuideM(String(u.m));
      setGuideCm(String(u.cm));
    }
  }, [centerFieldGuideIntervalMm]);

  const commitGuideInterval = (mStr: string, cmStr: string) => {
    const mT = mStr.trim();
    const cT = cmStr.trim();
    if (mT === "" && cT === "") {
      setProject((p) => ({ ...p, centerFieldGuideIntervalMm: null }));
      return;
    }
    const m = mT === "" ? 0 : parseInt(mT, 10);
    const cm = cT === "" ? 0 : parseInt(cT, 10);
    if (!Number.isFinite(m) || !Number.isFinite(cm)) return;
    const mm = clampMm(mmFromMeterAndCm(m, cm));
    if (mm <= 0) return;
    setProject((p) => ({
      ...p,
      centerFieldGuideIntervalMm: clampGuideIntervalToWidth(p.stageWidthMm, mm),
    }));
  };

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
          メインの幅・奥行・サイド・バックは m / cm（センチは 0〜99、10 mm 単位）。変更はすぐステージの見た目と mm
          表示に反映されます。
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
            value={w ? String(w.m) : ""}
            onChange={(e) => setWidth(e.target.value, w ? String(w.cm) : "")}
            style={inputStyle}
          />
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>m</span>
          <input
            type="number"
            min={0}
            max={99}
            disabled={disabled}
            placeholder="cm"
            value={w ? String(w.cm) : ""}
            onChange={(e) => setWidth(w ? String(w.m) : "", e.target.value)}
            style={inputStyleCm}
          />
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>cm</span>
          <span style={{ fontSize: compact ? "9px" : "10px", color: "#475569", marginLeft: "4px" }}>
            → {stageWidthMm != null ? `${stageWidthMm} mm` : "未設定"}
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
            value={d ? String(d.m) : ""}
            onChange={(e) => setDepth(e.target.value, d ? String(d.cm) : "")}
            style={inputStyle}
          />
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>m</span>
          <input
            type="number"
            min={0}
            max={99}
            disabled={disabled}
            placeholder="cm"
            value={d ? String(d.cm) : ""}
            onChange={(e) => setDepth(d ? String(d.m) : "", e.target.value)}
            style={inputStyleCm}
          />
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>cm</span>
          <span style={{ fontSize: compact ? "9px" : "10px", color: "#475569", marginLeft: "4px" }}>
            → {stageDepthMm != null ? `${stageDepthMm} mm` : "未設定"}
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
              value={s ? String(s.m) : ""}
              onChange={(e) => setSide(e.target.value, s ? String(s.cm) : "")}
              style={{ ...inputStyle, width: "52px" }}
            />
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>m</span>
            <input
              type="number"
              min={0}
              max={99}
              disabled={disabled}
              placeholder="cm"
              value={s ? String(s.cm) : ""}
              onChange={(e) => setSide(s ? String(s.m) : "", e.target.value)}
              style={{ ...inputStyleCm, width: "48px" }}
            />
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>cm</span>
          </div>
          <div style={{ fontSize: "9px", color: "#475569", marginTop: "4px" }}>
            {sideStageMm != null ? formatMeterCmLabel(sideStageMm) : "—"}
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
              value={b ? String(b.m) : ""}
              onChange={(e) => setBack(e.target.value, b ? String(b.cm) : "")}
              style={{ ...inputStyle, width: "52px" }}
            />
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>m</span>
            <input
              type="number"
              min={0}
              max={99}
              disabled={disabled}
              placeholder="cm"
              value={b ? String(b.cm) : ""}
              onChange={(e) => setBack(b ? String(b.m) : "", e.target.value)}
              style={{ ...inputStyleCm, width: "48px" }}
            />
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>cm</span>
          </div>
          <div style={{ fontSize: "9px", color: "#475569", marginTop: "4px" }}>
            {backStageMm != null ? formatMeterCmLabel(backStageMm) : "—"}
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
            value={guideM}
            onChange={(e) => {
              const v = e.target.value;
              setGuideM(v);
              commitGuideInterval(v, guideCm);
            }}
            style={inputStyle}
          />
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>m</span>
          <input
            type="number"
            min={0}
            max={99}
            disabled={disabled}
            placeholder="cm"
            value={guideCm}
            onChange={(e) => {
              const v = e.target.value;
              setGuideCm(v);
              commitGuideInterval(guideM, v);
            }}
            style={inputStyleCm}
          />
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>cm</span>
          <span style={{ fontSize: compact ? "9px" : "10px", color: "#475569", marginLeft: "4px" }}>
            → {centerFieldGuideIntervalMm != null ? `${centerFieldGuideIntervalMm} mm` : "未設定"}
          </span>
        </div>
        {!compact && (
          <p style={{ margin: "6px 0 0", fontSize: "10px", color: "#64748b", lineHeight: 1.45 }}>
            この間隔でセンターから袖（メイン幅の左右端）まで等間隔の縦点線を表示します。メイン幅が入っていると半分以下に自動調整されます（未設定でも入力できます）。
          </p>
        )}
      </div>
    </div>
  );
}
