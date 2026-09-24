import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { DancerSpot } from "../types/choreography";
import {
  applyPositionSort,
  formatPositionSortPreview,
  permuteSlotsMinimizeTravelFromPrev,
  positionSortDirectionLabels,
  swapTwoDancerPositions,
  type PositionSortAxis,
  type PositionSortDirection,
  type PositionSortScope,
} from "../lib/stageSelectionArrange";
import type { SelectionFlipAxis } from "../lib/stageSelectionTransform";
import type { PositionRotationDir } from "../lib/stagePositionRotation";
import { gatherSelectedDancersToEdge } from "../lib/gatherDancers";
import {
  dockActionBtn,
  dockCard,
  dockSectionHint,
  dockSectionTitle,
} from "./stageDockPanelStyles";
import { StageGatherToEdgeButtons } from "./StageGatherToEdgeButtons";

function Segment<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { id: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{ display: "flex", gap: 4, flexWrap: "wrap" }}
    >
      {options.map((opt) => {
        const on = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(opt.id)}
            style={{
              flex: "1 1 0",
              minWidth: 0,
              padding: "5px 4px",
              borderRadius: 6,
              border: on ? "1px solid rgba(251,191,36,0.9)" : "1px solid #334155",
              background: on ? "rgba(251,191,36,0.16)" : "#020617",
              color: on ? "#fde68a" : "#94a3b8",
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const actionBtn: CSSProperties = dockActionBtn;

export type StageSelectionArrangePanelProps = {
  selectedCount: number;
  disabled?: boolean;
  /** 直前 Cue の立ち位置（最短距離並び替え用）。無いとボタン無効 */
  prevCueDancers?: readonly DancerSpot[] | null;
  onPermute: (
    fn: (dancers: DancerSpot[], targetIds: string[]) => DancerSpot[]
  ) => void;
  onArrange: (
    fn: (dancers: DancerSpot[], targetIds: string[]) => DancerSpot[]
  ) => void;
  onFlip?: (axis: SelectionFlipAxis) => void;
  onBeginRotationPreview?: (dir: PositionRotationDir) => void;
  /** 「列の前後交代」など、並べ替えタブに集約する追加 UI */
  ranksSlot?: ReactNode;
};

export function StageSelectionArrangePanel({
  selectedCount,
  disabled,
  prevCueDancers = null,
  onPermute,
  onArrange,
  onFlip,
  onBeginRotationPreview,
  ranksSlot,
}: StageSelectionArrangePanelProps) {
  const [axis, setAxis] = useState<PositionSortAxis>("height");
  const [scope, setScope] = useState<PositionSortScope>("all");
  const [direction, setDirection] = useState<PositionSortDirection>("asc");
  const preview = useMemo(
    () => formatPositionSortPreview({ axis, scope, direction }),
    [axis, scope, direction]
  );
  const dirLabels = positionSortDirectionLabels(axis);
  const canSort = selectedCount >= 2 && !disabled;
  const canGather = selectedCount >= 1 && !disabled;
  const canSwapPair = selectedCount === 2 && !disabled;
  const canMinimizePrev =
    canSort && Boolean(prevCueDancers && prevCueDancers.length > 0);

  return (
    <div data-selection-arrange-panel>
      {ranksSlot}

      <div style={{ ...dockCard, marginBottom: 6 }}>
        <div style={dockSectionTitle}>辺に寄せる</div>
        <p style={dockSectionHint}>
          選択メンバーを下手／上手／舞台後ろへ寄せて並べ替え
        </p>
        <StageGatherToEdgeButtons
          disabled={!canGather}
          onGather={(toward) =>
            onArrange((dancers, ids) =>
              gatherSelectedDancersToEdge(dancers, ids, toward)
            )
          }
        />
      </div>

      <div style={{ ...dockCard, marginBottom: 6 }}>
        <div style={dockSectionTitle}>前の立ち位置から最短距離</div>
        <p style={dockSectionHint}>
          位置はそのまま、直前キューからの移動が最短になるよう入れ替え
        </p>
        <button
          type="button"
          disabled={!canMinimizePrev}
          title={
            canMinimizePrev
              ? "前の立ち位置からの移動距離が最短になるよう並び替え"
              : !prevCueDancers || prevCueDancers.length === 0
                ? "直前のキューがありません"
                : "2人以上を選択してください"
          }
          style={{
            ...actionBtn,
            opacity: canMinimizePrev ? 1 : 0.55,
            borderColor: canMinimizePrev
              ? "rgba(52,211,153,0.85)"
              : undefined,
            background: canMinimizePrev ? "rgba(16,185,129,0.16)" : undefined,
            color: canMinimizePrev ? "#d1fae5" : undefined,
            fontWeight: 700,
          }}
          onClick={() =>
            onPermute((dancers, ids) =>
              permuteSlotsMinimizeTravelFromPrev(dancers, ids, prevCueDancers)
            )
          }
        >
          最短距離に並び替え
        </button>
      </div>

      <div style={dockCard}>
        <div style={{ ...dockSectionTitle, marginBottom: 4 }}>属性で並べ替え</div>
        <p style={dockSectionHint}>
          身長・学年・スキルの順で立ち位置を入れ替え
        </p>
        <div style={{ marginBottom: 6 }}>
          <div style={dockSectionTitle}>何で並べる？</div>
          <Segment
            ariaLabel="並べ替えの軸"
            value={axis}
            onChange={setAxis}
            options={[
              { id: "height", label: "身長" },
              { id: "grade", label: "学年" },
              { id: "skill", label: "スキル" },
            ]}
          />
        </div>
        <div style={{ marginBottom: 6 }}>
          <div style={dockSectionTitle}>どこで？</div>
          <Segment
            ariaLabel="並べ替えの範囲"
            value={scope}
            onChange={setScope}
            options={[
              { id: "all", label: "全体" },
              { id: "row", label: "横一列" },
              { id: "col", label: "縦一列" },
            ]}
          />
        </div>
        <div style={{ marginBottom: 6 }}>
          <div style={dockSectionTitle}>順番</div>
          <Segment
            ariaLabel="並べ替えの方向"
            value={direction}
            onChange={setDirection}
            options={[
              { id: "asc", label: dirLabels.asc },
              { id: "desc", label: dirLabels.desc },
            ]}
          />
        </div>
        <p
          style={{
            margin: "0 0 10px",
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(251,191,36,0.1)",
            border: "1px solid rgba(251,191,36,0.35)",
            color: "#fde68a",
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          {preview}
        </p>
        <button
          type="button"
          disabled={!canSort}
          title={canSort ? "並べ替えを適用" : "2人以上を選択してください"}
          style={{
            ...actionBtn,
            opacity: canSort ? 1 : 0.55,
          }}
          onClick={() =>
            onArrange((dancers, ids) =>
              applyPositionSort(dancers, ids, { axis, scope, direction })
            )
          }
        >
          並べ替えを適用
        </button>
      </div>

      <div style={dockCard}>
        <div style={{ ...dockSectionTitle, marginBottom: 6 }}>二人を入れ替え</div>
        <p
          style={{
            margin: "0 0 8px",
            color: "#94a3b8",
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          Shift / ⌘ クリックで2人を選び、「入れ替え」を押します。
        </p>
        <button
          type="button"
          disabled={!canSwapPair}
          title={
            canSwapPair
              ? "選んだ2人の立ち位置を入れ替える"
              : "ちょうど2人を選択してください"
          }
          style={{
            ...actionBtn,
            opacity: canSwapPair ? 1 : 0.55,
            borderColor: canSwapPair
              ? "rgba(56,189,248,0.85)"
              : undefined,
            background: canSwapPair ? "rgba(14,165,233,0.18)" : undefined,
            color: canSwapPair ? "#e0f2fe" : undefined,
            fontWeight: 700,
          }}
          onClick={() =>
            onPermute((dancers, ids) => swapTwoDancerPositions(dancers, ids))
          }
        >
          二人を入れ替え
        </button>
      </div>

      {onFlip ? (
        <div style={dockCard}>
          <div style={{ ...dockSectionTitle, marginBottom: 8 }}>反転</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              style={{ ...actionBtn, flex: 1 }}
              onClick={() => onFlip("x")}
            >
              左右を反転
            </button>
            <button
              type="button"
              style={{ ...actionBtn, flex: 1 }}
              onClick={() => onFlip("y")}
            >
              上下を反転
            </button>
          </div>
        </div>
      ) : null}

      {onBeginRotationPreview ? (
        <div style={{ ...dockCard, marginBottom: 0 }}>
          <div style={{ ...dockSectionTitle, marginBottom: 8 }}>位置の入れ替え</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              style={{ ...actionBtn, flex: 1 }}
              onClick={() => onBeginRotationPreview("cw")}
            >
              右回り 1人
            </button>
            <button
              type="button"
              style={{ ...actionBtn, flex: 1 }}
              onClick={() => onBeginRotationPreview("ccw")}
            >
              左回り 1人
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
