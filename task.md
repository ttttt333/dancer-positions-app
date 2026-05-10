# タスク: スマホ横向きUI修正

## 修正内容
1. 舞台設定ボタン連動 → StageAreaSettingsDialogをモバイルreturnにも追加
2. キュー設定ボタン連動 → cueListModalDialogをモバイルreturnにも追加 + onOpenCueListModal常に渡す
3. キュー設定ボタンバグ修正 → EditorStageWorkbench.tsx line638
4. 右パネル折り畳みボタン → MobileEditorShell.tsx

## 実装戦略
- cueListModalDialogEl: inline変数に切り出し（line2997付近に追加）
- stageAreaSettingsDialogEl: inline変数に切り出し（line2997付近に追加）
- PC版return内のインラインJSXを変数参照に置換
- mobileStackEditor returnに変数を追加

## 進捗
- [ ] DesktopEditor.tsx: cueListModalDialogEl変数作成
- [ ] DesktopEditor.tsx: stageAreaSettingsDialogEl変数作成  
- [ ] DesktopEditor.tsx: mobileReturnに変数追加
- [ ] DesktopEditor.tsx: onOpenCueListModal常に渡す
- [ ] EditorStageWorkbench.tsx: キュー設定ボタンバグ修正
- [ ] MobileEditorShell.tsx: 折り畳みボタン追加

## ファイル
- src/pages/DesktopEditor.tsx (6012行)
- src/components/EditorStageWorkbench.tsx
- src/components/mobile/MobileEditorShell.tsx

## キーライン
- cueListModalJSX: PC return内 line4777〜4856
- stageAreaSettingsJSX: PC return内 line4859〜5266
- mobileStackEditor return: line3395〜3432
- onOpenCueListModal: line3329
- キュー設定ボタンバグ: EditorStageWorkbench.tsx line643
