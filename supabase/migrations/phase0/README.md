# Phase 0: 音源アセット基盤（ADR-002.4）

> **Design Freeze（2026-07-08）**  
> **ADR-002.4 を設計凍結。** 以降はバグ・運用課題・新要件（AI・共同編集等）が出た場合のみ ADR を更新し、それ以外は**実装・検証を優先**する。

## ADR Change Policy

ADR-002.4 は **Design Freeze** とする。

**ADR 更新を認める場合（のみ）**

- Production 障害
- Security 問題
- データ整合性の問題
- 新しいプロダクト要件
- Performance 上の重大課題

**それ以外**の改善（「もっときれいに」等）は **Implementation Issue** または **TODO** として管理し、ADR は増やさない。

既存アプリ・Storage RLS には触れず、テーブルと DB 関数のみ追加します。

---

## Architecture Decision History

設計の変遷を記録します。半年後に「なぜこうなっているか」を思い出すための履歴です。

### ADR-001 — フル設計（参照用・未採用の実装スコープ）

- **判断**: Project → Binding → Asset → Version → Storage の正規化モデルを策定。
- **含めたもの**: 7 テーブル、GC キュー、波形 DB、Storage Tier C、単一巨大 RLS 関数。
- **評価**: アーキテクチャ 10/10、ただし初回リリースにはオーバーエンジニアリング。
- **残した思想**: 段階移行（Phase 0→3）、レジストリ中心、レガシーパス OR 互換。

### ADR-002 — 最小構成へ縮小（採用）

- **判断**: 初回は 4 テーブル + `projects.current_audio_asset_id` のみ。
- **削除**: bindings テーブル、wave_peaks DB、GC キュー、Tier C パス。
- **維持**: Storage Tier A（`{uid}/{project}/{uuid}`）は変更しない。
- **RLS**: `can_access_storage` を 4 関数に分割。

### ADR-002.1 — CTO 修正版（現行の実装契約）

| 修正 | 内容 |
|------|------|
| SHA256 | UNIQUE なし。`(owner_user_id, checksum_sha256)` インデックスのみ。dedup は同一 owner 内 |
| 登録 | `choreocore_register_project_audio` RPC で Asset → Version → Project を 1 トランザクション |
| GC 補助 | `last_accessed_at` + `touch_audio_access`（5 分スロットル） |
| Version | `source` 列（upload / recording / import / ai / youtube / stem） |
| checksum 計算 | **クライアント非推奨**。Edge Function / バックエンドで計算（将来移行可能な設計） |

### ADR-002.2 — 本番適用前の追加（Phase 0 最終形）

- **007_validation**: 整合性チェック関数を追加。
- **SECURITY DEFINER**: 全関数に `SET search_path = public` を固定。
- **Regression Test**: Phase 1 前に手動 + 将来自動化するチェックリストを定義。

### ADR-002.3 — CTO 最終レビュー（95→100 点）

| 修正 | 内容 |
|------|------|
| RPC Facade | `register_audio_asset` / `register_audio_version` / `bind_project_audio` を分割。公開 API は `register_project_audio` のみ |
| checksum 必須 | `choreocore_assert_checksum_sha256`。Edge Function → RPC のみ。DB 列はバックフィル用に nullable 維持 |
| version 排他 | `register_audio_version` で asset 行 `FOR UPDATE` → `MAX(version_no)+1` |
| Validation +6 | orphan / deleted 参照 / duplicate checksum 等（計 16 項目） |
| **将来: Undo** | `projects.previous_audio_asset_id` を Phase 5 で追加予定（設計メモ） |
| **将来: AudioService** | アプリ層で Storage/RPC を一箇所に集約（下記） |

### ADR-002.4 — 運用品質（98〜99 点）— **FROZEN**

- **audio_events**: 監査ログテーブル（Phase 3 安定後）
- **RPC API v1**: 破壊的変更は `_v2` 新設
- **Edge Function**: Upload → SHA256 → RPC → Return の 4 ステップのみ
- **Feature Flag**: `USE_AUDIO_REGISTRY` で即ロールバック
- **Architecture Test**: Editor から直接 `storage.from()` 禁止（CI）

