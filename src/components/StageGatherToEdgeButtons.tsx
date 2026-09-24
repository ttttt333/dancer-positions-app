import type { CSSProperties } from "react";
import type { GatherToward } from "../lib/gatherDancers";
import { dockActionBtn } from "./stageDockPanelStyles";

export const STAGE_GATHER_EDGE_ACTIONS: {
  toward: Extract<GatherToward, "shimote" | "kamite" | "back">;
  label: string;
  title: string;
}[] = [
  {
    toward: "shimote",
    label: "下手",
    title: "選択メンバーを下手（左）へ寄せる",
  },
  {
    toward: "kamite",
    label: "上手",
    title: "選択メンバーを上手（右）へ寄せる",
  },
  {
    toward: "back",
    label: "後ろ",
    title: "選択メンバーを舞台後ろ（奥）へ寄せる",
  },
];

const compactBtn: CSSProperties = {
  ...dockActionBtn,
  padding: "5px 4px",
  fontSize: 11,
  fontWeight: 600,
  minHeight: 28,
  lineHeight: 1.2,
};

export type StageGatherToEdgeButtonsProps = {
  disabled?: boolean;
  onGather: (toward: Extract<GatherToward, "shimote" | "kamite" | "back">) => void;
  /** ラベルを「下手に寄せる」にするか短い「下手」にするか */
  longLabels?: boolean;
};

/** 下手／上手／舞台後ろへ寄せる 3 ボタン（コンパクト） */
export function StageGatherToEdgeButtons({
  disabled = false,
  onGather,
  longLabels = false,
}: StageGatherToEdgeButtonsProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 4,
      }}
    >
      {STAGE_GATHER_EDGE_ACTIONS.map((a) => (
        <button
          key={a.toward}
          type="button"
          disabled={disabled}
          title={a.title}
          style={{
            ...compactBtn,
            opacity: disabled ? 0.5 : 1,
          }}
          onClick={() => onGather(a.toward)}
        >
          {longLabels
            ? a.toward === "back"
              ? "舞台後ろに寄せる"
              : `${a.label}に寄せる`
            : a.toward === "back"
              ? "後ろ"
              : a.label}
        </button>
      ))}
    </div>
  );
}
