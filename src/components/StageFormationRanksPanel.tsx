import { useMemo, type ReactNode } from "react";
import type { DepthSwapInspect } from "../lib/stageDepthPreview";
import { formatRankIndexSetLabel } from "../lib/stageDepthPreview";
import { btnSecondary } from "./stageButtonStyles";
import {
  dockCard,
  dockSectionHint,
  dockSectionTitle,
} from "./stageDockPanelStyles";

function RankButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      style={{
        ...btnSecondary,
        width: "100%",
        padding: "10px 12px",
        fontSize: 13,
        fontWeight: 600,
        minHeight: 44,
        lineHeight: 1.35,
        whiteSpace: "normal",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

export type StageFormationRanksPanelProps = {
  inspect: DepthSwapInspect;
  pickSlot: "a" | "b";
  selectedA: readonly number[];
  selectedB: readonly number[];
  onPickSlot: (slot: "a" | "b") => void;
  onToggleIndex: (index: number) => void;
  onSwapSets: (colsA: number[], colsB: number[]) => void;
};

function NumberChip({
  index,
  slot,
  onClick,
}: {
  index: number;
  slot: "a" | "b" | null;
  onClick: () => void;
}) {
  const selected = slot != null;
  return (
    <button
      type="button"
      data-rank-chip={index}
      aria-pressed={selected}
      title={`${index + 1}列目`}
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        padding: 0,
        border:
          slot === "a"
            ? "2px solid rgba(251, 191, 36, 0.95)"
            : slot === "b"
              ? "2px solid rgba(125, 211, 252, 0.95)"
              : "1px solid #334155",
        background:
          slot === "a"
            ? "rgba(251, 191, 36, 0.92)"
            : slot === "b"
              ? "rgba(14, 116, 144, 0.92)"
              : "#020617",
        color: slot === "a" ? "#14100a" : slot === "b" ? "#ecfeff" : "#e2e8f0",
        fontSize: 15,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {index + 1}
    </button>
  );
}

/**
 * 舞台の番号を選んで、任意の列どうし（まとめても可）を前後交代する。
 */
export function StageFormationRanksPanel({
  inspect,
  pickSlot,
  selectedA,
  selectedB,
  onPickSlot,
  onToggleIndex,
  onSwapSets,
}: StageFormationRanksPanelProps) {
  const unit = inspect.unit;
  const overlap = selectedA.some((i) => selectedB.includes(i));
  const canRun =
    inspect.groupCount >= 2 &&
    selectedA.length > 0 &&
    selectedB.length > 0 &&
    !overlap;
  const labelA = formatRankIndexSetLabel(selectedA, unit);
  const labelB = formatRankIndexSetLabel(selectedB, unit);

  const chipSlot = useMemo(() => {
    const map = new Map<number, "a" | "b">();
    for (const i of selectedA) map.set(i, "a");
    for (const i of selectedB) map.set(i, "b");
    return map;
  }, [selectedA, selectedB]);

  return (
    <div data-formation-ranks-panel>
      <div style={{ ...dockCard, marginBottom: 0 }}>
        <div style={dockSectionTitle}>列の前後交代（横位置はそのまま）</div>
        <p style={dockSectionHint}>
          舞台左の番号、または下の数字を選んでから実行します。3列目と5列目、4・5列目と10・11列目のようにまとめられます。
          {inspect.summary ? `（${inspect.summary}）` : null}
        </p>
        {inspect.groupCount >= 2 ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <button
                type="button"
                aria-pressed={pickSlot === "a"}
                onClick={() => onPickSlot("a")}
                style={{
                  ...btnSecondary,
                  minHeight: 40,
                  fontWeight: 800,
                  border:
                    pickSlot === "a"
                      ? "1px solid rgba(251, 191, 36, 0.95)"
                      : "1px solid #334155",
                  color: pickSlot === "a" ? "#fde68a" : "#e2e8f0",
                }}
              >
                1つ目を選ぶ
              </button>
              <button
                type="button"
                aria-pressed={pickSlot === "b"}
                onClick={() => onPickSlot("b")}
                style={{
                  ...btnSecondary,
                  minHeight: 40,
                  fontWeight: 800,
                  border:
                    pickSlot === "b"
                      ? "1px solid rgba(125, 211, 252, 0.95)"
                      : "1px solid #334155",
                  color: pickSlot === "b" ? "#bae6fd" : "#e2e8f0",
                }}
              >
                2つ目を選ぶ
              </button>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 10,
              }}
            >
              {inspect.groupLines.map((_, i) => (
                <NumberChip
                  key={i}
                  index={i}
                  slot={chipSlot.get(i) ?? null}
                  onClick={() => onToggleIndex(i)}
                />
              ))}
            </div>
            <p style={{ ...dockSectionHint, margin: "0 0 10px" }}>
              {labelA && labelB
                ? `${labelA} ⇄ ${labelB}`
                : pickSlot === "a"
                  ? "1つ目の列番号を選んでください。"
                  : "2つ目の列番号を選んでください。"}
            </p>
            <RankButton
              disabled={!canRun}
              title={
                overlap
                  ? "同じ列は両方に選べません"
                  : canRun
                    ? `${labelA}と${labelB}の前後を交換`
                    : "1つ目と2つ目の列を選んでください"
              }
              onClick={() => onSwapSets([...selectedA], [...selectedB])}
            >
              前後を入れ替え
            </RankButton>
          </>
        ) : (
          <p style={{ ...dockSectionHint, margin: 0 }}>
            列を判定するには、横位置が分かれる 2 人以上を選んでください。
          </p>
        )}
      </div>
    </div>
  );
}
