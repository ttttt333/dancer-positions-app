import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import type {
  ChoreographyProjectJson,
  DancerSpot,
  SavedSpotLayout,
} from "../types/choreography";
import {
  dancersForLayoutPreset,
  type LayoutPresetId,
} from "../lib/formationLayouts";
import {
  dancersFromFormationBoxItem,
  FORMATION_BOX_CHANGE_EVENT,
  listFormationBoxItems,
  type FormationBoxItem,
} from "../lib/formationBox";

/**
 * 「立ち位置クイック切り替えパネル」。
 *
 * ステージ上部のスペースを潰したくないので、ステージ右側に縦長の **フローティング
 * パネル**（呼び出し元が fixed 配置）として表示される想定。`onClose` が渡されたときは
 * 右上に閉じるボタンを描画する。
 *
 * - 現在選択しているキューのフォーメーションに対して、
 *   定番プリセット／形の箱のスナップショット／プロジェクト保存スロットから
 *   ワンクリックでプレビュー → 「適用」確定で書き換える。
 * - プレビュー中は `onPreviewChange` でステージ側にダンサーを渡す。
 *   プレビューだけでは元の立ち位置は変わらないので、誤タップしても安全。
 * - スロットは `project.savedSpotLayouts` を背番号 1〜9 として並べる。
 *   空きスロットは「保存」、保存済みはクリックでプレビュー＆「↻上書き」「✕削除」。
 *
 * 同じ formationId が複数キューに紐付くと、適用結果は当該フォーメーションを
 * 共有しているキューすべてに反映される（既存の編集モデルと同じ）。
 */

/** 立ち位置のクイック呼び出しに出す定番プリセット（人数に依らず汎用的なもの） */
const QUICK_PRESETS: { id: LayoutPresetId; label: string }[] = [
  /** ★ 推奨順（先頭ブロック）: ユーザ指定の並び */
  { id: "line", label: "横一列" },
  { id: "pyramid", label: "ピラミッド" },
  { id: "pyramid_inverse", label: "逆ピラミッド" },
  { id: "stagger", label: "千鳥" },
  { id: "stagger_inverse", label: "逆千鳥" },
  { id: "two_rows", label: "2列" },
  { id: "rows_3", label: "3列" },
  { id: "rows_4", label: "4列" },
  { id: "rows_5", label: "5列" },
  /** ─ ここから補助バリエーション ─ */
  { id: "line_front", label: "横（手前）" },
  { id: "line_back", label: "横（奥）" },
  { id: "vee", label: "V字" },
  { id: "arc", label: "円弧" },
  { id: "diamond", label: "ひし形" },
  { id: "circle", label: "円周" },
  { id: "wedge", label: "楔" },
  { id: "block_lr", label: "左右ブロック" },
];

/** 1 プロジェクトに置けるクイックスロットの最大本数（背番号 1〜9） */
const MAX_QUICK_SLOTS = 9;

/**
 * 新しい立ち位置に乗り換えるとき、人物アイデンティティ（id / 名前 / メンバー紐付け）を
 * 順番ベースで引き継ぐ。FormationSuggestionPanel と同じ振る舞い。
 */
function transferIdentitiesByOrder(
  newDancers: DancerSpot[],
  oldDancers: DancerSpot[]
): DancerSpot[] {
  return newDancers.map((nd, i) => {
    const od = oldDancers[i];
    if (!od) return nd;
    return {
      ...nd,
      id: od.id,
      label: od.label,
      colorIndex: od.colorIndex,
      crewMemberId: od.crewMemberId,
      sizePx: od.sizePx ?? nd.sizePx,
      note: od.note ?? nd.note,
    };
  });
}

type PendingSource =
  | { kind: "preset"; presetId: LayoutPresetId; label: string }
  | { kind: "box"; itemId: string; label: string }
  | { kind: "slot"; slotId: string; label: string };

