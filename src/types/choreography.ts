import type { DancerFaceStampId } from "../lib/dancerFaceStamp";
import type { DancerFigure3dId } from "../lib/dancerFigure3d";

export type { DancerFaceStampId, DancerFigure3dId };

/** 客席は画面の上辺または下辺のみ（旧 JSON の left/right は読み込み時に正規化される） */
export type AudienceEdge = "top" | "bottom";

/** 名簿パネルの並び替え（プロジェクトに保存し、畳んでも維持） */
export type RosterStripSortMode =
  | "import"
  | "height_desc"
  | "height_asc"
  | "grade"
  | "skill";

export type DancerSpot = {
  id: string;
  label: string;
  /**
   * 同名区別などで label 先頭に付けた苗字（読み）の 1 文字以上。
   * 名下表示ではこの部分だけ小さく上付きにする。未指定時は通常の label 表示。
   */
  labelPrefix?: string;
  /**
   * 名前を○の下に出すとき、○の中に表示する数字・略号（最大 3 文字）。
   * 未指定のときは、フォーメーション内の並びで 1 からの番号を表示する（見た目のみ）。
   */
  markerBadge?: string;
  /**
   * `centerDistance` のときは `markerBadge` より優先し、印の中心と現在のステージ幅から
   * センターまでの距離を毎回算出（5cm 刻みの整数 cm）。隣同士間隔を変えても表示が追従する。
   */
  markerBadgeSource?: "centerDistance";
  /**
   * 再生ギャップ補間時: ○内センター距離の算出 x（印の見た目 xPct とは別）。
   * 未指定時は xPct を使う。
   */
  centerDistanceLabelXPct?: number;
  xPct: number;
  yPct: number;
  /**
   * 印（と名前）の向き。0＝既定、時計回りに最大 359。
   * 座標 (xPct,yPct) は変えず、表示だけ回す。
   */
  facingDeg?: number;
  colorIndex: number;
  /** メンバー名簿のメンバー id（反映時のみ。ステージで名前変更と名簿を同期） */
  crewMemberId?: string;
  /** ダンサー単位メモ（§11） */
  note?: string;
  /**
   * 身長（cm）。ステージ上には表示しない。任意。
   */
  heightCm?: number;
  /**
   * 姿勢レベル（照明連動AI提案）。ステージ印の大きさで区別する。
   * stand=立ち / crouch=しゃがみ / sit=座り
   */
  poseLevel?: "stand" | "crouch" | "sit";
  /** 学年など（名簿未紐付け時も並び替え・再配置に使用） */
  gradeLabel?: string;
  /** 性別などの表示ラベル（名簿と同期可） */
  genderLabel?: string;
  /** スキルランク表示（名簿未紐付け時も並び替え・再配置に使用） */
  skillRankLabel?: string;
  /**
   * このダンサーだけに上書きする印の直径（px）。
   * 未指定時はプロジェクト共通の `dancerMarkerDiameterPx` を使う。
   */
  sizePx?: number;
  /**
   * 「名前は○の下」モードのとき、名下ラベルだけのフォントサイズ（px）。
   * 未指定時は○直径に連動した既定サイズ。
   */
  nameBelowFontPx?: number;
  /**
   * ○の中に出す LINE スタンプ風の表情。未指定／不正値はなし。
   * 設定時は○内の名前・番号の代わりに表情を描き、名前は○の下に出す。
   */
  faceStamp?: DancerFaceStampId;
  /**
   * 3D 表示のフィギュア種類（人型・犬・猫など）。未指定は人型。
   */
  figure3d?: DancerFigure3dId;
};

/** 大道具（ChoreoCore §9）。バウンディングボックス内の図形。 */
export type SetPieceKind = "rect" | "ellipse" | "triangle";

export type SetPiece = {
  id: string;
  kind: SetPieceKind;
  label?: string;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  /**
   * 座標の基準。省略または "stage" = メイン床の %。
   * `screen` = 編集画面（タイムライン列などを含むエディタ面）全体の %。
   */
  layer?: "stage" | "screen";
  /** 時計回りの回転（度）。省略時 0 */
  rotationDeg?: number;
  /** 塗り色（#rrggbb）。未指定の旧データは表示側でスレート系の既定色 */
  fillColor?: string;
  /** true のときキュー間ギャップで座標を線形補間（§4） */
  interpolateInGaps?: boolean;
};

