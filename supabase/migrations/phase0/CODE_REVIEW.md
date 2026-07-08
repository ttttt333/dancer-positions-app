# Phase 0 SQL コードレビュー（001〜007）

**日付**: 2026-07-08  
**対象**: `supabase/migrations/phase0/*.up.sql`  
**方針**: 設計凍結後は**成果物レビュー**（ADR を満たす実装か）。

---

## Review Verdict（全レビュー共通）

| 判定 | 意味 | 次のアクション |
|------|------|----------------|
| **GO** | 品質ゲート通過 | 次フェーズへ進行 |
| **GO（軽微な改善推奨）** | リリースを止める問題なし。改善は別 PR 可 | 改善項目を Issue 化し、次へ進行 |
| **NO-GO** | 品質・保守性・互換性に問題あり | 修正後に再レビュー |
| **BLOCKER** | データ損失・権限・セキュリティ等の重大問題 | 本番適用禁止、修正必須 |

## レビュー観点（毎回明示）

| 観点 | 確認内容 |
|------|----------|
| **Architecture** | ADR-002.4 の設計を逸脱していないか |
| **Implementation** | コード品質、責務分離、エラー処理、テスト容易性 |
| **Quality Gate** | Validation、Regression、Smoke、Performance |
| **Production Readiness** | ロールバック、運用性、監視、障害対応 |

## Phase 0 レビュー開始時に必要な成果物

1. `001`〜`007` の適用ログ（成功・失敗を含む）
2. `choreocore_validate_audio_migration()` の結果
3. Regression Test の結果
4. Smoke Test の結果
5. ロールバック検証結果（実施した場合）

→ **Implementation Review** + **Quality Gate Review** を実施し、上記 Verdict を判定する。

---

## Phase 0 — Implementation Review 観点

- マイグレーション SQL の安全性（up/down、冪等性、ロールバック）
- RLS 関数・RPC の責務分離（Facade パターン）
- トランザクション整合性
- `SECURITY DEFINER` / `search_path` の安全性
- インデックス・FK・制約の妥当性

## Phase 0 — Quality Gate Review 観点

- `choreocore_validate_audio_migration()` の結果（**error = 0**）
- Regression Test 合格
- Smoke Test 合格
- ロールバック検証済み
- パフォーマンス上の重大な問題なし

## Phase 2 — RLS Review 観点（予定）

- 既存ユーザーへの互換性
- レガシー OR 条件が設計どおり
- 権限昇格・情報漏えい経路なし
- Storage SELECT / INSERT / UPDATE / DELETE が期待どおり

## Phase 3 — Implementation Review 観点（予定）

- AudioService に Storage アクセスが集約
- 新規コードに `storage.from()` 直叩きなし
- Edge Function → RPC の責務分離
- `USE_AUDIO_REGISTRY` の切替・ロールバック
- エラー処理・リトライ・ログ

---

## 初回レビュー結果（001〜007 静的レビュー）

## 総合判定

| 観点 | 評価 | コメント |
|------|------|----------|
| トランザクション | ✅ 合格 | RPC で Asset→Version→Project を単一 TX |
| ロールバック性 | ✅ 合格 | 001〜007 それぞれ down あり |
| SECURITY DEFINER | ✅ 合格（修正済） | 全 DEFINER 関数に `SET search_path = public` |
| RLS | ⚠️ 軽微指摘 | 既存ポリシーとの OR 冗長・性能（Phase 0 は許容） |
| 既存ユーザー影響 | ✅ 合格 | Storage / JSON 未変更 |
| 本番適用 | **条件付き GO** | 下記「修正済み」「適用後確認」を実施後 |

---

## 001_audio_core_tables

### 良い点

- `storage_path` を versions のみに集約（ADR-002.1 準拠）。
- `checksum` は `(owner_user_id, checksum_sha256)` 部分インデックスのみ（UNIQUE なし）。
- FK の鶏卵問題を `assets` → `versions` → `assets.current_version_id FK` の順で解決。

### 指摘と対応

| 重要度 | 指摘 | 対応 |
|--------|------|------|
| 低 | トリガー関数に `search_path` 未設定 | ✅ `001` に `SET search_path = public` 追加 |
| 情報 | `status=active` かつ `current_version_id IS NULL` を DB 制約で防いでいない | Phase 1 バックフィル後に検討。`007` で検出 |

---

## 002_projects_audio_link

### 良い点

- `current_audio_asset_id` は nullable（アップロード中の NULL 期間を許容）。
- `ON DELETE SET NULL` で asset 削除時に project が壊れない。

### 指摘

| 重要度 | 指摘 | 対応 |
|--------|------|------|
| なし | — | — |

---

## 003_project_members

### 良い点

- 既存 owner のバックフィルが `ON CONFLICT DO NOTHING` で冪等。
- 暗黙 owner（`projects.user_id`）と明示メンバーの二重管理を `choreocore_project_role` で統合。

### 指摘