**ADR 更新トリガー（凍結後）**: バグ / 運用障害 / 新要件のみ。設計の磨き込みは行わない。

詳細は下記 **ADR-002.4 — 運用品質** セクション。

---

## レビュー運用（Design Freeze 後）

**設計レビュー（ADR）→ 実装レビュー（PR / 差分）**へ切替。  
テックリード / CTO は「設計の完成度」より**実装が ADR を守れているか**を確認する。

| レビュー | タイミング | 確認内容 |
|----------|------------|----------|
| **Architecture Review** | Phase 開始前 | ADR-002.4 逸脱なし。Storage 責務が AudioService に集約。`storage.from()` 直叩きなし |
| **Implementation Review** | PR ごと | RPC トランザクション整合。RLS 抜け道なし。エラー時ロールバック |
| **Quality Gate Review** | Phase 完了時 | Validation 全通過。Regression / Smoke / Performance 許容内 |
| **Production Readiness Review** | 本番前 | Feature Flag 即時ロールバック。ログ・監査・監視。障害復旧手順。Migration ロールバック検証済み |

```
Phase 開始 → Architecture Review
    ↓
実装・PR → Implementation Review（各 PR）
    ↓
Phase 完了 → Quality Gate Review
    ↓
本番リリース → Production Readiness Review
```

---

## Definition of Done（全 PR 共通）

各 Phase の **Exit Criteria** とは別に、**すべての PR** で満たす完了条件。Implementation Review の判断基準。

- [ ] ADR-002.4 に違反していない
- [ ] Migration がある場合、**up / down を両方検証済み**
- [ ] Validation に**新規 error が増えていない**
- [ ] Regression Test 合格
- [ ] 新規コードに **TODO / FIXME を残していない**（Issue 化する）
- [ ] Feature Flag **OFF** でも既存機能が動作する

---

## Quality Gate（全 Phase 共通）

Design Freeze 後は**新しい ADR より品質ゲートを優先**する。各 Phase 完了時に以下を順に通し、すべて ✅ で **GO**。

```
Phase 実装
    ↓
Validation（DB 整合性・error = 0）
    ↓
Regression Test（機能退行なし）
    ↓
Smoke Test（主要ユーザーフロー）
    ↓
Performance Check（必要時: 大容量音源・波形 upsert 遅延）
    ↓
GO → 次 Phase
```

**Phase 別の主レビュー**

| Phase | Architecture | Implementation | Quality Gate |
|-------|--------------|----------------|--------------|
| Phase 0 | ADR 逸脱なし | SQL diff | Validation + Regression |
| Phase 2 | RLS 方針 | ポリシー SQL | レガシーパス再生 |
| Phase 3 | AudioService 境界 | TS + EF + CI | Architecture Test + Flag |
| Phase 1 | バックフィル方針 | バッチ SQL | registry 整合 |
| Phase 4 | 共同編集権限 | 招待 UI / RPC | 同時保存 |

### Phase 3 — Implementation Review チェックリスト

**アーキテクチャ**

- [ ] Storage アクセスは **AudioService のみ**
- [ ] Editor / Hook から Storage API を**直接呼んでいない**
- [ ] Edge Function の責務が**増えていない**（Upload → SHA256 → RPC → Return）
- [ ] RPC 呼び出しは **Facade**（`register_project_audio`）経由のみ

**パフォーマンス**

- [ ] 同じ音源の**二重ダウンロード**なし
- [ ] WavePeaks **再取得の最小化**（サイドカー / IDB / Cache API）
- [ ] キャッシュヒット率を確認（2 回目以降の読み込み）
- [ ] 不要な再レンダリングなし（音源切替時の hook 依存）

**エラー処理**

- [ ] Upload 失敗時の**ロールバック**（孤立 Storage / 中途半端な JSON）
- [ ] RPC 失敗時の**整合性維持**（asset だけ作成され project 未更新、等）
- [ ] Feature Flag **OFF** で旧フローへ復帰
- [ ] タイムアウト・ネットワーク切断時の**復旧**（再試行 / ユーザー向けメッセージ）