/** ステージ床に重ねるテキストコメント（% 座標・フォーメーション単位） */
export type StageFloorTextMarkup = {
  id: string;
  kind: "text";
  /**
   * 座標の基準。省略または "stage" = 舞台床（従来）。`screen` = 編集画面全体（タイムライン列など含む）の矩形に対する %。
   */
  layer?: "stage" | "screen";
  xPct: number;
  yPct: number;
  text: string;
  /** #rrggbb */
  color?: string;
  fontSizePx?: number;
  /** CSS font-weight（300〜900） */
  fontWeight?: number;
  /** CSS font-family（未指定時は表示側の既定ゴシック） */
  fontFamily?: string;
  /** 表示スケール（1＝既定）。角ドラッグで変更 */
  scale?: number;
  /** 背景色（袋文字・ハイライト）。例: "rgba(0,0,0,0.55)" または "#rrggbb" */
  bgColor?: string;
  /** テキストをロックして誤移動を防ぐ */
  isLocked?: boolean;
  /** 回転角度（度）。0 = 水平 */
  rotation?: number;
};

/** ステージ床の手描き線（折れ線・% 座標） */
export type StageFloorLineMarkup = {
  id: string;
  kind: "line";
  /** 少なくとも 2 頂点 */
  pointsPct: [number, number][];
  color?: string;
  widthPx?: number;
};

export type StageFloorMarkup = StageFloorTextMarkup | StageFloorLineMarkup;

/**
 * ヘソと同じ見た目のセンターマーク（位置可変・複数可）。
 * メイン床上の %（0–100）。舞台設定中のみドラッグ。
 */
export type StageCenterMark = {
  id: string;
  xPct: number;
  yPct: number;
  label?: string;
};

/** そで幕の表示側 */
export type StageSleeveCurtainSide = "both" | "left" | "right";

/**
 * そで幕1枚分。客席側からの奥行で位置を決め、ステージ上でドラッグ調整できる。
 */
export type StageSleeveCurtain = {
  id: string;
  /** 客席側（手前）からの距離 mm */
  depthMm: number;
  label?: string;
  /** 左右どちらに出す。省略時 both */
  side?: StageSleeveCurtainSide;
  /**
   * 舞台端からメイン床側へ伸ばす長さ（mm）。0＝舞台端にぴったり。
   */
  insetMm?: number;
  /**
   * 舞台端からそでスペース側へ伸ばす長さ（mm）。
   * 未指定かつサイド寸法ありのときはサイド全幅。0＝舞台端で止まる。
   */
  wingExtentMm?: number;
};

/** ステージ照明の種類 */
export type StageLightKind =
  | "suspension"
  | "sideSpot"
  | "backlight"
  | "footlight"
  | "pinSpot";

/**
 * 舞台上の照明フィクスチャ。
 * 時間帯（tStart〜tEnd）内、または紐づくキューの区間内だけ色・濃さを床に重ねる。
 */
export type StageLightFixture = {
  id: string;
  kind: StageLightKind;
  label?: string;
  /** メイン床 %（0–100） */
  xPct: number;
  yPct: number;
  /** #rrggbb */
  color: string;
  /** 0〜1。床への色の濃さ */
  intensity: number;
  /**
   * ビーム横半径（メイン床幅に対する %）。未指定時は種類ごとの既定。
   * 互換のため radiusPct も同義で読む。
   */
  rxPct?: number;
  /**
   * ビーム縦半径（メイン床奥行に対する %）。
   * 未指定かつ shape=ellipse のときは rx の 0.72 倍。
   */
  ryPct?: number;
  /** @deprecated rxPct を使う。読み込み時に rxPct へ移行 */
  radiusPct?: number;
  /**
   * circle = 見た目の正円（舞台の縦横比を補正）。
   * ellipse = 縦横を独立に調整。
   */
  shape?: "circle" | "ellipse";
  /**
   * 紐づくキュー ID。未指定／null = 全体（全キュー共通）。
   * 指定時はそのキュー区間でのみ点灯（全体の tStart/tEnd は使わない）。
   */
  cueId?: string | null;
  /** 有効開始秒。null/省略 = 先頭から（全体スコープ時） */
  tStartSec?: number | null;
  /** 有効終了秒。null/省略 = 末尾まで（全体スコープ時） */
  tEndSec?: number | null;
  enabled?: boolean;
};

/** ヘッダ「テキスト」から床へ置く前のプレビュー（親が状態を持つ） */
export type FloorTextPlaceSession = {
  body: string;
  fontSizePx: number;
  fontWeight: number;
  xPct: number;
  yPct: number;
  color?: string;
  fontFamily?: string;
  /** 設置後の床テキスト scale（既定 1） */
  scale?: number;
  /** 保存先: このフォーメーションのみ or 全キュー共通 */
  scope?: "formation" | "global";
  /** 既存テキスト編集モード: このIDのテキストを更新する（undefined = 新規配置） */
  editTargetId?: string;
};