| 重要度 | 指摘 | 対応 |
|--------|------|------|
| 低 | `manage` ポリシーが `FOR ALL` で INSERT/UPDATE/DELETE すべて owner 限定 | 意図どおり。editor 招待は Phase 4 で RPC 化を推奨 |

---

## 004_analysis_jobs

### 良い点

- ジョブのみ。`result_json` を持たない（ADR-002.1）。

### 指摘

| 重要度 | 指摘 | 対応 |
|--------|------|------|
| 情報 | INSERT ポリシーが `current_audio_asset_id` 経由の project 紐づけを要求 | Phase 0 では AI 未使用のため問題なし |

---

## 005_rls_functions

### 良い点

- 4 関数 + `can_access_storage` に分割（200 行超を回避）。
- 全 `SECURITY DEFINER` に `SET search_path = public`。
- レガシー OR 条件 (2)〜(5) を `can_access_storage` に集約（Phase 2 用）。

### 指摘

| 重要度 | 指摘 | 対応 |
|--------|------|------|
| 低 | RLS ポリシー内で `choreocore_project_id_for_audio_asset()` を複数回呼ぶ | Phase 0 は許容。必要なら STABLE 関数の結果をサブクエリで 1 回に |
| 低 | 既存 `choreocore_projects select own` と新 `select member` が OR で冗長 | 既存維持のため意図的。削除は Phase 8 |
| 情報 | Phase 0 では `can_access_storage` は Storage ポリシー未適用 | Phase 2 で適用。現状は定義のみ |

---

## 006_register_audio_rpc

### 良い点（ADR-002.3 反映後）

- **Facade パターン**: 内部 4 関数 + 公開 2 関数（`register_project_audio`, `touch_audio_access`）。
- `choreocore_assert_checksum_sha256`: 64 文字 hex 必須。NULL 大量発生を防止。
- `register_audio_version`: asset 行 `FOR UPDATE` で version_no 衝突を防止。
- 内部関数は `REVOKE ALL FROM PUBLIC`（authenticated から直接呼べない）。

### 関数一覧

| 関数 | 公開 | 役割 |
|------|------|------|
| `choreocore_assert_checksum_sha256` | 内部 | checksum 検証 |
| `choreocore_register_audio_asset` | 内部 | asset 作成 |
| `choreocore_register_audio_version` | 内部 | version 作成 + current 更新 |
| `choreocore_bind_project_audio` | 内部 | project 紐づけ |
| `choreocore_find_reusable_audio_asset` | 内部 | 同一 owner dedup |
| `choreocore_register_project_audio` | **公開** | Facade |
| `choreocore_touch_audio_access` | **公開** | LRU 更新（5 分スロットル） |

### 指摘

| 重要度 | 指摘 | 対応 |
|--------|------|------|
| 情報 | Edge Function 未実装の間は RPC を直接呼べない | Phase 3 で `audio-upload-complete` EF を追加 |
| 情報 | `checksum` DB 列は nullable（レガシーバックフィル用） | validation #15 で warn |

---

## 007_validation

### 良い点

- error / warn / info の 3 段階（**16 項目**、ADR-002.3 で +6）。
- `json_path_registry_mismatch` は移行期 warn（厳しすぎない）。
- `duplicate_owner_checksum_active`, `project_points_deleted_asset` 等を追加。

### 追加チェック（ADR-002.3）

| check_id | 内容 |
|----------|------|
| `current_version_missing_row` | current_version が幽霊参照 |
| `orphan_version_rows` | FK 破損検出 |
| `project_points_deleted_asset` | deleted asset 参照 |
| `duplicate_owner_checksum_active` | dedup 異常 |
| `active_asset_null_checksum` | RPC 未経由の active asset |
| `active_assets_without_versions` | version 未作成 asset |

### 使い方

```sql
select * from public.choreocore_validate_audio_migration() order by check_id;
```

**合格基準**: `severity = 'error'` が 0 件。

---

## 適用手順（推奨）

1. ステージングで `001.up` → `007.up` を順に実行
2. `choreocore_validate_audio_migration()` を実行（error 0）
3. Regression Test チェックリスト（README）の S1, L1, H1 を手動確認
4. 問題なければ本番へ同手順
5. 本番適用後も `007` を再実行して記録

## ロールバック手順

本番で問題が出た場合: `007.down` → … → `001.down` の逆順。  
`choreocore_projects.json` と Storage オブジェクトは Phase 0 では変更されないため、ロールバック後も既存アプリは動作する。

---

## 差分サマリー（ADR-002.3）

1. `006`: Facade + 5 内部関数に分割
2. `006`: checksum 必須（`assert_checksum_sha256`）
3. `006`: version 採番に `FOR UPDATE`
4. `007`: validation 16 項目に拡張
5. `README`: AudioService / `previous_audio_asset_id` 設計メモ

**総合判定（静的レビュー）**: **GO（軽微な改善推奨）** — ADR-002.3 反映済み。ステージング適用後に Quality Gate で最終 GO / NO-GO を判定。

設計フェーズは終了。以降は**実装成果物**（SQL 適用結果・Validation・Regression・Smoke・PR 差分）をレビュー対象とする。