type Props = {
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  /** 適用先フォーメーション ID（通常は selectedCue?.formationId ?? activeFormationId） */
  targetFormationId: string | null;
  /** ステージへの一時表示。null で解除。 */
  onPreviewChange: (dancers: DancerSpot[] | null) => void;
  /** 操作対象のキュー名（あれば「キュー A 用」とラベル表示） */
  targetCueLabel?: string | null;
  /** view モード等で全機能無効化したい場合 */
  disabled?: boolean;
  /** 渡されると右上に閉じるボタンを描画する（パネル運用時に利用） */
  onClose?: () => void;
};

export function QuickFormationBar({
  project,
  setProject,
  targetFormationId,
  onPreviewChange,
  targetCueLabel,
  disabled,
  onClose,
}: Props) {
  const [pending, setPending] = useState<PendingSource | null>(null);
  const [pendingDancers, setPendingDancers] = useState<DancerSpot[] | null>(null);
  const [showAllBox, setShowAllBox] = useState(false);
  /** 形の箱はローカルストレージなので、自前で再読み込みできるようバージョンキー */
  const [boxRev, setBoxRev] = useState(0);

  const targetFormation = useMemo(
    () =>
      targetFormationId
        ? project.formations.find((f) => f.id === targetFormationId) ?? null
        : null,
    [project.formations, targetFormationId]
  );

  /** 現在の人数（クリック時に乗り換える基準）。最低 1 を保証。 */
  const currentCount = Math.max(1, targetFormation?.dancers.length ?? 0);

  /** 形の箱（端末ローカル）。ターゲットの人数で絞り込む（全件表示トグルあり）。 */
  const boxItems = useMemo<FormationBoxItem[]>(() => {
    const all = listFormationBoxItems();
    if (showAllBox) return all;
    const matched = all.filter((it) => it.dancerCount === currentCount);
    /** 同人数が無いときは全件出して気付かせる（空っぽにしない） */
    return matched.length > 0 ? matched : all;
  }, [showAllBox, currentCount, boxRev]);

  /** プロジェクト内スロット。順序は `project.savedSpotLayouts` のまま。 */
  const slots = useMemo<SavedSpotLayout[]>(
    () => project.savedSpotLayouts.slice(0, MAX_QUICK_SLOTS),
    [project.savedSpotLayouts]
  );

  /** ターゲット人数で「規格に整列したプリセット」を作る。 */
  const buildPresetDancers = useCallback(
    (presetId: LayoutPresetId): DancerSpot[] => {
      return dancersForLayoutPreset(currentCount, presetId, {
        dancerSpacingMm: project.dancerSpacingMm,
        stageWidthMm: project.stageWidthMm,
      });
    },
    [currentCount, project.dancerSpacingMm, project.stageWidthMm]
  );

  /** ボタン押下: プレビューに乗せる（形の箱は人数差があるとそのまま反映できないので注意） */
  const pickPreset = useCallback(
    (presetId: LayoutPresetId, label: string) => {
      if (disabled || !targetFormation) return;
      const dancers = buildPresetDancers(presetId);
      const pendingSrc: PendingSource = { kind: "preset", presetId, label };
      setPending(pendingSrc);
      setPendingDancers(dancers);
      onPreviewChange(dancers);
    },
    [disabled, targetFormation, buildPresetDancers, onPreviewChange]
  );

  const pickBox = useCallback(
    (item: FormationBoxItem) => {
      if (disabled || !targetFormation) return;
      const dancers = dancersFromFormationBoxItem(item);
      const pendingSrc: PendingSource = {
        kind: "box",
        itemId: item.id,
        label: item.name || `${item.dancerCount}人`,
      };
      setPending(pendingSrc);
      setPendingDancers(dancers);
      onPreviewChange(dancers);
    },
    [disabled, targetFormation, onPreviewChange]
  );

  const pickSlot = useCallback(
    (slot: SavedSpotLayout) => {
      if (disabled || !targetFormation) return;
      const dancers = slot.dancers.map((d) => ({ ...d }));
      const pendingSrc: PendingSource = {
        kind: "slot",
        slotId: slot.id,
        label: slot.name,
      };
      setPending(pendingSrc);
      setPendingDancers(dancers);
      onPreviewChange(dancers);
    },
    [disabled, targetFormation, onPreviewChange]
  );

  const clearPending = useCallback(() => {
    setPending(null);
    setPendingDancers(null);
    onPreviewChange(null);
  }, [onPreviewChange]);

  /** ターゲットフォーメーションが切り替わったら、プレビューも自動でクリア。 */
  useEffect(() => {
    clearPending();
  }, [targetFormationId, clearPending]);

  /** プレビュー中に Esc で解除（バー以外でフォーカス取られていなければ） */
  useEffect(() => {
    if (!pending) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const tgt = e.target as HTMLElement | null;
        if (tgt && /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName)) return;
        clearPending();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pending, clearPending]);

  /** プレビューを正式に確定して、現在のフォーメーションに書き戻す。 */
  const apply = useCallback(() => {
    if (disabled || !targetFormation || !pendingDancers) return;
    const dancers = transferIdentitiesByOrder(
      pendingDancers,
      targetFormation.dancers
    );
    setProject((p) => ({
      ...p,
      formations: p.formations.map((f) =>
        f.id === targetFormation.id
          ? { ...f, dancers, confirmedDancerCount: dancers.length }
          : f
      ),
    }));
    clearPending();
  }, [disabled, targetFormation, pendingDancers, setProject, clearPending]);

  /** スロットへ「いまの立ち位置」を保存（既存があれば上書き確認） */
  const saveSlot = useCallback(
    (existingSlot: SavedSpotLayout | null) => {
      if (disabled || !targetFormation) return;
      const baseName =
        existingSlot?.name ??
        `並び ${(project.savedSpotLayouts.length || 0) + 1}`;
      const name = window.prompt(
        existingSlot
          ? `スロット「${existingSlot.name}」を いま の立ち位置で上書きします。\n名前を変更する場合は入力してください。`
          : "スロットの名前（あとで変更可）",
        baseName
      );
      if (name === null) return;
      const trimmed = name.trim().slice(0, 60) || baseName;
      const dancersCopy: DancerSpot[] = targetFormation.dancers.map((d) => ({
        ...d,
      }));
      setProject((p) => {
        const list = [...p.savedSpotLayouts];
        if (existingSlot) {
          const idx = list.findIndex((s) => s.id === existingSlot.id);
          if (idx >= 0) {
            list[idx] = {
              ...existingSlot,
              name: trimmed,
              savedAtCount: dancersCopy.length,
              dancers: dancersCopy,
            };
          }
        } else {
          list.push({
            id: crypto.randomUUID(),
            name: trimmed,
            savedAtCount: dancersCopy.length,
            dancers: dancersCopy,
          });
        }
        return { ...p, savedSpotLayouts: list.slice(0, MAX_QUICK_SLOTS * 2) };
      });
    },
    [disabled, targetFormation, project.savedSpotLayouts, setProject]
  );

  const deleteSlot = useCallback(
    (slot: SavedSpotLayout) => {
      if (disabled) return;
      const ok = window.confirm(`スロット「${slot.name}」を削除しますか？`);
      if (!ok) return;
      setProject((p) => ({
        ...p,
        savedSpotLayouts: p.savedSpotLayouts.filter((s) => s.id !== slot.id),
      }));
      if (pending?.kind === "slot" && pending.slotId === slot.id) clearPending();
    },
    [disabled, setProject, pending, clearPending]
  );

  /**
   * 形の箱の追加・更新・削除を即時反映する。
   * - 同一タブの mutation は `formationBox:changed` カスタムイベント（formationBox.ts 発火）
   * - 別タブからの localStorage 変更は `storage` イベント
   * - 別ウィンドウから戻ってきたときは `focus` でも一応再読み込み
   */
  useEffect(() => {
    const refresh = () => setBoxRev((r) => r + 1);
    window.addEventListener(FORMATION_BOX_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(FORMATION_BOX_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const noTarget = !targetFormation;
  const hardDisabled = !!disabled || noTarget;
  const previewing = pending != null;

  return (
    <div
      role="region"
      aria-label="立ち位置クイック切り替え"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "10px 10px 12px",
        borderRadius: "12px",
        border: previewing ? "1px solid #38bdf8" : "1px solid #1e293b",
        background: "#0b1220",
        boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
        overflow: "hidden",
        minWidth: 0,
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* ── ヘッダ ─────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flex: 1,
            minWidth: 0,
          }}
          title={
            noTarget
              ? "キューを選択するとそのキューに反映できます"
              : `「${targetCueLabel ?? "現在のフォーメーション"}」に反映`
          }
        >
          <span
            style={{
              fontSize: "13px",
              lineHeight: 1,
              color: previewing ? "#67e8f9" : "#64748b",
              flexShrink: 0,
            }}
            aria-hidden
          >
            ▶
          </span>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span
              style={{
                fontSize: "10px",
                color: "#64748b",
                lineHeight: 1.1,
              }}
            >
              形変更を反映
            </span>
            <span
              style={{
                fontWeight: 700,
                color: previewing ? "#e2e8f0" : "#cbd5e1",
                fontSize: "12px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1.2,
              }}
            >
              {noTarget
                ? "キュー未選択"
                : targetCueLabel
                  ? targetCueLabel
                  : "現在のフォーメーション"}
            </span>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            title="閉じる（Esc）"
            aria-label="閉じる"
            style={closeBtnStyle}
          >
            ×
          </button>
        ) : null}
      </div>

      {/* ── プレビュー操作 ───────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexShrink: 0,
          minHeight: "30px",
        }}
      >
        {previewing ? (
          <Fragment>
            <button
              type="button"
              onClick={apply}
              disabled={hardDisabled}
              title="プレビュー中の立ち位置を このキュー に書き込みます"
              style={{
                ...applyBtnStyle,
                opacity: hardDisabled ? 0.4 : 1,
                cursor: hardDisabled ? "not-allowed" : "pointer",
              }}
            >
              ✓ 適用
            </button>
            <button
              type="button"
              onClick={clearPending}
              title="プレビューを解除（Esc）"
              style={cancelBtnStyle}
            >
              ✕
            </button>
            <span
              style={{
                fontSize: "11px",
                color: "#67e8f9",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flex: 1,
                minWidth: 0,
              }}
              title={pending?.label ?? ""}
            >
              {pending?.label}
            </span>
          </Fragment>
        ) : (
          <span
            style={{
              fontSize: "10px",
              color: "#475569",
              lineHeight: 1.3,
            }}
          >
            クリックで試す → 適用で確定
          </span>
        )}
      </div>

      <Divider />

      {/* ── 本体: 縦スクロール、各セクションでチップを折り返し ───── */}
      <div style={panelScrollAreaStyle}>
        <SectionLabel>定番</SectionLabel>
        <ChipGrid>
          {QUICK_PRESETS.map((p) => {
            const isActive =
              pending?.kind === "preset" && pending.presetId === p.id;
            return (
              <ChipButton
                key={`pre-${p.id}`}
                active={isActive}
                onClick={() => pickPreset(p.id, p.label)}
                disabled={hardDisabled}
                title={`${p.label}（${currentCount} 人）`}
              >
                <SpotThumb dancers={buildPresetDancers(p.id)} />
                <ChipLabel>{p.label}</ChipLabel>
              </ChipButton>
            );
          })}
        </ChipGrid>

        <SectionLabel
          extra={
            <button
              type="button"
              onClick={() => setShowAllBox((v) => !v)}
              title={
                showAllBox
                  ? "現在の人数だけ表示する"
                  : `すべての人数を表示する（現在 ${currentCount} 人）`
              }
              style={miniToggleStyle(showAllBox)}
            >
              {showAllBox ? "全人数" : `${currentCount}人`}
            </button>
          }
        >
          形の箱
        </SectionLabel>
        {boxItems.length === 0 ? (
          <EmptyHint>形の箱はまだ空。ステージで「形を保存」を押すと貯まります</EmptyHint>
        ) : (
          <ChipGrid>
            {boxItems.map((it) => {
              const isActive =
                pending?.kind === "box" && pending.itemId === it.id;
              const dancers = dancersFromFormationBoxItem(it);
              return (
                <ChipButton
                  key={`box-${it.id}`}
                  active={isActive}
                  onClick={() => pickBox(it)}
                  disabled={hardDisabled}
                  title={`${it.name}（${it.dancerCount} 人）${
                    it.dancerCount !== currentCount
                      ? "\n※ 人数が違うと現在のキューに当てると人物の対応がずれることがあります"
                      : ""
                  }`}
                >
                  <SpotThumb dancers={dancers} />
                  <ChipLabel>
                    {it.name}
                    {it.dancerCount !== currentCount && (
                      <span style={{ color: "#f59e0b" }}> ({it.dancerCount})</span>
                    )}
                  </ChipLabel>
                </ChipButton>
              );
            })}
          </ChipGrid>
        )}

        <SectionLabel>スロット</SectionLabel>
        <ChipGrid>
          {Array.from({ length: MAX_QUICK_SLOTS }, (_, i) => {
            const slot = slots[i];
            if (!slot) {
              return (
                <button
                  key={`slot-empty-${i}`}
                  type="button"
                  onClick={() => saveSlot(null)}
                  disabled={hardDisabled}
                  title="いまのステージをこのスロットに保存"
                  style={emptySlotStyle(hardDisabled)}
                >
                  <span style={{ fontSize: "11px", fontWeight: 700 }}>{i + 1}</span>
                  <span style={{ fontSize: "9px", lineHeight: 1 }}>+保存</span>
                </button>
              );
            }
            const isActive =
              pending?.kind === "slot" && pending.slotId === slot.id;
            return (
              <div
                key={`slot-${slot.id}`}
                style={{ position: "relative", flexShrink: 0 }}
              >
                <ChipButton
                  active={isActive}
                  onClick={() => pickSlot(slot)}
                  disabled={hardDisabled}
                  title={`${slot.name}（${slot.savedAtCount} 人）`}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 1,
                      left: 3,
                      fontSize: "9px",
                      color: "#67e8f9",
                      fontWeight: 700,
                      lineHeight: 1,
                      pointerEvents: "none",
                    }}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <SpotThumb dancers={slot.dancers} />
                  <ChipLabel>{slot.name}</ChipLabel>
                </ChipButton>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    saveSlot(slot);
                  }}
                  disabled={hardDisabled}
                  title="このスロットを いまの立ち位置 で上書き保存"
                  style={slotOverwriteBtnStyle}
                  aria-label={`スロット ${i + 1} を上書き保存`}
                >
                  ↻
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSlot(slot);
                  }}
                  disabled={hardDisabled}
                  title="このスロットを削除"
                  style={slotDeleteBtnStyle}
                  aria-label={`スロット ${i + 1} を削除`}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </ChipGrid>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
 * UI 部品（このファイル内専用、軽量に保つ）
 * ──────────────────────────────────────────── */

