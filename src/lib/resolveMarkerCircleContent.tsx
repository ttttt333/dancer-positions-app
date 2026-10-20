import type { CSSProperties, ReactNode } from "react";
import { DancerFaceStampGlyph } from "../components/DancerFaceStampGlyph";
import {
  normalizeDancerFaceStamp,
  type DancerFaceStampId,
} from "./dancerFaceStamp";
import {
  dancerCircleInnerBelowLabel,
  layoutMarkerCircleInnerLabel,
} from "./stageBoardModelHelpers";
import type { DancerSpot } from "../types/choreography";

export type MarkerCircleContent = {
  faceStamp: DancerFaceStampId | undefined;
  /** ○内に出す内容（スタンプまたは文字） */
  circleLabel: ReactNode;
  /** 文字ラベル時のフィット用。スタンプ時は "☺" 相当 */
  layoutLabel: string;
  spanStyle: CSSProperties;
  fontSizePx: number;
  /** スタンプ時は名前を○下に強制表示 */
  showNameBelow: boolean;
};

/**
 * ○内表示：faceStamp があれば表情スタンプ、なければ番号／名前。
 */
export function resolveMarkerCircleContent(
  dancer: DancerSpot,
  dancerIndex: number,
  opts: {
    markerPx: number;
    dancerLabelBelow: boolean;
    screenUnrotateDeg: number;
    circleInnerOpts?: { effXPct: number; stageWidthMm: number };
  }
): MarkerCircleContent {
  const faceStamp = normalizeDancerFaceStamp(dancer.faceStamp);
  if (faceStamp) {
    const stampSize = Math.max(12, Math.round(opts.markerPx * 0.78));
    return {
      faceStamp,
      circleLabel: <DancerFaceStampGlyph id={faceStamp} size={stampSize} />,
      layoutLabel: "☺",
      fontSizePx: Math.round(opts.markerPx * 0.4),
      spanStyle: {
        position: "relative",
        zIndex: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `rotate(${opts.screenUnrotateDeg}deg)`,
        transformOrigin: "center center",
        lineHeight: 1,
      },
      // スタンプ時は名前が○内に出ないので下へ
      showNameBelow: true,
    };
  }

  const text = opts.dancerLabelBelow
    ? dancerCircleInnerBelowLabel(dancer, dancerIndex, opts.circleInnerOpts)
    : dancer.label || "?";
  const layout = layoutMarkerCircleInnerLabel(
    opts.markerPx,
    text,
    opts.screenUnrotateDeg
  );
  return {
    faceStamp: undefined,
    circleLabel: text,
    layoutLabel: text,
    fontSizePx: layout.fontSizePx,
    spanStyle: layout.spanStyle,
    showNameBelow: opts.dancerLabelBelow,
  };
}
