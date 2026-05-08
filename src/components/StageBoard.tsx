/**
 * @file ステージボード公開 API（barrel）。`StageBoard` は `StageBoardBody` のエイリアス。
 * 型は `stageBoardTypes` と配下コンポーネントから再エクスポート。組み立ての流れは `StageBoardBody` 先頭 JSDoc。
 */
export { StageBoardBody as StageBoard } from "./StageBoardBody";
export { StageBoardPreviewFormationBanner } from "./StageBoardPreviewFormationBanner";
export type {
  StageBoardBodyOverlaysProps,
  BuildStageBoardExportColumnInput,
  BuildStageBoardMainFloorParams,
  StageBoardBodyProps,
  StageBoardFloorTextInlineRect,
  StageBoardLayoutSlots,
  StageFloorMarkupTool,
} from "./stageBoardTypes";
export type { FloorTextPlaceSession } from "../types/choreography";
export type {
  StageBoardContextMenuLayerProps,
  StageBoardContextMenuState,
} from "./StageBoardContextMenuLayer";
export type { StageBoardBulkToolbarSlotProps } from "./StageBoardBulkToolbarSlot";
export type { StageBoardShellProps } from "./StageBoardShell";
export type { StageBoardLayoutProps } from "./StageBoardLayout";
export type { StageBoardStageFrameProps } from "./StageBoardStageFrame";
export type { StageBoardMainColumnProps } from "./StageBoardMainColumn";
export type { StageBoardPreviewFormationBannerProps } from "./StageBoardPreviewFormationBanner";
export type {
  StageBoardScreenMarkupSharedProps,
  StageBoardScreenOverlayProps,
} from "./StageBoardScreenOverlay";
export type { StageBoardLayoutAfterDraftBundle } from "../hooks/useStageBoardLayoutAfterDraft";
