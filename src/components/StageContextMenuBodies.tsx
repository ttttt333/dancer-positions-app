import type { SetPiece } from "../types/choreography";
import { setPieceLayer } from "../lib/stageBoardModelHelpers";
import { btnSecondary } from "./stageButtonStyles";

export function StageContextMenuFloorTextBody({
  deleteDisabled,
  onDeleteText,
}: {
  deleteDisabled: boolean;
  onDeleteText: () => void;
}) {
  return (
    <>
      <div
        style={{
          fontSize: "9px",
          color: "#94a3b8",
          marginBottom: "6px",
          lineHeight: 1.35,
        }}
      >
        テキスト
      </div>
      <button
        type="button"
        disabled={deleteDisabled}
        style={{
          ...btnSecondary,
          width: "100%",
          borderColor: "#7f1d1d",
          color: "#fecaca",
          fontWeight: 600,
          fontSize: "11px",
          padding: "6px 8px",
        }}
        onClick={onDeleteText}
      >
        テキストを削除
      </button>
    </>
  );
}

export function StageContextMenuSetPieceBody({
  piece,
  layerButtonDisabled,
  onToggleLayer,
  onDelete,
}: {
  piece: SetPiece | undefined;
  layerButtonDisabled: boolean;
  onToggleLayer: () => void;
  onDelete: () => void;
}) {
  const layerToggleLabel =
    piece && setPieceLayer(piece) === "screen"
      ? "メイン床基準に切替"
      : "編集画面全体に表示";

  return (
    <>
      <button
        type="button"
        disabled={layerButtonDisabled}
        style={{
          ...btnSecondary,
          width: "100%",
          fontSize: "11px",
          padding: "6px 8px",
          marginBottom: "6px",
        }}
        onClick={onToggleLayer}
      >
        {layerToggleLabel}
      </button>
      <button
        type="button"
        style={{
          ...btnSecondary,
          width: "100%",
          borderColor: "#7f1d1d",
          color: "#fecaca",
          fontWeight: 600,
        }}
        onClick={onDelete}
      >
        削除
      </button>
    </>
  );
}