---

## Exit Criteria（フェーズ完了条件）

### Phase 0 完了（GO 条件）

- [ ] `001`〜`007` をステージング（または本番）に適用成功
- [ ] `choreocore_validate_audio_migration()` で **severity = `error` が 0 件**
- [ ] Regression Test 全項目合格（下記チェックリスト）
- [ ] Smoke Test 合格（取り込み・再生・保存・共有）
- [ ] **ロールバック SQL**（`007.down` → `001.down`）をステージングで検証済み

### Phase 2 完了（Storage RLS 拡張）

- [ ] `choreocore_can_access_storage` を Storage ポリシーに適用
- [ ] レガシーパス（L1/L2/L3）で波形 `upsert` が RLS エラーなく完了
- [ ] 共有閲覧（H1）が引き続き動作

### Phase 3 完了（AudioService + Edge Function）

- [ ] **AudioService** が Storage 操作を一元管理
- [ ] **Edge Function** が SHA256 計算 → RPC 呼び出しを担当
- [ ] `USE_AUDIO_REGISTRY` Feature Flag で新旧切替可能
- [ ] `storage.from('choreocore-audio')` の Editor/Viewer 直叩きが **0 件**（CI）
- [ ] **旧フローへ即時ロールバック**可能（Flag OFF）
- [ ] `USE_AUDIO_REGISTRY=true` で新規取り込みが asset/version/registry に登録される

### Phase 1 完了（バックフィル）

- [ ] 既存 `json.audioSupabasePath` が asset/version/registry に反映
- [ ] Validation で `json_path_registry_mismatch` が許容範囲（warn のみ or 0）
- [ ] `active_asset_null_checksum` がバックフィル対象のみに限定

### Phase 4 完了（共同編集）

- [ ] editor が音源再取り込み・波形 upsert 可能
- [ ] viewer は読み取りのみ
- [ ] 同時保存で version_no 衝突なし（`FOR UPDATE` 検証）

---

## Production Readiness Review（本番前）

Phase 3 完了後、本番リリース前に実施。「動く」ではなく**安心して運用できる**ことを確認する。

### 負荷試験

- [ ] **100 件以上**の連続アップロード
- [ ] 大容量音源（**50〜100 MB**）の取り込み・再生
- [ ] **同時アップロード**（2〜3 クライアント）

### 障害試験

- [ ] Storage 障害（5xx / object not found）時の UX
- [ ] RPC 失敗時の状態（DB / JSON / Storage の不整合なし）
- [ ] Edge Function **タイムアウト**
- [ ] ネットワーク切断 → 復帰後の再試行

### ロールバック試験

- [ ] `USE_AUDIO_REGISTRY=false` で**即復旧**
- [ ] **旧音源**（レガシーパス含む）が再生できる
- [ ] レジストリ未登録でも**既存フロー**（`audioSupabasePath` 直参照）が動作する

### 運用

- [ ] ロールバック手順（`*.down.sql` / Feature Flag）をドキュメント化
- [ ] 監視: Storage エラー率・RPC エラー・EF レイテンシの確認手段
- [ ] 障害時エスカレーション（誰が `007` validation を再実行するか）

---

## 推奨ロードマップ（Design Freeze 後の実装順）

```
Phase 0（001〜007）適用
    ↓ Exit: Validation error=0 + Regression + Smoke
Phase 2（Storage RLS）※波形 upsert ブロッカー時は Phase 3 前に実施可
    ↓
Feature Flag `USE_AUDIO_REGISTRY` 導入
    ↓
Phase 3（AudioService + Edge Function + Facade RPC）
    ↓ Exit: CI architecture test + ロールバック確認
Phase 1（バックフィル）
    ↓ Exit: registry と JSON の整合
Phase 4（共同編集）
```

**CI ゲート（推奨）**

```yaml
# Phase 1 完了後、本番デプロイ前
- run: select * from choreocore_validate_audio_migration()
- assert: severity = 'error' の行が 0 件
```

---

