# タスク一覧（2026-05-08）

## 1. 大道具 — ステージ外どこでも配置可能
- 現状: clamp(xPct, 0, 100-wPct) で 0-100% に制限
- 対応: 制限を撤廃し -50% 〜 150% 程度まで自由配置
- ファイル: StageBoardBody.tsx (line 1848,1849,1906,1907)

## 2. 大道具の上に立ち位置をつけても隠れない
- 現状: SetPiece の z-index が立ち位置より上になっている可能性
- ファイル: StageBoardBody.tsx - SetPiece の描画順・zIndex を確認

## 3. キュー一覧ボタン → キュー設定パネル（修正）
- 現状: キュー一覧SideSheetはあるが「設定」になっていない
- 対応: SideSheetの中身をキュー設定（名前変更・削除・順番変更）に変更
- ファイル: EditorPage.tsx (4535-4635)

## 4. メンバー表示ボタン → 立ち位置メンバー名前確認・設定 SideSheet
- 現状: rosterHidesTimeline=trueにするだけで何も視覚的変化なし
- 対応: EditorSideSheet で名前・色・番号などを編集できるメンバーパネルを表示
- ファイル: EditorPage.tsx + 新規 DancerRosterSheet コンポーネント

## 5. 舞台変形カスタム — クリックで頂点追加
- 現状: sketchMode（なぞり）のみ、クリックで追加不可
- 対応: sketchMode オフの状態でSVGクリック → 最近辺に頂点挿入 or 末尾追加
- ファイル: StageShapePicker.tsx

## 6. AI提案 — 歌詞・曲情報・要望・タイムスタンプ指定入力
- 現状: 音楽解析のみで自動実行、入力UI なし
- 対応: 
  a) 歌詞テキスト入力欄
  b) 曲名・ジャンル・雰囲気など入力欄
  c) 演出要望（自由記述）
  d) タイムスタンプ別指定（秒数 + フォーメーション名）
  e) これらを suggest() に渡してEdge Functionのbodyに含める
- ファイル: AiSuggestDialog.tsx + useAiFormationSuggest.ts

## 優先順位
1 → 2 → 4 → 3 → 5 → 6（工数大きい順に後回し）
