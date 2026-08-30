import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE } from "../lib/dancerColorPalette";
import {
  applyPositionSort,
  formatPositionSortPreview,
  positionSortDirectionLabels,
  resolveArrangeTargetIds,
  rotateDancerRingOneStep,
  type PositionSortAxis,
  type PositionSortDirection,
  type PositionSortScope,
} from "../lib/stageSelectionArrange";
import { btnSecondary } from "./stageButtonStyles";
import type { StageDancerContextMenuProps } from "./StageDancerContextMenu";

export type BulkEditTabId = "basic" | "sort" | "formation" | "display";

export const BULK_EDIT_TABS: { id: BulkEditTabId; label: string }[] = [
  { id: "basic", label: "基本" },
  { id: "sort", label: "並べ替え" },
  { id: "formation", label: "隊列" },
  { id: "display", label: "表示" },
];

const PRIMARY_COLOR_COUNT = 8;

const sectionTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#94a3b8",
  margin: "0 0 6px",
};

const sectionHint: CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  margin: "0 0 8px",
  lineHeight: 1.45,
};

const card: CSSProperties = {
  border: "1px solid #1e293b",
  borderRadius: 10,
  padding: "10px 10px 12px",
  marginBottom: 12,
  background: "#080b12",
};

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
              minWidth: 72,
              padding: "9px 10px",
              borderRadius: 8,
              border: on ? "1px solid rgba(99,102,241,0.9)" : "1px solid #334155",
              background: on ? "rgba(99,102,241,0.22)" : "#020617",
              color: on ? "#e0e7ff" : "#94a3b8",
              fontSize: 13,
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