## ADR-002.4 — 運用品質（FROZEN・未実装分）

> 本セクションは凍結済み。変更は ADR 更新トリガーに該当する場合のみ。

### ① `choreocore_audio_events`（将来）

監査・デバッグ用イベントログ。Phase 3 安定後に追加。

```sql
-- 案（未作成）
-- choreocore_audio_events (
--   id, asset_id, project_id, event_type, payload jsonb,
--   created_by, created_at
-- )
-- event_type 例: audio_uploaded | audio_deleted | version_created |
--                 undo | restore | ai_analysis | share
```

### ② RPC バージョニング

- `choreocore_register_project_audio` = **API Version 1**（006 コメント参照）
- 破壊的変更時は `register_project_audio_v2` を新設。v1 は移行期間維持。

### ③ Edge Function 責務（固定）

`audio-upload-complete`（仮称）は **この 4 ステップのみ**:

1. Storage Upload（またはクライアント upload 完了 webhook を受信）
2. SHA256 計算
3. `choreocore_register_project_audio` RPC
4. `{ asset_id, version_id, storage_path }` を返却

**禁止**: AI 解析・波形生成・プロジェクト JSON 更新（別 Function へ）

### ④ Feature Flag（Phase 3）

```typescript
// src/lib/featureFlags.ts（Phase 3 で追加）
export const USE_AUDIO_REGISTRY =
  import.meta.env.VITE_USE_AUDIO_REGISTRY === "true";
```

- `false`: 既存フロー（`audioSupabasePath` + 直接 Storage）— 即ロールバック可能
- `true`: AudioService → Edge Function → Facade RPC

### ⑤ Architecture Test（CI）

Editor / Viewer から `supabase.storage.from('choreocore-audio')` の**直接呼び出しを禁止**。

```
許可: Editor → AudioService → Storage / RPC / Cache / WavePeaks
禁止: Editor → supabase.storage.from()  （grep / eslint で CI fail）
```

### 将来設計メモ（Phase 3 以降・今は作らない）

**方針**: 必要になった時点で追加。初期実装の複雑さを抑える。

| 項目 | 時期 |
|------|------|
| `choreocore_audio_events`（UPLOAD / REGISTER / PLAY / ANALYSIS_* 等） | Phase 3 安定後 |
| `feature_flags` テーブル（`USE_AUDIO_REGISTRY` / `USE_NEW_RLS` / `USE_AI` / `USE_DEDUP`） | Phase 4 以降 |
| Metrics / Monitoring（容量・dedup 率・再利用率・version 数・解析待ち） | 容量最適化フェーズ |
| `register_project_audio_v2`（API v2） | 破壊的変更時 |
| S3 / R2 / GCS 等ストレージ移行 | AudioService 差し替え時 |
| Storage Tier C パス | 移行コストが正当化された時 |
| `choreocore_audio_analysis_results` | AI 機能実装時 |

---

## 将来アーキテクチャ: AudioService 層（Phase 3 アプリ）

```
Editor / Viewer
      ↓
AudioService          ← 唯一 Storage を知る層
      ↓
  ┌───┴───┬──────────┬────────────┐
Storage  RPC      Cache API    WavePeaks
(Supabase) (register_*)  (IDB)   (sidecar)
```

**責務**

- アップロード: Edge Function で SHA256 → Storage upload → `register_project_audio` RPC
- ダウンロード / 署名 URL / キャッシュキー生成
- `touch_audio_access` の呼び出しタイミング
- 将来 S3 移行時は AudioService のみ差し替え

**Undo 用設計メモ（未実装）**

```sql
-- Phase 5 で検討
alter table choreocore_projects
  add column previous_audio_asset_id uuid references choreocore_audio_assets(id);
-- bind_project_audio 内で current → previous にスワップ
```

---

## 実行順

