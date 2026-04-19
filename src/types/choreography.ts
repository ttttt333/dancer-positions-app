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

/**
 * 変形舞台のプリセット id。UI・保存・描画の識別子。
 *
 * 多角形（polygon）はメイン床（長方形）を [0,0]-[100,100] の % 座標として
 * 生成する。原点 (0,0) は描画上の「奥・左」、(100,100) は「手前・右」。
 * 客席方向 (audienceEdge) による回転は親コンテナ側で行うため、本プリセットは
 * 常に「下が客席・上が奥」のフォーマットで正規化される。
 */
export type StageShapePresetId =
  | "rectangle"
  | "hanamichi_front"
  | "apron_front"
  | "thrust"
  | "t_stage"
  | "trapezoid_narrow_back"
  | "trapezoid_narrow_front"
  | "hexagon"
  | "diamond"
  | "rounded"
  | "oval"
  | "corner_cut_fl"
  | "corner_cut_fr"
  | "custom";

/**
 * 変形舞台（カスタム舞台形状）。
 *
 * `polygonPct` はメイン床の % 座標で表現された **閉じた多角形**。重複点は不要。
 * `params` にはプリセット再計算用の調整値（奥行・幅など）を保存する。
 * `kind: "custom"` のときは `polygonPct` を直接ユーザが編集できる将来拡張。
 */
export type StageShape = {
  presetId: StageShapePresetId;
  polygonPct: [number, number][];
  params?: Record<string, number>;
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
  /** 花道（客席側の細長ゾーン）を表示（§8・旧仕様。stageShape 未設定時のみ使う） */
  hanamichiEnabled?: boolean;
  /** メイン＋花道の箱に対する花道の高さの割合（8〜36 程度） */
  hanamichiDepthPct?: number;
  /**
   * 変形舞台（カスタム舞台形状）。
   *
   * メイン床（ダンサーを配置できる長方形）を基準に、%座標の多角形で
   * 「実際の舞台エリア」を示す。ダンサーの座標計算自体は長方形のまま変えず、
   * 多角形の外側はステージ上で淡く暗くして「舞台外」として可視化する。
   *
   * 未設定（undefined）のときは長方形扱い。旧来の `hanamichiEnabled` が
   * true だった場合はそちらが優先される（後方互換）。
   */
  stageShape?: StageShape;
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
  /**
   * スナップグリッドの間隔を実寸（mm）で指定。
   *
   * `stageWidthMm` と合わせて実効的な `gridStep`（%）を動的に算出するため、
   * 値がセットされているときはこちらが優先される。
   * 例: 1500 → 1.5 m 間隔。未指定（undefined）のときは従来の `gridStep`（%）を使う。
   */
  gridSpacingMm?: number;
  /**
   * 場ミリ規格＝隣同士のダンサー間隔（mm）。流派ごとの並べ方ルール。
   *
   * 値がセットされていてかつ `stageWidthMm` も設定されているとき、
   * 「＋ダンサー」「フォーメーション案」「ドラッグ吸着」「規格ドット表示」が
   * この間隔を基準に動作する。偶数人はセンターを「割って」 ±spacing/2 から並べ、
   * 奇数人は 1 人をセンターに乗せて ±spacing で並べる（自動）。
   * 例: 1500 → 1.5 m 間隔（割センター 75 cm）。
   * 未指定（undefined）のときは従来の % ベース挙動。
   */
  dancerSpacingMm?: number;
  /** ステージ上のダンサー印（円）の直径（px）。全ダンサー共通の既定 */
  dancerMarkerDiameterPx: number;
  /**
   * ダンサー印の直径を実寸（mm）で指定。
   *
   * 値がセットされているときは `stageWidthMm` と実際の描画幅からピクセル径を
   * 動的に計算し、`dancerMarkerDiameterPx` より優先される。
   * 例: 500 → 50 cm。未指定（undefined）のときは従来の px 値を使う。
   */
  dancerMarkerDiameterMm?: number;
  /**
   * ダンサー印（○）に対する名前の表示位置。
   * - "inside" : ○の中に名前を表示（既定。狭い盤面でもまとまる）
   * - "below"  : ○の下に名前を表示（人物が視認しやすい・色印を活かしたい場合）
   */
  dancerLabelPosition?: "inside" | "below";
  viewMode: "edit" | "view";
  crews: Crew[];
  /** サーバに保存した楽曲アセット ID（未ログイン時は null） */
  audioAssetId: number | null;
  /** 波形の縦スケール（§3）。1＝既定、大きいほど振幅を強調 */
  waveformAmplitudeScale?: number;
};
