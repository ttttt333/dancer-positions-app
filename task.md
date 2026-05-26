# Phase 2実装タスク

## 1. 動線矢印 (StageMotionArrowsOverlay.tsx)
- 新規コンポーネント: SVGでダンサーの移動経路を矢印表示
- アクティブフォーメーション → 次フォーメーションへの矢印
- StageBoardBody に `showMotionArrows?: boolean` propsを追加
- EditorPage に toggle ボタンを追加

## 2. 個人閲覧モード強化
- studentViewerFocus = "one" のとき、ハイライト対象のマーカーに:
  - 光るリング/パルスアニメ追加
  - 名前ラベルを常時大きく表示
  - 矢印（↓）で自分の位置を示す
- ChoreoStudentViewGate を更新

## 3. テンプレ150種 (+73種)
- formationLayouts.ts に新パターン追加:
  - 対角線バリエーション: diagonal_nw, diagonal_sw
  - 台形系: trapezoid_front, trapezoid_back
  - 五角形・六角形周り: pentagon, hexagon
  - L字・T字・E字・F字
  - 入れ子ひし形: nested_diamond
  - 対称クラスター系 x5
  - 3点フォーカス x3
  - 扇形バリエーション x5
  - フリースタイル多様系 x20
  - 舞台用具体フォーメーション x20

## 状態
- [ ] 動線矢印
- [ ] 個人閲覧強化
- [ ] テンプレ追加
