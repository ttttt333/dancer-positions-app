import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { DancerSpot } from "../types/choreography";
import {
  applyPositionSort,
  formatPositionSortPreview,
  permuteSlotsBySkillMinimizeTravelFromPrev,
  permuteSlotsMinimizeTravelFromPrev,
  normalizePositionSortDirection,
  positionSortDirectionOptions,
  swapTwoDancerPositions,
  type PositionSortAxis,
  type PositionSortDirection,
  type PositionSortScope,
} from "../lib/stageSelectionArrange";
import {
  defaultTravelMatchCueId,
  type TravelMatchCueOption,
} from "../lib/stagePrevCueCompare";
import {
  evenSelectionLine,
  straightenSelectionLine,
  type SelectionFlipAxis,
  type SelectionLineAxis,
} from "../lib/stageSelectionTransform";
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
              flex: options.length > 3 ? "1 1 calc(50% - 2px)" : "1 1 0",
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
  /**
   * 最短距離並び替えの参照キュー候補（前／次／その他）。
   * 空ならボタン無効。旧 prevCueDancers だけの呼び出しも可。
   */
  travelMatchOptions?: readonly TravelMatchCueOption[];
  /** @deprecated travelMatchOptions を渡す。無いときだけ使う */
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
  travelMatchOptions,
  prevCueDancers = null,
  onPermute,
  onArrange,
  onFlip,
  onBeginRotationPreview,
  ranksSlot,
}: StageSelectionArrangePanelProps) {
  const [axis, setAxis] = useState<PositionSortAxis>("height");
  const [scope, setScope] = useState<PositionSortScope>("all");
  const [directionPick, setDirection] = useState<PositionSortDirection>("asc");
  const [matchCueId, setMatchCueId] = useState<string | null>(null);
  const direction = normalizePositionSortDirection(axis, scope, directionPick);
  const preview = useMemo(
    () => formatPositionSortPreview({ axis, scope, direction }),
    [axis, scope, direction]
  );
  const dirOptions = positionSortDirectionOptions(axis, scope);
  const canSort = selectedCount >= 2 && !disabled;
  const canGather = selectedCount >= 1 && !disabled;
  const canSwapPair = selectedCount === 2 && !disabled;

  const matchOptions = useMemo((): TravelMatchCueOption[] => {
    if (travelMatchOptions && travelMatchOptions.length > 0) {
      return [...travelMatchOptions];
    }
    if (prevCueDancers && prevCueDancers.length > 0) {
      return [
        {
          cueId: "__prev__",
          ordinal: 0,
          kind: "previous",
          label: "前のキュー",
          dancers: prevCueDancers,
        },
      ];
    }
    return [];
  }, [travelMatchOptions, prevCueDancers]);

  useEffect(() => {
    if (matchOptions.length === 0) {
      setMatchCueId(null);
      return;
    }
    if (matchCueId && matchOptions.some((o) => o.cueId === matchCueId)) {
      return;
    }
    setMatchCueId(defaultTravelMatchCueId(matchOptions));
  }, [matchOptions, matchCueId]);

  const selectedMatch = useMemo(
    () => matchOptions.find((o) => o.cueId === matchCueId) ?? null,
    [matchOptions, matchCueId]
  );
  const matchDancers = selectedMatch?.dancers ?? null;
  const canMinimizeTravel =
    canSort && Boolean(matchDancers && matchDancers.length > 0);
  const prevOpt = matchOptions.find((o) => o.kind === "previous");
  const nextOpt = matchOptions.find((o) => o.kind === "next");

  const applyLine = (
    kind: "straighten" | "even",
    axis: SelectionLineAxis
  ) => {
    onArrange((dancers, ids) =>
      kind === "straighten"
        ? straightenSelectionLine(dancers, ids, axis)
        : evenSelectionLine(dancers, ids, axis)
    );
  };

  return (
    <div data-selection-arrange-panel>
      {ranksSlot}

      <div style={{ ...dockCard, marginBottom: 6 }}>
        <div style={dockSectionTitle}>一列にする</div>
        <p style={dockSectionHint}>
          選択した人を1本の横一列、または縦一列にします。整えるはでこぼこをまっすぐにし、均等は間隔も揃えます。左右や奥からの順番はそのままです。
        </p>
        <div style={{ ...dockSectionTitle, marginBottom: 4 }}>横一列</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button
            type="button"
            data-line-action="row-straighten"
            disabled={!canSort}
            title={
              canSort
                ? "高さを揃えて横一列にします。左右の位置はそのままです"
                : "2人以上を選択してください"
            }
            style={{ ...actionBtn, flex: 1, opacity: canSort ? 1 : 0.55 }}
            onClick={() => applyLine("straighten", "row")}
          >
            整える
          </button>
          <button
            type="button"
            data-line-action="row-even"
            disabled={!canSort}
            title={
              canSort
                ? "横一列に揃えて、両端のあいだを等間隔にします。左右の順番はそのままです"
                : "2人以上を選択してください"
            }
            style={{ ...actionBtn, flex: 1, opacity: canSort ? 1 : 0.55 }}
            onClick={() => applyLine("even", "row")}
          >
            均等
          </button>
        </div>
        <div style={{ ...dockSectionTitle, marginBottom: 4 }}>縦一列</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            data-line-action="col-straighten"
            disabled={!canSort}
            title={
              canSort
                ? "左右の位置を揃えて縦一列にします。奥行きの位置はそのままです"
                : "2人以上を選択してください"
            }
            style={{ ...actionBtn, flex: 1, opacity: canSort ? 1 : 0.55 }}
            onClick={() => applyLine("straighten", "col")}
          >
            整える
          </button>
          <button
            type="button"
            data-line-action="col-even"
            disabled={!canSort}
            title={
              canSort
                ? "縦一列に揃えて、奥と手前のあいだを等間隔にします。奥からの順番はそのままです"
                : "2人以上を選択してください"
            }
            style={{ ...actionBtn, flex: 1, opacity: canSort ? 1 : 0.55 }}
            onClick={() => applyLine("even", "col")}
          >
            均等
          </button>
        </div>
      </div>

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
        <div style={dockSectionTitle}>参照キューから最短距離</div>
        <p style={dockSectionHint}>
          位置はそのまま。最短距離だけ、またはスキル順を優先しつつ移動も抑えて入れ替え
        </p>
        {matchOptions.length > 0 ? (
          <>
            <div style={{ marginBottom: 6 }}>
              <Segment
                ariaLabel="最短距離の参照キュー（前後）"
                value={
                  selectedMatch?.kind === "previous"
                    ? "previous"
                    : selectedMatch?.kind === "next"
                      ? "next"
                      : "pick"
                }
                onChange={(next) => {
                  if (next === "previous" && prevOpt) {
                    setMatchCueId(prevOpt.cueId);
                    return;
                  }
                  if (next === "next" && nextOpt) {
                    setMatchCueId(nextOpt.cueId);
                    return;
                  }
                  if (next === "pick") {
                    const other =
                      matchOptions.find((o) => o.kind === "other") ??
                      matchOptions[0];
                    if (other) setMatchCueId(other.cueId);
                  }
                }}
                options={[
                  ...(prevOpt
                    ? [{ id: "previous" as const, label: "前のキュー" }]
                    : []),
                  ...(nextOpt
                    ? [{ id: "next" as const, label: "次のキュー" }]
                    : []),
                  ...(matchOptions.some((o) => o.kind === "other") ||
                  (!prevOpt && !nextOpt)
                    ? [{ id: "pick" as const, label: "指定" }]
                    : []),
                ]}
              />
            </div>
            <label
              style={{
                display: "block",
                marginBottom: 6,
                fontSize: 10,
                color: "#94a3b8",
              }}
            >
              参照キュー
              <select
                value={matchCueId ?? ""}
                onChange={(e) => setMatchCueId(e.target.value || null)}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 4,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #334155",
                  background: "#020617",
                  color: "#e2e8f0",
                  fontSize: 11,
                }}
              >
                {matchOptions.map((o) => (
                  <option key={o.cueId} value={o.cueId}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <p style={{ ...dockSectionHint, marginBottom: 6 }}>
            参照できる他のキューがありません
          </p>
        )}
        <button
          type="button"
          disabled={!canMinimizeTravel}
          title={
            canMinimizeTravel && selectedMatch
              ? `${selectedMatch.label} からの移動距離が最短になるよう並び替え`
              : matchOptions.length === 0
                ? "参照できるキューがありません"
                : "2人以上を選択してください"
          }
          style={{
            ...actionBtn,
            opacity: canMinimizeTravel ? 1 : 0.55,
            borderColor: canMinimizeTravel
              ? "rgba(52,211,153,0.85)"
              : undefined,
            background: canMinimizeTravel ? "rgba(16,185,129,0.16)" : undefined,
            color: canMinimizeTravel ? "#d1fae5" : undefined,
            fontWeight: 700,
          }}
          onClick={() =>
            onPermute((dancers, ids) =>
              permuteSlotsMinimizeTravelFromPrev(dancers, ids, matchDancers)
            )
          }
        >
          最短距離に並び替え
        </button>
        <button
          type="button"
          disabled={!canMinimizeTravel}
          title={
            canMinimizeTravel && selectedMatch
              ? `${selectedMatch.label} からの移動を抑えつつ、スキル順（一列目センター寄り）で並び替え`
              : matchOptions.length === 0
                ? "参照できるキューがありません"
                : "2人以上を選択してください"
          }
          style={{
            ...actionBtn,
            marginTop: 6,
            opacity: canMinimizeTravel ? 1 : 0.55,
            borderColor: canMinimizeTravel
              ? "rgba(167,139,250,0.85)"
              : undefined,
            background: canMinimizeTravel ? "rgba(124,58,237,0.16)" : undefined,
            color: canMinimizeTravel ? "#ede9fe" : undefined,
            fontWeight: 700,
          }}
          onClick={() =>
            onPermute((dancers, ids) =>
              permuteSlotsBySkillMinimizeTravelFromPrev(
                dancers,
                ids,
                matchDancers,
                "asc"
              )
            )
          }
        >
          スキル順＋最短距離
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
            options={dirOptions}
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