export type Formation = {
  id: string;
  name: string;
  dancers: DancerSpot[];
  /** 大道具（フォーメーションスナップショットに含める） */
  setPieces?: SetPiece[];
  /** 床に重ねるコメント・線（書き込み・エクスポート対象） */
  floorMarkup?: StageFloorMarkup[];
  /** ダンサー向けメモ（フォーメーション単位） */
  note?: string;
  /**
   * @deprecated 舞台寸法・形状はプロジェクト共通（全キュー連動）。
   * 読み込み時に除去される。形の箱テンプレ側の SavedSpotLayout.stageSnapshot とは別。
   */
  stageSnapshot?: SavedSpotStageSnapshot;
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
  /**
   * 同名区別などで label 先頭に付けた苗字（読み）。ステージ名下で小さく上付き表示する。
   */
  labelPrefix?: string;
  colorIndex: number;
  /** 身長（cm）。名簿取り込み・並び替え用 */
  heightCm?: number;
  /** 学年などの表示ラベル（例: 中2、高校1年） */
  gradeLabel?: string;
  /** 性別など（例: 男・女） */
  genderLabel?: string;
  /** ダンス等スキルランクの表示（例: A、上級） */
  skillRankLabel?: string;
  /** メンバー単位メモ（立ち位置の備考と同期する場合あり） */
  note?: string;
};

export type Crew = {
  id: string;
  name: string;
  members: CrewMember[];
};

/**
 * 直前のキュー終了〜このキュー開始のギャップでの立ち位置の寄り方。
 * 上手＝画面右（x が大きい方）、下手＝画面左。客席側＝y が大きい（手前）。
 */
export type GapApproachRoute =
  | "linear"
  | "kamite_half_via_audience"
  | "shimote_half_via_audience"
  | "kamite_half_via_upstage"
  | "shimote_half_via_upstage"
  | "front_half_via_kamite"
  | "front_half_via_shimote"
  | "detour_bulge";

/** タイムライン上の区間キュー（区間内は立ち位置ホールド。ギャップ／隣接時は補間移動）。 */
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
  /**
   * このキューに入る直前のギャップ（前キュー tEnd 〜 この tStart）での移動経路。
   * 先頭キューでは無視される。未指定は線形補間。
   * 隣接キュー（ギャップ無し）の場合も、前ホールド末尾の暗黙遷移で同じ経路が使われる。
   */
  gapApproachFromPrev?: GapApproachRoute;
  /**
   * このキューへ向かう移動に使う秒数（任意）。
   * 未指定時は BPM×8カウント相当を前ホールド末尾から自動切出し。
   * 明示ギャップが十分ある場合はギャップ全体が移動時間になり、この値は使わない。
   */
  moveInSec?: number;
  /**
   * ダンサーごとの個別軌道（二次ベジェ制御点）。
   * キー = dancerId、値 = 制御点のステージ座標（%）。
   * これが設定されているダンサーは gapApproachFromPrev より優先される。
   */
  dancerCustomPaths?: Record<string, { cpX: number; cpY: number }>;
};

/**
 * 立ち位置保存時に一緒に記録する舞台まわりの設定。
 * 適用時はプロジェクト側の同種フィールドを上書きする。
 */
export type SavedSpotStageSnapshot = {
  audienceEdge: AudienceEdge;
  stageWidthMm: number | null;
  stageDepthMm: number | null;
  sideStageMm: number | null;
  backStageMm: number | null;
  centerFieldGuideIntervalMm: number | null;
  hanamichiEnabled: boolean;
  hanamichiDepthPct: number;
  stageShape?: StageShape;
  gridSpacingMm?: number;
  gridStep: number;
  /** 互換のため残す。正規化後は常に false（スナップ UI 廃止） */
  snapGrid: boolean;
  /**
   * 旧: 縦横まとめて表示。未指定時は `stageGridLinesVerticalEnabled` /
   * `stageGridLinesHorizontalEnabled` の OR で推定。
   */
  stageGridLinesEnabled?: boolean;
  /** 幅方向（画面上の縦線）のグリッド線を表示 */
  stageGridLinesVerticalEnabled?: boolean;
  /** 奥行方向（画面上の横線）のグリッド線を表示 */
  stageGridLinesHorizontalEnabled?: boolean;
  /** 旧データ互換：縦線（幅方向）間隔と同じ意味で正規化時に維持 */
  stageGridLineSpacingMm?: number;
  /** 縦線（幅 mm 方向）の間隔 mm。1〜100 cm */
  stageGridSpacingWidthMm?: number;
  /** 横線（奥行 mm 方向）の間隔 mm。1〜100 cm */
  stageGridSpacingDepthMm?: number;
  dancerSpacingMm: number | null;
  dancerMarkerDiameterPx: number;
  dancerMarkerDiameterMm?: number;
  dancerLabelPosition?: "inside" | "below";
};

