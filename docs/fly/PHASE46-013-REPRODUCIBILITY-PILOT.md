# PHASE 4.6-G — Extra Pilot Design: song-013 Double Annotation (Reproducibility)

**Status:** DESIGN LOCKED + **WASHOUT ACTIVE** — Session B **not today**; **no L3 implementation**  
**Spec ID:** `4.6-g-013-reproducibility-pilot-v1`  
**Prerequisite:** 4.6-F Verdict **A CONDITIONAL-GO**  
**Date:** 2026-09-14  
**Report basis:** `docs/fly/reports/phase-anchor-independence-audit.md`

**Checkpoint (binding):**  
4.6-F showed only that L3 **origin-choice** is a plausible hypothesis. Do **not** implement L3. Confirm **013 reproducibility** first.

**Now:** washout **≥24h** (prefer **48–72h**). Do not run Session B until washout ends.

---

## ① 4.6-F結果の評価

### 証明されたこと

1. **Independence（原点レベル）**  
   Pilot 5曲で、Phase Anchor primary は **Beat0 / CountGrid 原点の単純コピーではない**（4/5 が明確に FAR；002 は近傍だが copy lexicon なし）。
2. **Type collapse なし**  
   Primary は SECTION / VOCAL。BEAT / DOWNBEAT への潰し込みは起きていない。
3. **Rationale 言語**  
   Beat/CountGrid/Analyzer 語彙による正当化は **0/5**。身体・区間・歌声の言葉で説明できている。
4. **013 center**  
   Anchor ≈31.4s vs Beat0 ≈0.287s。Beat番号なしで「なぜそこが dance origin か」を言えている。  
   nearest beat Δ≈29ms → **後続拍格子上の原点選択**であり、off-grid 微細ズレの発見ではない。

### 証明されていないこと

1. **Reproducibility** — 同じ判断が別セッションで繰り返せるか（未実施）。
2. **Inter-annotator agreement** — 別人の一致（未実施；今回はまず同一人 test-retest 可）。
3. **Kinds の豊かさ** — SECTION/VOCAL テンプレが強く、HIT/GROOVE/ANTICIPATION 等の多様性は未開拓。
4. **一般化** — 5曲・1 annotator。Golden 20 全体やジャンル横断は未証明。
5. **Analyzer / Formation 接続価値** — L3 が製品スコアを改善するかは未検証（今はやらない）。
6. **off-grid Dance Phase** — 「拍から意図的に外れた身体タイミング」は今回の主結果ではない。

### 過剰解釈の危険

| 危険 | 正しい読み |
|------|------------|
| 「L3 が完全に証明された」 | Independence の **存在証拠** のみ。CONDITIONAL-GO。 |
| 「013 の Δ31s は Analyzer Phase 誤差の説明」 | それは別問題。今は **原点の取り方** の独立。 |
| 「Beat と無関係な時間軸が発見された」 | 多くは **pulse 上のどの点を count1 にするか**。格子からの独立ではない。 |
| 「SECTION が唯一の正しい型」 | Pilot の発見バイアス（テンプレ再利用 5/5）。 |
| 「精度が上がった」 | 4.6-F は精度ゲートではない。 |
| 「013 だけで L3 を固定してよい」 | 代表ケースには適するが **一般化不可**。 |

**結論（解釈）:** L3 Phase Anchor を「導入検討する根拠」は十分。  
**今すぐ L3 Data Model 実装 → GO 確定** には、まだ Reproducibility が足りない。

---

## ② 013二重注釈プロトコル

### 目的

Independence の次に、

> 同じ音楽的・振付的判断を、別 annotation でも再現できるか

を **song-013** で検証する（test-retest / 二重注釈）。

### セッション定義

| Session | 扱い | 既存データ |
|---------|------|------------|
| **A** | 既に完了した Pilot 注釈を **Session A として凍結** | `phase-anchors/song-013/phase-anchor.json` → 複製して `phase-anchor.session-a.json` として保管（中身は変更しない） |
| **B** | **新規**・A を見ない独立セッション | `phase-anchor.session-b.json` のみ新規作成 |

同一人物でも可。その場合は **test-retest**。

### ブラインド規則（同一人の場合）

1. Session B 開始前に、次を **開かない / 画面に出さない**  
   - `phase-anchor.json` / `phase-anchor.session-a.json`  
   - `MEMO.md`（確定秒が書いてあるもの）  
   - 4.6-F レポートの 013 行（秒が分かる表）  
   - Consensus / Beat GT / Analyzer / workbench Beat UI  
2. **Washout（推奨候補）**  
   - 最低 **24時間** 空ける（理想 **48–72時間**）  
   - または別日・別デバイスで実施  