const applyBtnStyle: CSSProperties = {
  padding: "4px 10px",
  borderRadius: "6px",
  border: "1px solid #0ea5e9",
  background: "#0284c7",
  color: "#f0f9ff",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const cancelBtnStyle: CSSProperties = {
  padding: "3px 7px",
  borderRadius: "6px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#cbd5e1",
  fontSize: "11px",
  cursor: "pointer",
};

const panelScrollAreaStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  overflowY: "auto",
  overflowX: "hidden",
  flex: 1,
  minHeight: 0,
  paddingRight: "2px",
};

const closeBtnStyle: CSSProperties = {
  width: "26px",
  height: "26px",
  padding: 0,
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#cbd5e1",
  fontSize: "16px",
  lineHeight: 1,
  cursor: "pointer",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

function Divider() {
  return (
    <div
      aria-hidden
      style={{
        flexShrink: 0,
        width: "100%",
        height: "1px",
        background: "#1e293b",
      }}
    />
  );
}

function SectionLabel({
  children,
  extra,
}: {
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "6px",
        fontSize: "10px",
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        margin: "2px 0 0",
      }}
    >
      <span style={{ fontWeight: 600 }}>{children}</span>
      {extra}
    </div>
  );
}

function ChipGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
      }}
    >
      {children}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: "10px",
        color: "#475569",
        padding: "2px 4px 4px",
      }}
    >
      {children}
    </span>
  );
}

function ChipLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: "10px",
        color: "#cbd5e1",
        maxWidth: "84px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        lineHeight: 1.1,
      }}
    >
      {children}
    </span>
  );
}

function ChipButton({
  active,
  onClick,
  disabled,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2px",
        padding: "3px 6px 4px",
        borderRadius: "8px",
        border: active ? "2px solid #38bdf8" : "1px solid #1e293b",
        background: active ? "#0e7490" : "#0f172a",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        minWidth: "44px",
      }}
    >
      {children}
    </button>
  );
}

function miniToggleStyle(active: boolean): CSSProperties {
  return {
    padding: "1px 6px",
    borderRadius: "9999px",
    border: active ? "1px solid #38bdf8" : "1px solid #334155",
    background: active ? "rgba(14,116,144,0.28)" : "#0f172a",
    color: active ? "#67e8f9" : "#94a3b8",
    fontSize: "9px",
    cursor: "pointer",
    lineHeight: 1.2,
  };
}

function emptySlotStyle(disabled: boolean): CSSProperties {
  return {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    padding: "4px 8px",
    borderRadius: "8px",
    border: "1px dashed #334155",
    background: "transparent",
    color: "#64748b",
    cursor: disabled ? "not-allowed" : "pointer",
    minWidth: "44px",
    minHeight: "38px",
    opacity: disabled ? 0.4 : 1,
  };
}

