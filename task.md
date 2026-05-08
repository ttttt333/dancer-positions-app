# テキスト機能追加 task

## 要件
1. **リアルタイムプレビュー** — `floorMarkupTool==="text"` で入力中、`floorTextDraft.body` をステージ上にプレビュー表示（既存 FloorTextPlacePreview 的な ghost）
2. **複数テキスト一括選択→ドラッグ移動** — 複数テキストをまとめて選択し、一括でドラッグ移動
3. **左端ゴミ箱** — 既存 TrashDropStripPortal はダンサー/テキストドラッグ時のみ表示。複数テキスト選択ドラッグ時も表示されるようにする

## 実装方針

### 1. リアルタイムプレビュー
- `floorMarkupTool === "text"` かつ `!floorTextEditId` のとき（新規入力モード）
- `floorTextDraft.body` が空でなければステージ中央 or マウス位置にプレビュー表示
- 既存 `FloorTextPlacePreview` コンポーネントを流用するか、軽量な ghost div を追加
- プレビューはクリックで配置（既存の空床クリック配置フローに乗る）
- `StageFloorStageMarkupOverlay` か `StageBoardScreenOverlay` にゴーストを追加

**実装場所**: `StageFloorStageMarkupOverlay.tsx` と `StageBoardScreenOverlay.tsx`
- `floorMarkupTool==="text" && !floorTextEditId && floorTextDraft.body.trim()` のとき
- `floorTextDraft` を props で渡してゴースト表示

### 2. 複数テキスト一括選択
- `selectedFloorTextIds: Set<string>` を新規 state として追加（StageBoardBody）
- Shift+クリックで複数選択
- 選択済みテキストをドラッグすると全員が同じ delta で移動
- ゴミ箱ドロップで全員削除

### 3. ゴミ箱（既存拡張）
- 複数テキスト選択ドラッグ中も `trashUiVisible` を true にする

## 作業順序
1. リアルタイムプレビュー（最も独立してシンプル）
2. 複数選択+移動
3. ゴミ箱連携

## ファイル
- `StageBoardBody.tsx` — state 追加、ドラッグロジック拡張
- `StageFloorStageMarkupOverlay.tsx` — ゴーストプレビュー追加
- `StageBoardScreenOverlay.tsx` — 同上（screen layer 用）
- `stageBoardTypes.ts` — props 型拡張
- `FloorTextMarkupBlock.tsx` — 複数選択スタイル