3. Session B は **mp3 のみ** + 空のメモテンプレ（秒・答えなし）  
4. 終了後はじめて A と突き合わせる（比較は監査側／後工程）

別人の場合: A と B を同時並行可。相互非開示。

### Session B 手順（ステップ）

1. `013_One_More_Time.mp3` を通しで1回聴く（秒を決めない）。  
2. 「踊り手がここを起点・基準として身体を動かし始める位置」を探す。  
3. 候補をメモ（秒・理由）。必要なら前後2秒で再聴。  
4. **primaryOrigin を1点**に決定。  
5. スキーマ（③）の全必須欄を埋める。  
6. `phase-anchor.session-b.json` として保存。  
7. `consultedMusicBeatUi: false`（原則）。見た場合は `true` + notes に何を見たか。  
8. **まだ A と比較しない。** 比較は Reproducibility Audit（4.6-H）で一括。

### やらないこと

- A の秒に「寄せる」  
- Beat0 / CountGrid を開いて合わせる  
- L3 実装・Fusion・Analyzer 改修

---

## ③ Annotation Schema（013 記録項目）

Version: `4.6-g-013-repro-v1`  
（既存 `4.6-e-phase-anchor-v1` を拡張。Pilot A は e のままでも可；比較時は共通フィールドだけ使う）

### 必須（primaryOrigin）

| Field | 意味 |
|-------|------|
| `anchorTimeSec` | dance origin の絶対秒 |
| `anchorType` | SECTION / VOCAL / BEAT / DOWNBEAT / HIT / GROOVE / ANTICIPATION / KICK / SNARE / OTHER … |
| `confidence` | 0.0–1.0（自信。正しさの点数ではない） |
| `rationale` | なぜそこが dance origin か（Beat番号・GTコピー禁止） |
| `role` | ORIGIN（primary は原則 ORIGIN） |

### 必須（セッションメタ）

| Field | 意味 |
|-------|------|
| `songId` | `song-013` |
| `sessionId` | `A` \| `B` |
| `annotatorId` | 同一人でも可 |
| `annotatedAt` | ISO8601 |
| `audioSha256` | 既存ハッシュを維持 |
| `consultedMusicBeatUi` | boolean |
| `washoutNote` | B のみ: 前回から何時間空けたか（自己申告で可） |

### 推奨（再現性比較用・B はなるべく埋める）

| Field | 意味 | 記入タイミング |
|-------|------|----------------|
| `referencePoint` | 判断の手がかり（例: 「ビートの質が変わる境」「サビ前の入り」） | 決定時 |
| `sectionRelation` | 自由記述: どの区間の始まり／変わり目か | 決定時 |
| `musicalSignificance` | 振付上なぜ意味があるか（移動開始・ジャンプ・合わせ 等） | 決定時 |
| `relationToMusic.vsBeat` | ON / EARLY / LATE / UNCLEAR / N/A | **決定後**（Beat一覧は見ない；感覚で可） |
| `relationToMusic.approxOffsetSec` | 感覚的な前後（任意） | 決定後 |
| `nearestBeatRelationNote` | 「だいたい拍に乗っている／少し早い」等の自己記述。**秒の GT 照合は監査時** | 決定後 |
| `alternateCandidates[]` | 捨てた候補の秒と理由（任意だが推奨） | 決定時 |

### JSON 形（Session B テンプレ）

```json
{
  "songId": "song-013",
  "sessionId": "B",
  "annotatorId": "sopsakai",
  "annotationVersion": "4.6-g-013-repro-v1",
  "audioSha256": "bda9d77006e38fda7a4d427e01d2cf4410f83880c4f83da9293bbf3f6dd23628",
  "washoutNote": "Session A から ○○時間空けた",
  "primaryOrigin": {
    "anchorTimeSec": null,
    "anchorType": "OTHER",
    "confidence": 0,
    "rationale": "",
    "role": "ORIGIN",
    "referencePoint": "",
    "sectionRelation": "",
    "musicalSignificance": "",
    "relationToMusic": {
      "vsBeat": "UNCLEAR",
      "approxOffsetSec": null,
      "note": ""
    },
    "nearestBeatRelationNote": ""
  },
  "alternateCandidates": [],
  "anchors": [],
  "annotatedAt": "",
  "notes": "",
  "consultedMusicBeatUi": false
}
```

Session A は既存ファイルを凍結コピーし、`sessionId: "A"` を付与したメタ付き複製でよい（時刻・rationale は改変しない）。

---

## ④ Reproducibility Metrics

**原則:** Exact Match 失敗 ≠ 再現失敗。複数軸で見る。