/** キュー追加ウィザード等で再利用する、名前付きの立ち位置スナップショット */
export type SavedSpotLayout = {
  id: string;
  name: string;
  /** 保存時の人数（表示・参考用） */
  savedAtCount: number;
  dancers: DancerSpot[];
  /** 保存時の舞台設定。未保存の旧データは undefined（適用時は現プロジェクトを維持） */
  stageSnapshot?: SavedSpotStageSnapshot;
};

export type ChoreographyProjectJson = {
  /** 3 = ChoreoCore 区間キュー（tStart/tEnd）。2 も読み込み時に正規化で 3 相当に変換。 */
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
  /**
   * 全キューを通して常時表示するステージテキスト・線（キュー固有 floorMarkup と重ねて表示）。
   * ステージ方向注記・タイトルなど「どのシーンでも出したい」ものを置く。
   */
  globalFloorMarkup?: StageFloorMarkup[];
  activeFormationId: string;
  cues: Cue[];
  playbackRate: number;
  trimStartSec: number;
  trimEndSec: number | null;
  snapGrid: boolean;
  gridStep: number;
  /**
   * ステージ上に実寸グリッド線を重ねて表示（幅・奥行 mm と線間隔が必要）。
   * 縦線のみ・横線のみは `stageGridLinesVerticalEnabled` /
   * `stageGridLinesHorizontalEnabled`。旧データの `stageGridLinesEnabled` から正規化。
   */
  stageGridLinesEnabled?: boolean;
  stageGridLinesVerticalEnabled?: boolean;
  stageGridLinesHorizontalEnabled?: boolean;
  /**
   * 旧単一値互換（mm）。正規化後は縦線間隔 `stageGridSpacingWidthMm` と同じ。
   * 表示・スナップは `stageGridSpacingWidthMm` / `stageGridSpacingDepthMm` を優先。
   */
  stageGridLineSpacingMm?: number;
  /** 縦に引く線の間隔＝ステージ幅方向の実寸（mm）。1〜100 cm */
  stageGridSpacingWidthMm?: number;
  /** 横に引く線の間隔＝ステージ奥行方向の実寸（mm）。1〜100 cm */
  stageGridSpacingDepthMm?: number;
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
  /**
   * ヘソ／センターマーク群を表示する。
   * 位置は `stageCenterMarks`。旧データで marks が空かつ true のときは中央 1 点を補う。
   */
  stageHesoVisible?: boolean;
  /**
   * ヘソと同じ見た目のセンターマーク（複数可）。メイン床 %（0–100）。
   * 舞台設定パネル表示中のみドラッグ移動可能（立ち位置編集を邪魔しない）。
   */
  stageCenterMarks?: StageCenterMark[];
  /**
   * @deprecated 奥行グリッド間隔 `stageGridSpacingDepthMm` に統合。読み込み時のみ互換。
   * 客席側（手前）からの距離で引く横グリッド線（mm）。
   */
  stageFrontGridLinesMm?: number[];
  /**
   * @deprecated `stageSleeveCurtains` に移行。読み込み時のみ互換。
   * そで幕の奥行位置（手前からの mm）。
   */
  stageSleeveCurtainDepthsMm?: number[];
  /**
   * そで幕（複数可）。ステージ上でドラッグして奥行を調整できる。
   */
  stageSleeveCurtains?: StageSleeveCurtain[];
  /**
   * ステージ照明フィクスチャ（テキスト／照明シートで編集）。
   * 時間帯内だけ床に色を重ねる。
   */
  stageLights?: StageLightFixture[];
  viewMode: "edit" | "view";
  crews: Crew[];
  /** サーバに保存した楽曲アセット ID（未ログイン時は null） */
  audioAssetId: number | null;
  /**
   * Supabase Storage のオブジェクトパス（バケット `choreocore-audio` 内の name）。
   * 設定時は `audioAssetId` と排他（従来 API 利用時は未使用）。
   */
  audioSupabasePath?: string | null;
  /**
   * フローライブラリから復元したローカル音源（IndexedDB `flowLibraryLocalAudio` のキー）。
   * サーバ `audioAssetId` より後段で、未設定のときだけ `<audio>` に反映する。
   */
  flowLocalAudioKey?: string | null;
  /** 波形の縦スケール（§3）。1＝既定、大きいほど振幅を強調 */
  waveformAmplitudeScale?: number;
  /**
   * タイムライン列の名簿ストリップを畳んで細いバーだけにする。
   * 未指定は展開表示（従来どおり）。
   */
  rosterStripCollapsed?: boolean;
  /**
   * true のとき右列は名簿ストリップのみ表示し、タイムライン（上部波形ドック含む）は隠す。
   * false / 未指定のときはタイムラインを表示し、名簿ストリップは出さない（「メンバーを表示」で true に戻す）。
   */
  rosterHidesTimeline?: boolean;
  /** 名簿の並び替えモード（未指定は取り込み順） */
  rosterStripSortMode?: RosterStripSortMode;
};