const slotOverwriteBtnStyle: CSSProperties = {
  position: "absolute",
  top: "-3px",
  right: "12px",
  width: "14px",
  height: "14px",
  padding: 0,
  borderRadius: "50%",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#94a3b8",
  fontSize: "9px",
  lineHeight: 1,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const slotDeleteBtnStyle: CSSProperties = {
  ...slotOverwriteBtnStyle,
  right: "-3px",
};

/**
 * `DancerSpot[]` をミニサムネイル化。
 * `FormationBoxItemThumb` の汎用版で、ステージ俯瞰 100×60 viewBox に点を打つだけ。
 */
function SpotThumb({ dancers }: { dancers: DancerSpot[] }) {
  const radius = dancers.length >= 12 ? 2.4 : dancers.length >= 6 ? 3.0 : 3.4;
  return (
    <svg
      viewBox="0 0 100 60"
      width={42}
      height={25}
      aria-hidden
      style={{ display: "block", color: "#cbd5e1" }}
    >
      <rect
        x="0"
        y="48"
        width="100"
        height="12"
        fill="currentColor"
        fillOpacity={0.14}
        rx="2"
      />
      {dancers.map((d, i) => {
        const cx = Math.max(4, Math.min(96, d.xPct));
        const cy = 2 + (Math.max(0, Math.min(100, d.yPct)) / 100) * 56;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="currentColor"
            fillOpacity={0.9}
          />
        );
      })}
    </svg>
  );
}
