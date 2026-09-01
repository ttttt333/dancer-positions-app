import { useMemo, useState, type CSSProperties } from "react";
import type { DancerSpot } from "../types/choreography";
import {
  applyPositionSort,
  formatPositionSortPreview,
  positionSortDirectionLabels,
  type PositionSortAxis,
  type PositionSortDirection,
  type PositionSortScope,
} from "../lib/stageSelectionArrange";
import type { SelectionFlipAxis } from "../lib/stageSelectionTransform";
import type { PositionRotationDir } from "../lib/stagePositionRotation";
import {
  dockActionBtn,
  dockCard,
  dockSectionTitle,
} from "./stageDockPanelStyles";

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
      style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
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
              padding: "8px 6px",
              borderRadius: 8,
              border: on ? "1px solid rgba(251,191,36,0.9)" : "1px solid #334155",
              background: on ? "rgba(251,191,36,0.16)" : "#020617",
              color: on ? "#fde68a" : "#94a3b8",
              fontSize: 12,
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
  onPermute: (
    fn: (dancers: DancerSpot[], targetIds: string[]) => DancerSpot[]
  ) => void;
  onArrange: (
    fn: (dancers: DancerSpot[], targetIds: string[]) => DancerSpot[]
  ) => void;
  onFlip?: (axis: SelectionFlipAxis) => void;
  onBeginRotationPreview?: (dir: PositionRotationDir) => void;
};

export function StageSelectionArrangePanel({
  selectedCount,
  disabled,
  onPermute,
  onArrange,
  onFlip,
  onBeginRotationPreview,
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

  return (
    <div data-selection-arrange-panel>
      <div style={{ ...dockCard, padding: "8px 8px 10px", marginBottom: 8 }}>
        <div style={{ ...dockSectionTitle, marginBottom: 8 }}>属性で並べ替え</div>
        <div style={{ marginBottom: 8 }}>
          <div style={dockSectionTitle}>軸</div>
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
        <div style={{ marginBottom: 8 }}>
          <div style={dockSectionTitle}>範囲</div>
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
        <div style={{ marginBottom: 8 }}>
          <div style={dockSectionTitle}>方向</div>
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
            margin: "0 0 8px",
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(251,191,36,0.1)",
            border: "1px solid rgba(251,191,36,0.35)",
            color: "#fde68a",
            fontSize: 12,
            lineHeight: 1.4,
            fontWeight: 600,
          }}
        >
          {preview}
        </p>
        <button
          type="button"
          disabled={!canSort}
          style={{ ...actionBtn, opacity: canSort ? 1 : 0.55 }}
          onClick={() => {
            const req = { axis, scope, direction };
            if (scope === "all") {
              onPermute((dancers, ids) => applyPositionSort(dancers, ids, req));
              return;
            }
            onArrange((dancers, ids) => applyPositionSort(dancers, ids, req));
          }}
        >
          並べ替えを適用
        </button>
      </div>

      <div style={{ ...dockCard, padding: "8px 8px 10px", marginBottom: 8 }}>
        <div style={{ ...dockSectionTitle, marginBottom: 8 }}>反転</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            type="button"
            disabled={disabled}
            title="左右を反転（上手 ⇄ 下手）"
            style={actionBtn}
            onClick={() => onFlip?.("x")}
          >
            左右を反転
          </button>
          <button
            type="button"
            disabled={disabled}
            title="上下を反転（客席 ⇄ 舞台裏）"
            style={actionBtn}
            onClick={() => onFlip?.("y")}
          >
            上下を反転
          </button>
        </div>
      </div>

      {onBeginRotationPreview ? (
        <div style={{ ...dockCard, marginBottom: 0, padding: "8px 8px 10px" }}>
          <div style={{ ...dockSectionTitle, marginBottom: 8 }}>位置の入れ替え</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              type="button"
              disabled={disabled}
              style={actionBtn}
              onClick={() => onBeginRotationPreview("cw")}
            >
              右回り 1人
            </button>
            <button
              type="button"
              disabled={disabled}
              style={actionBtn}
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
