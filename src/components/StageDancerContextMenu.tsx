import type { Dispatch, SetStateAction } from "react";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";
import { DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE } from "../lib/dancerColorPalette";
import {
  lineUpByGradeAsc,
  lineUpByGradeDesc,
  lineUpByHeightAsc,
  lineUpByHeightDesc,
  lineUpBySkillLargeToBack,
  lineUpBySkillSmallToBack,
  permuteSlotsByGradeAsc,
  permuteSlotsByGradeDesc,
  permuteSlotsByHeightAsc,
  permuteSlotsByHeightDesc,
  permuteSlotsBySkillAsc,
  permuteSlotsBySkillDesc,
  resolveArrangeTargetIds,
  rotateDancerRingOneStep,
} from "../lib/stageSelectionArrange";
import { btnSecondary } from "./stageButtonStyles";

export type StageDancerContextMenuProps = {
  anchorDancerId: string;
  selectedDancerIds: string[];
  menuInteractionDisabled: boolean;
  rawDancerLabelPosition: "inside" | "below" | undefined;
  dancerLabelBelow: boolean;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  duplicateDancerIds: (ids: string[]) => void;
  removeDancersByIds: (ids: string[]) => void;
  applyBulkColorToDancerIds: (ids: string[], colorIndex: number) => void;
  applyBulkMarkerClear: (ids: string[]) => void;
  applyBulkMarkerSequence: (ids: string[], start: number) => void;
  applyBulkMarkerSame: (ids: string[], badgeRaw: string) => void;
  applyBulkMarkerCenterDistance: (ids: string[]) => void;
  applyPermuteArrange: (
    fn: (dancers: DancerSpot[], targetIds: string[]) => DancerSpot[]
  ) => void;
  applyDancerArrange: (
    fn: (dancers: DancerSpot[], targetIds: string[]) => DancerSpot[]
  ) => void;
  onCloseMenu: () => void;
};

