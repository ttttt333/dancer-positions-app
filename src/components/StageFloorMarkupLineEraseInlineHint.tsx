export type StageFloorMarkupLineEraseTool = "line" | "erase";

/** 線／消しゴムツールの短い操作説明（ツールバー直下の 1 行用） */
export function StageFloorMarkupLineEraseInlineHint({
  tool,
}: {
  tool: StageFloorMarkupLineEraseTool;
}) {
  return (
    <div
      style={{
        fontSize: "10px",
        lineHeight: 1.35,
        color: "#94a3b8",
      }}
    >
      {tool === "line" && "床で押したまま動かして線を描きます"}
      {tool === "erase" && "削除したいメモや線をタップ"}
    </div>
  );
}
