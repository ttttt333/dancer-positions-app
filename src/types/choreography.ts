export type AudienceEdge = "top" | "bottom" | "left" | "right";

export type DancerSpot = {
  id: string;
  label: string;
  xPct: number;
  yPct: number;
  colorIndex: number;
  /** メンバー名簿のメンバー id（反映時のみ。ステージで名前変更と名簿を同期） */
  crewMemberId?: string;
  /** ダンサー単位メモ（§11） */
  note?: string;
  /**
   * このダンサーだけに上書きする印の直径（px）。
   * 未指定時はプロジェクト共通の `dancerMarkerDiameterPx` を使う。
   */
  sizePx?: number;
};

/** 大道具（ChoreoGrid §9）。バウンディングボックス内の図形。 */
export type SetPieceKind = "rect" | "ellipse" | "triangle";

export type SetPiece = {
  id: string;
  kind: SetPieceKind;
  label?: string;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  /** 塗り色（#rrggbb）。未指定の旧データは表示側でスレート系の既定色 */
  fillColor?: string;
  /** true のときキュー間ギャップで座標を線形補間（§4） */
  interpolateInGaps?: boolean;
};

export type Formation = {
  id: string;
  name: string;
  dancers: DancerSpot[];
  /** 大道具（フォーメーションスナップショットに含める） */
  setPieces?: SetPiece[];
  /** ダンサー向けメモ（フォーメーション単位） */
  note?: string;
  /** 「この人数で確定」したあと、プリセット適用の基準人数 */
  confirmedDancerCount?: number;
};

export type CrewMember = {
  id: string;
  label: string;
  colorIndex: number;
};

export type Crew = {
  id: string;
  name: string;
  members: CrewMember[];
};

/** タイムライン上の区間キュー（区間内は立ち位置一定。区間の隙間のみ補間）。 */
export type Cue = {
  id: string;
  /** 区間開始（秒・ソース音源上） */
  tStartSec: number;
  /** 区間終了（秒）。tStartSec < tEndSec */
  tEndSec: number;
  formationId: string;
  /** 一覧・識別用の短い名前（任意） */
  name?: string;
  note?: string;
};

/** キュー追加ウィザード等で再利用する、名前付きの立ち位置スナップショット */
export type SavedSpotLayout = {
  id: string;
  name: string;
  /** 保存時の人数（表示・参考用） */
  savedAtCount: number;
  dancers: DancerSpot[];
};

export type ChoreographyProjectJson = {
  /** 3 = ChoreoGrid 区間キュー（tStart/tEnd）。2 も読み込み時に正規化で 3 相当に変換。 */
  version: 2 | 3;
  pieceTitle: string;
  /** 作品の想定人数（メモ・共有用。フォーメーション編集ロジックとは独立） */
  pieceDancerCount: number | null;
  audienceEdge: AudienceEdge;
  stageWidthMm: number | null;
  stageDepthMm: number | null;
  /** サイドステージ・バックステージ寸法（mm、任意） */
  sideStageMm: number | null;
  backStageMm: number | null;
  /**
   * センターからの「場ミリ」＝縦ガイドの間隔（mm）。メイン幅に対しセンターから等間隔で
   * 袖（左右端）まで点線を引く。未設定ならガイドなし。
   */
  centerFieldGuideIntervalMm: number | null;
  /** 花道（客席側の細長ゾーン）を表示（§8） */
  hanamichiEnabled?: boolean;
  /** メイン＋花道の箱に対する花道の高さの割合（8〜36 程度） */
  hanamichiDepthPct?: number;
  formations: Formation[];
  /** ユーザーが保存した立ち位置（プロジェクトに永続化） */
  savedSpotLayouts: SavedSpotLayout[];
  activeFormationId: string;
  cues: Cue[];
  playbackRate: number;
  trimStartSec: number;
  trimEndSec: number | null;
  snapGrid: boolean;
  gridStep: number;
  /** ステージ上のダンサー印（円）の直径（px）。全ダンサー共通の既定 */
  dancerMarkerDiameterPx: number;
  viewMode: "edit" | "view";
  crews: Crew[];
  /** サーバに保存した楽曲アセット ID（未ログイン時は null） */
  audioAssetId: number | null;
  /** 波形の縦スケール（§3）。1＝既定、大きいほど振幅を強調 */
  waveformAmplitudeScale?: number;
};
