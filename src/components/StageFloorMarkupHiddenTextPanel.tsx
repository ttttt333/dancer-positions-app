import type { Dispatch, SetStateAction } from "react";
import type { Formation } from "../types/choreography";
import { EMPTY_FLOOR_TEXT_DRAFT } from "../lib/stageBoardModelHelpers";
import { btnSecondary } from "./stageButtonStyles";
import {
  FloorTextDraftEditorForm,
  type FloorTextDraftShape,
} from "./FloorTextDraftEditorForm";
import type { FloorMarkupTool } from "./StageFloorMarkupFloatingToolbars";

type FloorTextInlineRectState = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
} | null;

export type StageFloorMarkupHiddenTextPanelProps = {
  floorTextEditId: string | null;
  setFloorTextEditId: Dispatch<SetStateAction<string | null>>;
  floorTextDraft: FloorTextDraftShape;
  setFloorTextDraft: Dispatch<SetStateAction<FloorTextDraftShape>>;
  updateActiveFormation: (updater: (f: Formation) => Formation) => void;
  setFloorMarkupTool: Dispatch<SetStateAction<FloorMarkupTool>>;
  setFloorTextInlineRect: Dispatch<SetStateAction<FloorTextInlineRectState>>;
};

/**
 * 外部ツールバー利用時（hideFloorMarkupFloatingToolbars）:
 * 床下に出す床テキスト下書きパネル。
 */
export function StageFloorMarkupHiddenTextPanel({
  floorTextEditId,
  setFloorTextEditId,
  floorTextDraft,
  setFloorTextDraft,
  updateActiveFormation,
  setFloorMarkupTool,
  setFloorTextInlineRect,
}: StageFloorMarkupHiddenTextPanelProps) {
  const handleDone = () => {
    setFloorMarkupTool(null);
    setFloorTextEditId(null);
    setFloorTextDraft({ ...EMPTY_FLOOR_TEXT_DRAFT });
    setFloorTextInlineRect(null);
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        bottom: 8,
        left: 8,
        right: 8,
        zIndex: 37,
        maxHeight: "42%",
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #334155",
        background: "rgba(15, 23, 42, 0.96)",
        boxShadow: "0 -4px 18px rgba(0,0,0,0.35)",
      }}
    >
      {floorTextEditId ? (
        <button
          type="button"
          title="選択を解除し、新しいテキストを置けるようにします"
          onClick={() => setFloorTextEditId(null)}
          style={{
            ...btnSecondary,
            padding: "4px 10px",
            fontSize: "11px",
            alignSelf: "flex-start",
          }}
        >
          新規へ
        </button>
      ) : null}
      <FloorTextDraftEditorForm
        draft={floorTextDraft}
        setDraft={setFloorTextDraft}
        floorTextEditId={floorTextEditId}
        updateActiveFormation={updateActiveFormation}
      />
      <button
        type="button"
        title="ツールを終了（Esc でも可）"
        onClick={handleDone}
        style={{
          ...btnSecondary,
          padding: "6px 12px",
          fontSize: "12px",
          alignSelf: "flex-end",
        }}
      >
        完了
      </button>
    </div>
  );
}
