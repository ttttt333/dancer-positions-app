# NeonIconPanel Button Wiring Task

## Goal
Wire all NeonIconPanel buttons to actual EditorPage functions, matching v2 behavior

## Button → Function Mapping

| NeonIconPanel Button | Current State | Correct Wiring |
|---|---|---|
| 舞台設定 | `onOpenStageShapePicker` (shape picker only) | `setStageAreaSettingsOpen(true)` — full stage settings |
| キュー設定 | `() => {}` (no-op) | `setAddCueDialogOpen(true)` — add/edit cue dialog |
| 立ち位置保存 | `setFlowLibraryOpen(true)` | Keep as is (library save) |
| テキスト | `() => {}` (no-op) | Toggle `floorMarkupTool` to "text" or null |
| 拡大 | `setStageZenFullscreen(true)` | Keep as is |
| 閲覧モード | Toggle viewMode | Keep as is |
| グリッド吸着 | `onToggleStageGridLines` (from shared props) | Keep as is |
| キュー一覧 | `() => {}` (no-op) | `setCueListModalOpen(true)` |
| 音源取込 | `() => {}` (no-op) | `openAudioImport` |
| ライブラリ | `setFlowLibraryOpen(true)` | Keep as is |
| +メンバー | inline addDancer | Keep as is (works) |
| 名簿取込 | `() => {}` (no-op) | `importCrewCsvFromStageToolbar` |
| メンバー表示 | `() => {}` (no-op) | Toggle roster strip / show members |
| 共有URL | `setShareLinksOpen(true)` | Keep as is |
| クラウド保存 | `setFlowLibraryOpen(true)` | Keep — or could be cloud save |
| エクスポート | `setExportDialogOpen(true)` (from shared props) | Keep as is |
| AI提案 | `() => {}` (no-op) | Can keep as alert/placeholder |
| 大道具 | `onOpenSetPiecePicker` (from shared props) | Keep as is |
| ヘルプ | `onOpenShortcutsHelp` (from shared props) | Keep as is |
| 元に戻す | `undo` | Keep as is |
| やり直す | `redo` | Keep as is |

## Fix Summary
1. 舞台設定: Change from shape picker to stage area settings
2. キュー設定: Wire to addCueDialogOpen  
3. テキスト: Wire to floorMarkupTool toggle
4. キュー一覧: Wire to cueListModalOpen
5. 音源取込: Wire to openAudioImport
6. 名簿取込: Wire to importCrewCsvFromStageToolbar
7. メンバー表示: Wire to roster strip toggle
8. AI提案: Show alert placeholder