export function StageDancerContextMenu({
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
  onCloseMenu,
}: StageDancerContextMenuProps) {
  return (
    <>
  <div
    style={{
      fontSize: "9px",
      color: "#64748b",
      marginBottom: "5px",
      lineHeight: 1.3,
    }}
  >
    Shift+クリック／範囲ドラッグで複数選択。右クリック印が選択に含まれるときは
    <strong style={{ color: "#94a3b8" }}>選択全員</strong>が対象。
  </div>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "4px",
      marginBottom: "6px",
    }}
  >
    <button
      type="button"
      disabled={
menuInteractionDisabled
      }
      title="選択中のメンバーと同じ設定で複製（少し位置をずらす）"
      onClick={() => {
        const ids = resolveArrangeTargetIds(
          anchorDancerId,
          selectedDancerIds
        );
        duplicateDancerIds(ids);
      }}
      style={{
        ...btnSecondary,
        width: "100%",
        padding: "5px 6px",
        fontSize: "10px",
        fontWeight: 600,
      }}
    >
      複製（⌘D）
    </button>
    <button
      type="button"
      disabled={
menuInteractionDisabled
      }
      title="右クリック印が選択に含まれるときは選択全員を削除します"
      onClick={() => {
        const ids = resolveArrangeTargetIds(
          anchorDancerId,
          selectedDancerIds
        );
        if (ids.length === 0) return;
        const msg =
          ids.length === 1
            ? "この立ち位置を削除しますか？"
            : `選択中の ${ids.length} 人の立ち位置を削除しますか？`;
        if (!window.confirm(msg)) return;
        removeDancersByIds(ids);
      }}
      style={{
        ...btnSecondary,
        width: "100%",
        borderColor: "#7f1d1d",
        color: "#fecaca",
        padding: "5px 6px",
        fontSize: "10px",
        fontWeight: 600,
      }}
    >
      削除
    </button>
  </div>
  <div
    style={{
      fontSize: "9px",
      fontWeight: 600,
      color: "#94a3b8",
      margin: "4px 0 2px",
    }}
  >
    名前の表示（全体）
  </div>
  <div
    style={{
      display: "flex",
      gap: "4px",
      marginBottom: "3px",
    }}
    title="ステージ上のすべての印に共通。ステージまわりの設定でも変更可。"
  >
    <button
      type="button"
      disabled={
menuInteractionDisabled
      }
      onClick={() => {
        setProject((p) => ({ ...p, dancerLabelPosition: "inside" }));
      }}
      style={{
        flex: 1,
        padding: "4px 6px",
        borderRadius: "6px",
        border:
          (rawDancerLabelPosition ?? "inside") === "inside"
            ? "1px solid rgba(99,102,241,0.9)"
            : "1px solid #334155",
        background:
          (rawDancerLabelPosition ?? "inside") === "inside"
            ? "rgba(99,102,241,0.22)"
            : "#020617",
        color:
          (rawDancerLabelPosition ?? "inside") === "inside"
            ? "#e0e7ff"
            : "#94a3b8",
        fontSize: "10px",
        fontWeight: 600,
        cursor:
menuInteractionDisabled
            ? "not-allowed"
            : "pointer",
      }}
    >
      丸の内
    </button>
    <button
      type="button"
      disabled={
menuInteractionDisabled
      }
      onClick={() => {
        setProject((p) => ({ ...p, dancerLabelPosition: "below" }));
      }}
      style={{
        flex: 1,
        padding: "4px 6px",
        borderRadius: "6px",
        border:
          rawDancerLabelPosition === "below"
            ? "1px solid rgba(99,102,241,0.9)"
            : "1px solid #334155",
        background:
          rawDancerLabelPosition === "below"
            ? "rgba(99,102,241,0.22)"
            : "#020617",
        color:
          rawDancerLabelPosition === "below"
            ? "#e0e7ff"
            : "#94a3b8",
        fontSize: "10px",
        fontWeight: 600,
        cursor:
menuInteractionDisabled
            ? "not-allowed"
            : "pointer",
      }}
    >
      丸の下
    </button>
  </div>
  <div
    style={{
      fontSize: "8px",
      color: "#64748b",
      marginBottom: "5px",
      lineHeight: 1.3,
    }}
  >
    「丸の下」時は印には番号などのみ（下の「丸の内」で指定）。
  </div>
  <div
    style={{
      fontSize: "9px",
      fontWeight: 600,
      color: "#94a3b8",
      margin: "2px 0 2px",
    }}
  >
    印の色（選択に一括）
  </div>
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "3px",
      marginBottom: "5px",
    }}
  >
    {DANCER_PALETTE.map((hex, i) => (
      <button
        key={`cm-color-${i}`}
        type="button"
        title={`色 ${i + 1} に一括変更`}
        onClick={() => {
          const ids = resolveArrangeTargetIds(
            anchorDancerId,
            selectedDancerIds
          );
          applyBulkColorToDancerIds(ids, i);
          onCloseMenu();
        }}
        style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          border: "1px solid #1e293b",
          background: hex,
          cursor: "pointer",
          padding: 0,
          boxSizing: "border-box",
        }}
      />
    ))}
  </div>
  <div
    style={{
      fontSize: "9px",
      fontWeight: 600,
      color: "#94a3b8",
      margin: "2px 0 2px",
    }}
  >
    丸の内（名前を丸の下のとき）
  </div>
  {dancerLabelBelow ? (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "3px",
        marginBottom: "5px",
      }}
    >
      <button
        type="button"
        disabled={
          menuInteractionDisabled
        }
        style={{
          ...btnSecondary,
          width: "100%",
          fontSize: "9px",
          padding: "4px 4px",
          textAlign: "center",
        }}
        title="丸の内を空に（連番も出しません）"
        onClick={() => {
          const ids = resolveArrangeTargetIds(
            anchorDancerId,
            selectedDancerIds
          );
          if (ids.length === 0) return;
          applyBulkMarkerClear(ids);
          onCloseMenu();
        }}
      >
        空白
      </button>
      <button
        type="button"
        disabled={
          menuInteractionDisabled
        }
        style={{
          ...btnSecondary,
          width: "100%",
          fontSize: "9px",
          padding: "4px 4px",
          textAlign: "center",
        }}
        title="並び順で連番を丸の内に"
        onClick={() => {
          const ids = resolveArrangeTargetIds(
            anchorDancerId,
            selectedDancerIds
          );
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
          applyBulkMarkerSequence(ids, v);
          onCloseMenu();
        }}
      >
        連番…
      </button>
      <button
        type="button"
        disabled={
          menuInteractionDisabled
        }
        style={{
          ...btnSecondary,
          width: "100%",
          fontSize: "9px",
          padding: "4px 4px",
          textAlign: "center",
        }}
        title="全員同じ文字（最大3文字）"
        onClick={() => {
          const ids = resolveArrangeTargetIds(
            anchorDancerId,
            selectedDancerIds
          );
          const raw = window.prompt(
            "全員の丸の内を同じ内容に（最大3文字）。",
            "1"
          );
          if (raw == null || raw.trim() === "") return;
          applyBulkMarkerSame(ids, raw);
          onCloseMenu();
        }}
      >
        同じ…
      </button>
      <button
        type="button"
        disabled={
          menuInteractionDisabled
        }
        style={{
          ...btnSecondary,
          gridColumn: "1 / -1",
          width: "100%",
          fontSize: "9px",
          padding: "5px 4px",
          textAlign: "center",
          lineHeight: 1.25,
        }}
        title={
          "印の中心（○の中心）からステージ横幅のセンターまでの水平距離を、5cm 刻みの整数（cm）だけ丸の内に表示します。隣同士の間隔（場ミリ）やステージ幅を変えると、その場で数字が更新されます。ダンサー印の横ドラッグは 5cm 刻み（Shift で抑止）です。"
        }
        onClick={() => {
          const ids = resolveArrangeTargetIds(
            anchorDancerId,
            selectedDancerIds
          );
          if (ids.length === 0) return;
          applyBulkMarkerCenterDistance(ids);
          onCloseMenu();
        }}
      >
        センターからの距離
      </button>
    </div>
  ) : (
    <div
      style={{
        fontSize: "8px",
        color: "#64748b",
        marginBottom: "5px",
        lineHeight: 1.3,
      }}
    >
      「丸の下」を選ぶと空白・連番・同じ・センターからの距離を指定できます。
    </div>
  )}
  <div
    style={{
      fontSize: "9px",
      fontWeight: 600,
      color: "#94a3b8",
      margin: "3px 0 1px",
    }}
  >
    位置のまま入替（2人以上）
  </div>
  <div
    style={{
      fontSize: "8px",
      color: "#64748b",
      marginBottom: "3px",
      lineHeight: 1.25,
    }}
  >
    印の形は変えず、身長・学年・スキル順に人だけ割当。
  </div>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "3px",
      marginBottom: "5px",
    }}
  >
    <button
      type="button"
      style={{
        ...btnSecondary,
        width: "100%",
        fontSize: "9px",
        padding: "4px 5px",
        textAlign: "center",
      }}
      title="身長の低い順で位置を割り当て"
      onClick={() => applyPermuteArrange(permuteSlotsByHeightAsc)}
    >
      身長 低→高
    </button>
    <button
      type="button"
      style={{
        ...btnSecondary,
        width: "100%",
        fontSize: "9px",
        padding: "4px 5px",
        textAlign: "center",
      }}
      title="身長の高い順で位置を割り当て"
      onClick={() => applyPermuteArrange(permuteSlotsByHeightDesc)}
    >
      身長 高→低
    </button>
    <button
      type="button"
      style={{
        ...btnSecondary,
        width: "100%",
        fontSize: "9px",
        padding: "4px 5px",
        textAlign: "center",
      }}
      title="学年が若い順で位置を割り当て"
      onClick={() => applyPermuteArrange(permuteSlotsByGradeAsc)}
    >
      学年 低→高
    </button>
    <button
      type="button"
      style={{
        ...btnSecondary,
        width: "100%",
        fontSize: "9px",
        padding: "4px 5px",
        textAlign: "center",
      }}
      title="学年が高い順で位置を割り当て"
      onClick={() => applyPermuteArrange(permuteSlotsByGradeDesc)}
    >
      学年 高→低
    </button>
    <button
      type="button"
      style={{
        ...btnSecondary,
        width: "100%",
        fontSize: "9px",
        padding: "4px 5px",
        textAlign: "center",
      }}
      title="スキル数字が小さい順で位置を割り当て"
      onClick={() => applyPermuteArrange(permuteSlotsBySkillAsc)}
    >
      スキル 小→大
    </button>
    <button
      type="button"
      style={{
        ...btnSecondary,
        width: "100%",
        fontSize: "9px",
        padding: "4px 5px",
        textAlign: "center",
      }}
      title="スキル数字が大きい順で位置を割り当て"
      onClick={() => applyPermuteArrange(permuteSlotsBySkillDesc)}
    >
      スキル 大→小
    </button>
  </div>
  <div
    style={{
      fontSize: "9px",
      fontWeight: 600,
      color: "#94a3b8",
      margin: "2px 0 1px",
    }}
  >
    位置の入れ替え（2人以上）
  </div>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "3px",
      marginBottom: "5px",
    }}
  >
    <button
      type="button"
      style={{
        ...btnSecondary,
        width: "100%",
        fontSize: "9px",
        padding: "4px 5px",
        textAlign: "center",
      }}
      onClick={() => {
        const ids = resolveArrangeTargetIds(
          anchorDancerId,
          selectedDancerIds
        );
        if (ids.length < 2) {
          window.alert("右回りの入れ替えは、対象を 2 人以上選んでください。");
          onCloseMenu();
          return;
        }
        applyDancerArrange((dancers, t) =>
          rotateDancerRingOneStep(dancers, t, "cw")
        );
      }}
    >
      右回り 1 人
    </button>
    <button
      type="button"
      style={{
        ...btnSecondary,
        width: "100%",
        fontSize: "9px",
        padding: "4px 5px",
        textAlign: "center",
      }}
      onClick={() => {
        const ids = resolveArrangeTargetIds(
          anchorDancerId,
          selectedDancerIds
        );
        if (ids.length < 2) {
          window.alert("左回りの入れ替えは、対象を 2 人以上選んでください。");
          onCloseMenu();
          return;
        }
        applyDancerArrange((dancers, t) =>
          rotateDancerRingOneStep(dancers, t, "ccw")
        );
      }}
    >
      左回り 1 人
    </button>
  </div>
  <div
    style={{
      fontSize: "9px",
      fontWeight: 600,
      color: "#94a3b8",
      margin: "2px 0 1px",
    }}
  >
    横一列（選択枠内）
  </div>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "3px",
      marginBottom: "5px",
    }}
  >
    <button
      type="button"
      style={{
        ...btnSecondary,
        width: "100%",
        fontSize: "9px",
        padding: "4px 5px",
        textAlign: "center",
      }}
      onClick={() => applyDancerArrange(lineUpByHeightAsc)}
    >
      身長 低→高
    </button>
    <button
      type="button"
      style={{
        ...btnSecondary,
        width: "100%",
        fontSize: "9px",
        padding: "4px 5px",
        textAlign: "center",
      }}
      onClick={() => applyDancerArrange(lineUpByHeightDesc)}
    >
      身長 高→低
    </button>
  </div>
  <div
    style={{
      fontSize: "9px",
      fontWeight: 600,
      color: "#94a3b8",
      margin: "2px 0 1px",
    }}
  >
    学年（横一列）
  </div>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "3px",
      marginBottom: "5px",
    }}
  >
    <button
      type="button"
      style={{
        ...btnSecondary,
        width: "100%",
        fontSize: "9px",
        padding: "4px 5px",
        textAlign: "center",
      }}
      title="学年が低い順（若い順）で並べる"
      onClick={() => applyDancerArrange(lineUpByGradeAsc)}
    >
      低（若）→高
    </button>
    <button
      type="button"
      style={{
        ...btnSecondary,
        width: "100%",
        fontSize: "9px",
        padding: "4px 5px",
        textAlign: "center",
      }}
      onClick={() => applyDancerArrange(lineUpByGradeDesc)}
    >
      高→低
    </button>
  </div>
  <div
    style={{
      fontSize: "9px",
      fontWeight: 600,
      color: "#94a3b8",
      margin: "2px 0 1px",
    }}
  >
    スキル縦一列（奥＝上・手前＝客席）
  </div>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "3px",
      marginBottom: "2px",
    }}
  >
    <button
      type="button"
      style={{
        ...btnSecondary,
        width: "100%",
        fontSize: "9px",
        padding: "4px 5px",
        textAlign: "center",
      }}
      title="スキル数字が小さい人を奥へ（縦一列）"
      onClick={() => applyDancerArrange(lineUpBySkillSmallToBack)}
    >
      小→奥
    </button>
    <button
      type="button"
      style={{
        ...btnSecondary,
        width: "100%",
        fontSize: "9px",
        padding: "4px 5px",
        textAlign: "center",
      }}
      title="スキル数字が大きい人を奥へ（縦一列）"
      onClick={() => applyDancerArrange(lineUpBySkillLargeToBack)}
    >
      大→奥
    </button>
  </div>
    </>
  );
}
