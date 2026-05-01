import type { Dispatch, SetStateAction } from "react";
import type {
  ChoreographyProjectJson,
  DancerSpot,
  FloorTextPlaceSession,
  SetPiece,
  StageFloorMarkup,
} from "../types/choreography";

/** 床にコメント／線を描く／消すツール。未選択は `null`。 */
export type StageFloorMarkupTool = null | "text" | "line" | "erase";

export type StageBoardBodyProps = {
  project: ChoreographyProjectJson;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  playbackDancers: DancerSpot[] | null;
  /**
   * 一時停止時など、再生補間より優先して見せるフォーメーション（ページめくり閲覧用）。
   * 再生中は親が null にする想定。
   */
  browseFormationDancers?: DancerSpot[] | null;
  /** キュー追加ウィザード等のプレビュー（最優先で表示・ドラッグ不可） */
  previewDancers?: DancerSpot[] | null;
  /**
   * 再生補間表示中はダンサーがクリック不可のため、ステージ（客席帯以外）をクリックしたときに
   * 親で「選択中フォーメーションのドラッグ調整」へ切り替える。
   */
  onRequestLayoutEditFromStage?: () => void;
  /** 立ち位置の書き込み先。未指定なら project.activeFormationId */
  editFormationId?: string | null;
  /** false のときダンサー操作不可（キュー未選択など） */
  stageInteractionsEnabled?: boolean;
  /** 再生中の補間済み大道具（親が計算） */
  playbackSetPieces?: SetPiece[] | null;
  /** 一時停止時の大道具（親が計算） */
  browseSetPieces?: SetPiece[] | null;
  /** 再生中の床マーク（親が計算） */
  playbackFloorMarkup?: StageFloorMarkup[] | null;
  /** 閲覧時の床マーク（親が計算） */
  browseFloorMarkup?: StageFloorMarkup[] | null;
  /** 床テキストを置くウィザード中（プレビュー座標・本文は親が保持） */
  floorTextPlaceSession?: FloorTextPlaceSession | null;
  onFloorTextPlaceSessionChange?: (next: FloorTextPlaceSession) => void;
  /**
   * 編集画面全体に重ねるテキスト（screen レイヤー）と配置プレビューの基準 DOM（`position: relative`）。
   * 未指定時は画面テキストは描画されず、プレビューはステージ上にのみ出ます。
   */
  viewportTextOverlayRoot?: HTMLElement | null;
  /** 親と共有する床マークアップツール（未指定なら内部 state） */
  floorMarkupTool?: StageFloorMarkupTool;
  onFloorMarkupToolChange?: Dispatch<SetStateAction<StageFloorMarkupTool>>;
  /** true のときステージ左上のテキスト／線トグル帯を出さず、編集 UI のみ出す */
  hideFloorMarkupFloatingToolbars?: boolean;
  /** 立ち位置ドラッグ中は履歴に積まず、離したとき 1 手にまとめる（親の undo 用） */
  onGestureHistoryBegin?: () => void;
  onGestureHistoryEnd?: () => void;
  /** フォーメーション切替などドラッグ中断時に深度だけリセット */
  onGestureHistoryCancel?: () => void;
  /** ゴミ箱ドロップ直後の 1 回だけ、次の setProject で undo に積まない */
  markHistorySkipNextPush?: () => void;
  /**
   * 生徒向け閲覧: 1 人を大きく強調し、他を薄くする。未指定は全員同じ濃さ。
   */
  studentViewerFocus?:
    | null
    | { kind: "all" }
    | { kind: "one"; crewMemberId: string; label: string };
};
