import type { StageFloorMarkup } from "../types/choreography";

export type StageFloorLineMarkupSvgProps = {
  displayFloorMarkup: StageFloorMarkup[];
  floorLineDraft: [number, number][] | null;
  floorMarkupTool: null | "text" | "line" | "erase";
  setPiecesEditable: boolean;
  onRemoveLineById: (id: string) => void;
};

/** メイン床オーバーレイ内: 床ライン確定表示・消しゴムヒット・下書きポリライン */
export function StageFloorLineMarkupSvg({
  displayFloorMarkup,
  floorLineDraft,
  floorMarkupTool,
  setPiecesEditable,
  onRemoveLineById,
}: StageFloorLineMarkupSvgProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      {displayFloorMarkup.map((m) => {
        if (m.kind !== "line" || m.pointsPct.length < 2) return null;
        const pts = m.pointsPct.map(([x, y]) => `${x},${y}`).join(" ");
        const stroke = m.color ?? "#fbbf24";
        const w = m.widthPx ?? 3;
        return (
          <g key={m.id}>
            <polyline
              data-floor-markup="line"
              data-fmark-id={m.id}
              fill="none"
              stroke={stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              strokeWidth={w}
              points={pts}
              style={{ pointerEvents: "none" }}
            />
            {floorMarkupTool === "erase" && setPiecesEditable ? (
              <polyline
                fill="none"
                stroke="transparent"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                strokeWidth={22}
                points={pts}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemoveLineById(m.id);
                }}
              />
            ) : null}
          </g>
        );
      })}
      {floorLineDraft && floorLineDraft.length >= 2 ? (
        <polyline
          fill="none"
          stroke="rgba(251, 191, 36, 0.75)"
          strokeDasharray="1.2 1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          strokeWidth={3}
          points={floorLineDraft.map(([x, y]) => `${x},${y}`).join(" ")}
        />
      ) : null}
    </svg>
  );
}