function ActionButton({
  children,
  onClick,
  disabled,
  title,
  danger,
  wide,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
  wide?: boolean;
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
        gridColumn: wide ? "1 / -1" : undefined,
        borderColor: danger ? "#7f1d1d" : btnSecondary.borderColor,
        color: danger ? "#fecaca" : btnSecondary.color,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

export type StageDancerBulkEditPanelProps = Omit<
  StageDancerContextMenuProps,
  "presentation" | "onCloseMenu"
> & {
  onCloseMenu: () => void;
  selectionColumnCount: number;
  selectionColumnSummary: string;
  selectionSwapAxis: "depth-rows" | "vertical-columns";
  runColumnDepthSwap: (colA: number, colB: number) => void;
  runKamiteShimoteSwap: () => void;
  tab: BulkEditTabId;
};

export function StageDancerBulkEditPanel({
  anchorDancerId,
  selectedDancerIds,
  menuInteractionDisabled,
  rawDancerLabelPosition,
  dancerLabelBelow,
  setProject,
  duplicateDancerIds,
  removeDancersByIds,
  applyBulkColorToDancerIds,
  applyBulkMarkerClear,
  applyBulkMarkerSequence,
  applyBulkMarkerSame,
  applyBulkMarkerCenterDistance,
  applyPermuteArrange,
  applyDancerArrange,
  selectionColumnCount,
  selectionColumnSummary,
  selectionSwapAxis,
  runColumnDepthSwap,
  runKamiteShimoteSwap,
  tab,
}: StageDancerBulkEditPanelProps) {
  const [axis, setAxis] = useState<PositionSortAxis>("height");
  const [scope, setScope] = useState<PositionSortScope>("all");
  const [direction, setDirection] = useState<PositionSortDirection>("asc");
  const [showAllColors, setShowAllColors] = useState(false);

  const targetIds = useMemo(
    () => resolveArrangeTargetIds(anchorDancerId, selectedDancerIds),
    [anchorDancerId, selectedDancerIds]
  );
  const sortRequest = useMemo(
    () => ({ axis, scope, direction }),
    [axis, scope, direction]
  );
  const preview = formatPositionSortPreview(sortRequest);
  const dirLabels = positionSortDirectionLabels(axis);
  const colors = showAllColors ? DANCER_PALETTE : DANCER_PALETTE.slice(0, PRIMARY_COLOR_COUNT);

  const runSort = () => {
    if (targetIds.length < 2) {
      window.alert("並べ替えは、対象を 2 人以上選んでください。");
      return;
    }
    if (scope === "all") {
      applyPermuteArrange((dancers, ids) => applyPositionSort(dancers, ids, sortRequest));
      return;
    }
    applyDancerArrange((dancers, ids) => applyPositionSort(dancers, ids, sortRequest));
  };

  return (
    <div>
      {tab === "basic" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <ActionButton
            disabled={menuInteractionDisabled}
            title="選択中のメンバーと同じ設定で複製（少し位置をずらす）"
            onClick={() => duplicateDancerIds(targetIds)}
          >
            複製（⌘D）
          </ActionButton>
          <ActionButton
            disabled={menuInteractionDisabled}
            danger
            title="選択全員を削除します"
            onClick={() => {
              if (targetIds.length === 0) return;
              const msg =
                targetIds.length === 1
                  ? "この立ち位置を削除しますか？"
                  : `選択中の ${targetIds.length} 人の立ち位置を削除しますか？`;
              if (!window.confirm(msg)) return;
              removeDancersByIds(targetIds);
            }}
          >
            削除
          </ActionButton>
        </div>
      ) : null}

      {tab === "sort" ? (
        <div>
          <p style={sectionHint}>
            身長・学年・スキルを、全体／横一列／縦一列のいずれかで並べ替えます。印の色は変えません。
          </p>
          <div style={{ marginBottom: 12 }}>
            <div style={sectionTitle}>軸</div>
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
          <div style={{ marginBottom: 12 }}>
            <div style={sectionTitle}>範囲</div>
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
          <div style={{ marginBottom: 12 }}>
            <div style={sectionTitle}>方向</div>
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
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.35)",
              color: "#c7d2fe",
              fontSize: 13,
              lineHeight: 1.45,
              fontWeight: 600,
            }}
          >
            {preview}
          </p>
          <ActionButton disabled={menuInteractionDisabled} onClick={runSort}>
            適用
          </ActionButton>
        </div>
      ) : null}

      {tab === "formation" ? (
        <div>
          <div style={card}>
            <div style={sectionTitle}>列の前後交代（横位置はそのまま）</div>
            <p style={sectionHint}>
              {selectionSwapAxis === "depth-rows"
                ? "前後の段を自動判定し、選んだ段どうしの前後（Y）だけ入れ替えます。"
                : "横位置の縦列を自動判定し、選んだ列どうしの前後（Y）だけ入れ替えます。"}
              {selectionColumnSummary ? `（${targetIds.length}人：${selectionColumnSummary}）` : null}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: selectionColumnCount >= 3 ? "1fr 1fr" : "1fr",
                gap: 8,
              }}
            >
              {selectionColumnCount >= 2 ? (
                <ActionButton
                  disabled={menuInteractionDisabled}
                  title="1列目と2列目の前後だけ入れ替え（X は不変）"
                  onClick={() => runColumnDepthSwap(0, 1)}
                >
                  1列目 ⇄ 2列目
                </ActionButton>
              ) : (
                <p style={{ ...sectionHint, margin: 0 }}>列を判定するには、横位置が分かれる 2 人以上を選んでください。</p>
              )}
              {selectionColumnCount >= 3 ? (
                <>
                  <ActionButton
                    disabled={menuInteractionDisabled}
                    title="1列目と3列目の前後だけ入れ替え（X は不変）"
                    onClick={() => runColumnDepthSwap(0, 2)}
                  >
                    1列目 ⇄ 3列目
                  </ActionButton>
                  <ActionButton
                    disabled={menuInteractionDisabled}
                    title="2列目と3列目の前後だけ入れ替え（X は不変）"
                    onClick={() => runColumnDepthSwap(1, 2)}
                  >
                    2列目 ⇄ 3列目
                  </ActionButton>
                </>
              ) : null}
            </div>
          </div>

          <div style={card}>
            <div style={sectionTitle}>上手・下手の交代（前後はそのまま）</div>
            <p style={sectionHint}>選択範囲の左右を反転します。前後（Y）は動きません。</p>
            <ActionButton disabled={menuInteractionDisabled} onClick={runKamiteShimoteSwap}>
              上手 ⇄ 下手
            </ActionButton>
          </div>

          <div style={{ ...card, marginBottom: 0 }}>
            <div style={sectionTitle}>位置の入れ替え（2人以上）</div>
            <p style={sectionHint}>
              選択範囲の重心まわりの角度順で、人はそのまま・立ち位置だけ 1 つずらします。
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <ActionButton
                onClick={() => {
                  if (targetIds.length < 2) {
                    window.alert("右回りの入れ替えは、対象を 2 人以上選んでください。");
                    return;
                  }
                  applyDancerArrange((dancers, t) => rotateDancerRingOneStep(dancers, t, "cw"));
                }}
              >
                右回り 1 人
              </ActionButton>
              <ActionButton
                onClick={() => {
                  if (targetIds.length < 2) {
                    window.alert("左回りの入れ替えは、対象を 2 人以上選んでください。");
                    return;
                  }
                  applyDancerArrange((dancers, t) => rotateDancerRingOneStep(dancers, t, "ccw"));
                }}
              >
                左回り 1 人
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "display" ? (
        <div>
          <div style={card}>
            <div style={sectionTitle}>名前の表示（全体）</div>
            <p style={sectionHint}>ステージ上のすべての印に共通。ステージまわりの設定でも変更できます。</p>
            <div style={{ display: "flex", gap: 8, marginBottom: dancerLabelBelow ? 10 : 0 }}>
              {(["inside", "below"] as const).map((pos) => {
                const current = rawDancerLabelPosition ?? "inside";
                const on = current === pos;
                return (
                  <button
                    key={pos}
                    type="button"
                    disabled={menuInteractionDisabled}
                    onClick={() => setProject((p) => ({ ...p, dancerLabelPosition: pos }))}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: on ? "1px solid rgba(99,102,241,0.9)" : "1px solid #334155",
                      background: on ? "rgba(99,102,241,0.22)" : "#020617",
                      color: on ? "#e0e7ff" : "#94a3b8",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: menuInteractionDisabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {pos === "inside" ? "丸の内" : "丸の下"}
                  </button>
                );
              })}
            </div>
            {dancerLabelBelow ? (
              <>
                <div style={{ ...sectionTitle, marginTop: 8 }}>丸の内（名前を丸の下のとき）</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <ActionButton
                    disabled={menuInteractionDisabled}
                    title="丸の内を空に（連番も出しません）"
                    onClick={() => {
                      if (targetIds.length === 0) return;
                      applyBulkMarkerClear(targetIds);
                    }}
                  >
                    空白
                  </ActionButton>
                  <ActionButton
                    disabled={menuInteractionDisabled}
                    title="並び順で連番を丸の内に"
                    onClick={() => {
                      const raw = window.prompt(
                        "連番の開始番号（整数）。フォーメーション順で丸の内に入れます。",
                        "1"
                      );
                      if (raw == null || raw.trim() === "") return;
                      const v = Number.parseInt(raw.trim(), 10);
                      if (!Number.isFinite(v)) {
                        window.alert("整数として読めませんでした。");
                        return;
                      }
                      applyBulkMarkerSequence(targetIds, v);
                    }}
                  >
                    連番…
                  </ActionButton>
                  <ActionButton
                    disabled={menuInteractionDisabled}
                    title="全員同じ文字（最大3文字）"
                    onClick={() => {
                      const raw = window.prompt("全員の丸の内を同じ内容に（最大3文字）。", "1");
                      if (raw == null || raw.trim() === "") return;
                      applyBulkMarkerSame(targetIds, raw);
                    }}
                  >
                    同じ…
                  </ActionButton>
                  <ActionButton
                    disabled={menuInteractionDisabled}
                    title="印の中心からステージ横幅のセンターまでの水平距離を、5cm 刻みの整数（cm）で丸の内に表示します。"
                    onClick={() => {
                      if (targetIds.length === 0) return;
                      applyBulkMarkerCenterDistance(targetIds);
                    }}
                  >
                    センターからの距離
                  </ActionButton>
                </div>
              </>
            ) : (
              <p style={{ ...sectionHint, margin: "8px 0 0" }}>
                「丸の下」を選ぶと、丸の内に空白・連番・同じ文字・センターからの距離を指定できます。
              </p>
            )}
          </div>

          <div style={{ ...card, marginBottom: 0 }}>
            <div style={sectionTitle}>印の色（選択に一括）</div>
            <div
              className="sdcm-color-grid"
              style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}
            >
              {colors.map((hex, i) => (
                <button
                  key={`bulk-color-${i}`}
                  type="button"
                  className="sdcm-color-btn"
                  title={`色 ${i + 1} に一括変更`}
                  onClick={() => applyBulkColorToDancerIds(targetIds, i)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    border: "1px solid #1e293b",
                    background: hex,
                    cursor: "pointer",
                    padding: 0,
                    boxSizing: "border-box",
                  }}
                />
              ))}
            </div>
            {DANCER_PALETTE.length > PRIMARY_COLOR_COUNT ? (
              <button
                type="button"
                onClick={() => setShowAllColors((v) => !v)}
                style={{
                  ...btnSecondary,
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {showAllColors ? "色を減らす" : "もっと見る"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