### 軸

| Axis | 何を見るか |
|------|------------|
| **T — Temporal** | \|t_A − t_B\| |
| **S — Same section / event** | 同じ音楽的事象（例: 同じ「ビート質変化の境」）を指しているか（人手レビュー + 候補） |
| **K — Anchor type** | type 一致 / 互換グループ |
| **R — Rationale** | 同じ判断構造か（区間変化→count1 等）。文言一致は不要 |
| **G — Grid relation** | 監査時のみ: 両者とも Beat0 から FAR か；両者とも later-grid 近傍か（A/B 注釈中は計算しない） |

### Temporal — 候補 threshold（勝手な単一真理にしない）

IOI は 013 の Consensus からおおよそ **~0.48s** 前後（要監査時に再計算）。候補:

| Band | \|Δt\| 候補 | 意味 |
|------|-------------|------|
| **T0 Exact-ish** | ≤ **50 ms** | 同一クリック級 |
| **T1 Same pulse** | ≤ **100 ms** または ≤ **0.25 × IOI** | 実質同じ判断 |
| **T2 Same region** | ≤ **1 × IOI**（~1拍） | 近いがパルスずれの可能性 |
| **T3 Neighbor event** | ≤ **2–4 × IOI** または ≤ **2.0 s** | 近接イベントの取り違え候補 |
| **T4 Distinct** | それ以上（例: 31s vs 47s） | **明確に異なる判断** |

**提案する主判定用:**  
- **Agree (temporal):** T0 or T1  
- **Soft agree:** T2 + Same section/rationale  
- **Disagree:** T4、または T3 かつ rationale/section 不一致  

※ 50/100ms・0.25 IOI・1 IOI は **候補**。Audit で感度を表にし、小サンプルで「精度99%」と言わない。

### Type — 候補

| 結果 | 条件 |
|------|------|
| Type match | 完全一致 |
| Type compatible | 例: SECTION↔OTHER（区間説明が同じ）、HIT↔SECTION（同じ境を一撃と言い換えた）→ 人手で compatible 判定 |
| Type conflict | 例: VOCAL vs KICK で rationale も別事象 |

### Rationale — Rubric（人手）

| Score | 意味 |
|-------|------|
| R2 | 同じ事象・同じ振付行為（例: ビート質変化の境で前移動開始） |
| R1 | 同じ区間だが行為の記述が違う（移動 vs ジャンプ等） |
| R0 | 別事象（例: A=31s 区間境、B=47s 強拍ジャンプ） |

### 合成（報告用・非自動絶対）

各セッション対について記録:

```
temporalBand: T0|T1|T2|T3|T4
typeRelation: match|compatible|conflict
rationaleScore: R2|R1|R0
independencePreserved: both FAR from Beat0? (audit-time)
```

---

## ④′ 4.6-H で見るポイント（timestamp exact match ではない）

Audit は「同じ答えか」ではなく、

> **同じ音楽的理由から、同じ種類の原点を選べたか**

を分離評価する。

| # | 見るもの | ねらい |
|---|----------|--------|
| 1 | 同じような **時間帯** か | Temporal band（T0–T4）。完全一致必須ではない |
| 2 | 同じ **Section との関係** か | sectionRelation / 区間事象の一致 |
| 3 | **Anchor Type** が一致／互換か | match / compatible / conflict |
| 4 | **Rationale** が同じ意味か | 文言一致不要。R2/R1/R0 |
| 5 | **Musical Significance** が一致するか | 振付行為（移動開始・ジャンプ等）の同型か |
| 6 | **referencePoint** が一致するか | 手がかりの同型か |
| 7 | **nearest-beat との関係** | 感覚記述 + 監査時の格子関係（注釈中は GT 非開示） |
| 8 | A/B が大きく分岐したとき **説明可能か** | 例: 31s 区間境 vs 47s HIT — 両方妥当なら CONDITIONAL 材料 |

**ここで初めて** 4.6-H = **PASS / CONDITIONAL / HOLD** を出す。  
それまで L3 実装 · Fusion · MSAF · Analyzer 変更は **完全凍結**。

---

## ⑤ PASS / CONDITIONAL / HOLD 基準

**対象:** まず **013 の A↔B**（必要なら後で 1–2 曲追加）。  
**禁止:** n=1 曲の二重注釈から「再現率99%」「L3完成」と主張すること。

### PASS（→ L3 Data Model **設計**へ進む）

013 A↔B が次を満たす:

1. **Temporal:** T0 or T1、**または** T2 かつ rationale **R2** かつ type match/compatible  
2. **Rationale:** R2（同じ dance-origin 事象）  
3. **Independence preserved:** 両セッションとも Beat0/CountGrid 原点のコピーではない（FAR、または近傍でも copy lexicon なし + 身体語）  
4. **Type:** conflict でない  

→ 「013 代表ケースで、独立した原点判断が **再現可能**」とみなす。  
→ 次は **L3 Data Model の文章設計**（実装は設計レビュー後）。Fusion/MSAF はまだ凍結。

### CONDITIONAL（追加 Pilot）

次のいずれか:

- Temporal T2–T3 で R1（近いが揺れ）  
- Type conflict だが temporal は T1 以内（ラベル揺れ）  
- Independence は保たれるが、primary が A/B で別イベント（例: 31s vs 47s）かつ両方とも「妥当な候補」で、**primary の一意性が弱い**  
- Washout 不足・UI 汚染の疑い  

→ 追加: washout 延長の Session C、または別人注釈、または 020/005 でも二重注釈。**L3 実装はまだしない。**

### HOLD（L3 設計保留）

- Temporal **T4** かつ rationale **R0**（明確に別判断）が主結果  
- 一方または両方が Beat0/CountGrid への **コピー回帰**  
- 「再現できないので GT にできない」  

→ L3 をデータモデルとして固定しない。Independence の解釈を見直し（例: multi-anchor を primary 単一より先に設計する等）。

### 小サンプル注意書き（必須）

この判定は **設計ゲート** であり、統計的一般化ではない。PASS でも「Golden 20 全体で再現」とは言わない。

---

## ⑥ L3 Data Model への影響（仮説のみ・実装しない）

Pilot 後に必要になりそうな構造（仮説）:

```
DancePhaseOrigin (L3)
  songId
  primaryOrigin: PhaseAnchorMark   # 振付上の count1 / 動き出し基準
  alternateOrigins[]               # 31s vs 47s のような妥当な複数候補
  relationToL2:
    vsBeat0: FAR | NEAR | EQUAL
    vsNearestBeat: ON | EARLY | LATE | …
    note: "origin choice on pulse ≠ phase0"
  provenance: sessions[], agreementSummary
```

示唆:

- L3 の核心は **off-grid 連続量** より、まず **origin selection（どの事象／どの拍を原点にするか）** の可能性が高い。  
- Beat 検出の別名にしない。L2 Beat Reference は残し、L3 は「どれをダンス原点にするか」を指す。  
- multi-anchor（013 の HIT@47 / SECTION@140）を first-class にする価値あり。

**今は型もコードも増やさない。** 仮説のメモまで。

---

## ⑦ 今は実装しないもの（凍結）

- Fusion  
- MSAF  
- Analyzer 改修 / Beat 検出ロジック変更  
- CountGrid ロジック変更  
- 本番 V1 配線  
- AI 自動提案  
- 自動 weight optimization  
- **L3 Data Model の実装**（スキーマ草案の文章は可）  
- Beat GT の Phase Anchor へのリターゲット  

今回の目的は **Phase Anchor の再現性検証設計と、その人間実施** のみ。

---

## ⑧ 次の一手（手順）— 現在位置: WASHOUT

```
4.6-F CONDITIONAL-GO          ✅
4.6-G DESIGN                  ✅
Session A freeze              ✅ phase-anchor.session-a.json
        ↓
★ WASHOUT NOW                ≥24h / prefer 48–72h  ← あなたはここ
  （今日は Session B しない）
        ↓
Session B blind               MEMO.session-b.md → phase-anchor.session-b.json
  ・A結果・秒・GT・既存JSONを見ない
  ・013を完全に新規判断
  ・AとBを自分で比較しない
  ・完了通知は「Session Bできた」のみ
        ↓
4.6-H Reproducibility Audit   ④′ の分離評価 → PASS / CONDITIONAL / HOLD
        ↓
    PASS → L3 Data Model 設計（文章）→ レビュー → 実装判断
    CONDITIONAL → 追加二重注釈
    HOLD → L3 固定せず再設計
        ↓
（GO 後はじめて）Analyzer / Fusion / MSAF を再検討
```

### 最重要原則（再掲）

```
人間の判断が独立している
  → 同じ判断を再現できる
    → その判断を構造化できる
      → Ground Truth として利用できる
        → 初めて L3 として実装する
```

FLY は「AIがそれっぽい答えを出す」ためではなく、**人間の振付判断を再現可能な知識として扱う**ために L3 を置く。

---

## One-sentence contract

> After 4.6-F independence, do not implement L3 until song-013 double annotation shows reproducible dance-origin choice (not exact-ms fetish, not Analyzer accuracy).