| # | ファイル | 内容 |
|---|----------|------|
| 1 | `001_audio_core_tables.up.sql` | `audio_assets` + `audio_asset_versions` |
| 2 | `002_projects_audio_link.up.sql` | `projects.current_audio_asset_id` |
| 3 | `003_project_members.up.sql` | 共同編集メンバー + owner バックフィル |
| 4 | `004_analysis_jobs.up.sql` | AI ジョブ（結果テーブルは未作成） |
| 5 | `005_rls_functions.up.sql` | 権限関数 + テーブル RLS |
| 6 | `006_register_audio_rpc.up.sql` | 登録 RPC + touch RPC |
| 7 | `007_validation.up.sql` | 整合性検証関数 |

**本番適用前**: `CODE_REVIEW.md` のレビュー完了後に `001` → `007` を実行。

**適用後**:

```sql
select * from public.choreocore_validate_audio_migration() order by check_id;
-- severity = 'error' が 0 件であること
```

## ロールバック順（逆順）

```
007 → 006 → 005 → 004 → 003 → 002 → 001
```

各 `*.down.sql` を Dashboard SQL エディタで実行。

## 触らないもの（Phase 0）

- Storage バケット・オブジェクトキー形式（Tier A 維持）
- 既存 Storage RLS ポリシー（Phase 2 で拡張）
- `json.audioSupabasePath`（移行期の読み取り正）

---

## Regression Test チェックリスト（Phase 1 前）

Smoke Test に加え、以下を手動または E2E で確認します。

### Storage

| # | シナリオ | 期待結果 |
|---|----------|----------|
| S1 | 新規アップロード（Tier A パス） | 再生・波形表示 OK |
| S2 | 同一音源の再アップロード | 再生 OK（dedup 時は Storage 増えない） |
| S3 | 波形生成（初回 decode） | サイドカー `.wavepeaks.json` 作成 |
| S4 | 波形更新（upsert） | RLS エラーなし |
| S5 | 波形削除（音源差し替え時） | 旧サイドカー削除 or 孤立（許容範囲を記録） |

### Project / Asset

| # | シナリオ | 期待結果 |
|---|----------|----------|
| P1 | RPC で Asset 登録 | asset / version / project が 1 トランザクションで整合 |
| P2 | Asset 差し替え | 新 version、`current_audio_asset_id` 更新 |
| P3 | Version 追加 | `version_no` インクリメント |
| P4 | Undo（将来） | 現状はスコープ外、Phase 5 で再テスト |

### Legacy パス再生

| # | パス形式 | 期待結果 |
|---|----------|----------|
| L1 | `{uid}/{project}/{uuid}.mp3` | 再生 OK |
| L2 | `{project_id}/{file}` | 再生 OK（Phase 2 RLS 後） |
| L3 | ルート直下 `{uuid}.mp3` | 再生 OK（JSON パス一致時） |

### Share

| # | シナリオ | 期待結果 |
|---|----------|----------|
| H1 | Share URL（anon） | 音源再生 OK |
| H2 | owner ログイン | 編集・再取り込み OK |
| H3 | editor（Phase 4 以降） | 編集・波形 upsert OK |

---

## 実装優先順位（Design Freeze 後）

1. **Phase 0** — ステージング適用 + Validation + Regression
2. **Phase 3** — AudioService（TS）+ Edge Function + Feature Flag
3. **Phase 1** — バックフィル（安定運用後）
4. **Phase 4** — 共同編集
5. Undo/Redo 永続化 / AI / クラウド同期 / 公開 API（ADR 更新トリガー時に計画）

---

## ドキュメント構成

| ドキュメント | 役割 |
|--------------|------|
| ADR-001 | 全体構想・履歴（参照用） |
| ADR-002〜002.4 | 採用設計・**Design Freeze** |
| 本 README | 実装・レビュー・運用ガイド |
| `CODE_REVIEW.md` | 実装レビュー結果 |
| `007_validation` | DB 健全性確認（Regression の一部） |
| Regression チェックリスト（本 README） | 後方互換性確認 |
| Smoke / Production Readiness（本 README） | 基本動作・本番前確認 |

## 関連ファイル

- `CODE_REVIEW.md` — 001〜007 のレビュー結果
- `../schema.sql` — 既存ベースライン
- `../choreocore-audio-update-policy.sql` — Phase 2 で統合予定
