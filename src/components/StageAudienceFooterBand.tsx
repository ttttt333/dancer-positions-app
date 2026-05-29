import type { CSSProperties } from "react";

export type StageAudienceFooterBandProps = {
  guideLineMarks: readonly { xp: number; k: number }[];
  centerFrontDotColor: string;
  centerFrontRingColor: string;
  audienceCaptionColor: string;
  /** 例: 客席帯の画面正立用 `transform`（親の `labelScreenKeepUpright`） */
  wrapperStyle?: CSSProperties;
};

/** 床ブロック下：センター前ドット・ガイド距離ラベル・「客席」見出し */
export function StageAudienceFooterBand({
  guideLineMarks,
  centerFrontDotColor,
  centerFrontRingColor,
  audienceCaptionColor,
  wrapperStyle,
}: StageAudienceFooterBandProps) {
  const hasGuideLabels = guideLineMarks.length > 0;
  const captionStyle: CSSProperties = {
    fontSize: "clamp(8px, 3.2cqw, 14px)",
    fontWeight: 700,
    color: audienceCaptionColor,
    textShadow:
      "0 0 3px rgba(15,23,42,0.95), 0 1px 1px rgba(0,0,0,0.75)",
    lineHeight: 1,
    fontFamily: "system-ui, sans-serif",
    whiteSpace: "nowrap",
  };
  return (
    <div
      className="stage-audience-footer-band"
      style={{
        flex: "0 0 auto",
        minHeight: hasGuideLabels ? 40 : 26,
        position: "relative",
        width: "100%",
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "center",
        gap: 4,
        paddingTop: 2,
        ...wrapperStyle,
      }}
    >
      <div
        aria-label="ステージ センター前"
        title="センター前（基準点・枠の外側）"
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: centerFrontDotColor,
          boxShadow: `0 0 0 1px ${centerFrontRingColor}`,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 4,
        }}
      />
      {hasGuideLabels ? (
        <div
          className="stage-audience-footer-band__labels"
          style={{
            position: "relative",
            height: 18,
            width: "100%",
          }}
        >
          {guideLineMarks.map(({ xp, k }, i) => {
            let transform = "translateX(-50%)";
            if (xp <= 1) transform = "translateX(0)";
            else if (xp >= 99) transform = "translateX(-100%)";
            return (
              <span
                key={`glabel-out-${i}-${k}-${xp}`}
                style={{
                  position: "absolute",
                  left: `${xp}%`,
                  top: 0,
                  transform,
                  fontSize: "clamp(8px, 3.2cqw, 14px)",
                  fontWeight: 700,
                  color: "#fef3c7",
                  textShadow:
                    "0 0 3px rgba(15,23,42,0.95), 0 1px 1px rgba(0,0,0,0.75)",
                  lineHeight: 1,
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {k}
              </span>
            );
          })}
          <span
            className="stage-audience-footer-band__caption-inline"
            style={{
              position: "absolute",
              left: "50%",
              top: 8,
              transform: "translateX(-50%)",
              ...captionStyle,
            }}
          >
            客席
          </span>
        </div>
      ) : null}
      <div
        className={
          hasGuideLabels
            ? "stage-audience-footer-band__caption-row"
            : "stage-audience-footer-band__caption-row stage-audience-footer-band__caption-row--solo"
        }
        style={{
          textAlign: "center",
          fontSize: "clamp(9px, 3.5cqw, 15px)",
          fontWeight: 600,
          color: audienceCaptionColor,
        }}
      >
        客席
      </div>
    </div>
  );
}
