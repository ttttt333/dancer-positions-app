import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";
import {
  dancersWithPresetAndWingSurplus,
  LAYOUT_PRESET_OPTIONS,
  transferDancerIdentitiesByNearestPosition,
  type LayoutPresetId,
} from "../lib/formationLayouts";
import {
  resolveNearestMatchSpots,
  translateSpotsToMatchFrontRow,
} from "../lib/applyLayoutPresetToSelection";
import { resolvePreviousCueDancers } from "../lib/stagePrevCueCompare";
import { sortCuesByStart } from "../lib/cueInterval";
import {
  applyFormationBoxItemToStage,
  deleteFormationBoxItem,
  FORMATION_BOX_APPLY_MODE_OPTIONS,
  listFormationBoxItems,
  renameFormationBoxItem,
  saveFormationToBox,
  updateFormationBoxItem,
  type FormationBoxApplyMode,
  type FormationBoxItem,
} from "../lib/formationBox";
import { btnPrimary, btnSecondary } from "./stageButtonStyles";
import { FormationPresetThumb } from "./FormationPresetThumb";
import { FormationBoxItemThumb } from "./FormationBoxItemThumb";
import {
  clampDancerCount,
  MAX_DANCERS_PER_FORMATION,
  MIN_DANCERS_PER_FORMATION,
} from "../lib/dancerCountLimits";
import { useAuth } from "../context/AuthContext";
import { useProUpgrade } from "./ProUpgradeProvider";
import { isDancerCountOverFreeLimit } from "../lib/proFeatureLimits";

/**
 * プリセット / 形の箱から作った新しい立ち位置に、
 * 既存のフォーメーションのダンサー識別子（id・名前・色・名簿リンク等）を
 * 「前の立ち位置から一番近いスロット」へ引き継ぐ。
 */

type Props = {
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  onStagePreviewChange?: (dancers: DancerSpot[] | null) => void;
  onClose: () => void;
  /** 反映確定後に呼ぶ（パネルを閉じる等） */
  onAfterApply?: () => void;
  /** プリセットを書き込むフォーメーション id（未指定時は activeFormationId） */
  formationTargetId?: string | null;
  /**
   * floating: 画面右固定（従来）。
   * embedded: 親（ステージ列）の下に流し込み。エディタの左ペイン用。
   */
  variant?: "floating" | "embedded";
};

/**
 * 「フォーメーション案」— 人数と多数のレイアウトプリセットから選ぶ。
 * floating は従来どおり右固定。embedded はエディタ左列のステージ下に配置する。
 */
export function FormationSuggestionPanel({
  project,
  setProject,
  onStagePreviewChange,
  onClose,
  onAfterApply,
  variant = "floating",
  formationTargetId = null,
}: Props) {
  const { viewMode } = project;
  const { me } = useAuth();
  const { requestProUpgrade } = useProUpgrade();
  const [count, setCount] = useState(6);
  /** 直近で配置した雛形（ハイライト用） */
  const [lastAppliedPreset, setLastAppliedPreset] =
    useState<LayoutPresetId | null>(null);
  /** §6 人数が増えたとき、既存メイン人数ぶんだけプリセットを敷き、超過を袖へ */
  const [surplusToWings, setSurplusToWings] = useState(true);

  /** 形の箱（端末内に保存されたユーザ独自の立ち位置） */
  const [boxItems, setBoxItems] = useState<FormationBoxItem[]>(() =>
    listFormationBoxItems()
  );
  /** 直近で配置した形の箱 id（ハイライト用） */
  const [lastAppliedBoxItemId, setLastAppliedBoxItemId] = useState<string | null>(
    null
  );
  const [boxApplyMode, setBoxApplyMode] =
    useState<FormationBoxApplyMode>("positions");
  /** 現在人数のみ表示するか、全件表示するか */
  const [boxShowAllCounts, setBoxShowAllCounts] = useState(false);

  const reloadBox = useCallback(() => {
    setBoxItems(listFormationBoxItems());
  }, []);

  const targetFormationId =
    formationTargetId != null &&
    project.formations.some((f) => f.id === formationTargetId)
      ? formationTargetId
      : project.activeFormationId;

  useEffect(() => {
    const f = project.formations.find((x) => x.id === targetFormationId);
    if (!f) return;
    const raw = f.confirmedDancerCount ?? f.dancers.length;
    const n = clampDancerCount(Math.max(1, raw));
    setCount(n);
    setLastAppliedPreset(null);
    setLastAppliedBoxItemId(null);
    onStagePreviewChange?.(null);
  }, [targetFormationId, project.formations, onStagePreviewChange]);

  const nClamped = clampDancerCount(Math.floor(count) || MIN_DANCERS_PER_FORMATION);

  const previousBodyCount = (() => {
    const f = project.formations.find((x) => x.id === targetFormationId);
    if (!f) return nClamped;
    if (f.dancers.length > 0) {
      return f.confirmedDancerCount ?? f.dancers.length;
    }
    return f.confirmedDancerCount ?? nClamped;
  })();

  /** 雛形タップで即配置 */
  const applyPreset = useCallback(
    (preset: LayoutPresetId) => {
      if (viewMode === "view") return;
      if (isDancerCountOverFreeLimit(me, nClamped)) {
        requestProUpgrade("dancer_limit");
        return;
      }
      const n = nClamped;
      const f0 = project.formations.find((x) => x.id === targetFormationId);
      const prev =
        f0 && f0.dancers.length > 0
          ? f0.confirmedDancerCount ?? f0.dancers.length
          : f0?.confirmedDancerCount ?? n;
      const rawSlots = dancersWithPresetAndWingSurplus(
        n,
        preset,
        prev,
        surplusToWings,
        {
          dancerSpacingMm: project.dancerSpacingMm,
          stageWidthMm: project.stageWidthMm,
        }
      );
      const cueUsingFormation = sortCuesByStart(project.cues).find(
        (c) => c.formationId === targetFormationId
      );
      const matchSource = resolvePreviousCueDancers(
        project.cues,
        project.formations,
        cueUsingFormation?.id ?? null
      );
      /** 一列目へ寄せた最終スロットで、前キューからの最短距離割当 */
      const slots =
        matchSource && matchSource.length > 0
          ? translateSpotsToMatchFrontRow(rawSlots, matchSource)
          : rawSlots;
      const identitySource = resolveNearestMatchSpots(
        f0?.dancers ?? [],
        matchSource
      );
      const dancers = transferDancerIdentitiesByNearestPosition(
        slots,
        identitySource
      );
      setProject((p) => ({
        ...p,
        formations: p.formations.map((f) =>
          f.id === targetFormationId ? { ...f, dancers, confirmedDancerCount: n } : f
        ),
      }));
      setLastAppliedPreset(preset);
      setLastAppliedBoxItemId(null);
      onStagePreviewChange?.(null);
      onAfterApply?.();
    },
    [
      nClamped,
      onAfterApply,
      onStagePreviewChange,
      setProject,
      viewMode,
      targetFormationId,
      surplusToWings,
      project.formations,
      project.cues,
      project.dancerSpacingMm,
      project.stageWidthMm,
      me,
      requestProUpgrade,
    ]
  );

  /** 形の箱: 現在のステージを保存 */
  const saveCurrentToBox = useCallback(() => {
    if (viewMode === "view") return;
    const f = project.formations.find((x) => x.id === targetFormationId);
    if (!f || f.dancers.length === 0) {
      window.alert("保存する立ち位置がありません。");
      return;
    }
    const suggested = `${f.dancers.length}人の形 ${
      boxItems.filter((b) => b.dancerCount === f.dancers.length).length + 1
    }`;
    const name = window.prompt(
      "形の箱に保存する名前（あとで変更可）",
      suggested
    );
    if (name === null) return;
    const result = saveFormationToBox(name.trim() || suggested, f.dancers);
    if (result.ok) {
      reloadBox();
    } else {
      window.alert(result.message);
    }
  }, [
    viewMode,
    project.formations,
    targetFormationId,
    boxItems,
    reloadBox,
  ]);

  /** 形の箱: タップで即配置 */
  const applyBoxItem = useCallback(
    (item: FormationBoxItem) => {
      if (viewMode === "view") return;
      setCount(item.dancerCount);
      const f0 = project.formations.find((x) => x.id === targetFormationId);
      const dancers = applyFormationBoxItemToStage(
        item,
        f0?.dancers ?? [],
        boxApplyMode
      );
      setProject((p) => ({
        ...p,
        formations: p.formations.map((f) =>
          f.id === targetFormationId
            ? { ...f, dancers, confirmedDancerCount: dancers.length }
            : f
        ),
      }));
      setLastAppliedBoxItemId(item.id);
      setLastAppliedPreset(null);
      onStagePreviewChange?.(null);
      onAfterApply?.();
    },
    [
      viewMode,
      setProject,
      targetFormationId,
      onStagePreviewChange,
      onAfterApply,
      project.formations,
      boxApplyMode,
    ]
  );

  const renameBoxItem = useCallback(
    (item: FormationBoxItem) => {
      const name = window.prompt("名前を変更", item.name);
      if (name === null) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      renameFormationBoxItem(item.id, trimmed);
      reloadBox();
    },
    [reloadBox]
  );

  const deleteBoxItem = useCallback(
    (item: FormationBoxItem) => {
      const ok = window.confirm(
        `「${item.name}」を形の箱から削除します。よろしいですか？`
      );
      if (!ok) return;
      deleteFormationBoxItem(item.id);
      setLastAppliedBoxItemId((id) => (id === item.id ? null : id));
      reloadBox();
    },
    [reloadBox]
  );

  /** 現在ステージで箱のアイテムを上書き */
  const overwriteBoxItem = useCallback(
    (item: FormationBoxItem) => {
      if (viewMode === "view") return;
      const f = project.formations.find((x) => x.id === targetFormationId);
      if (!f || f.dancers.length === 0) return;
      const ok = window.confirm(
        `「${item.name}」を現在のステージ（${f.dancers.length}人）で上書きします。`
      );
      if (!ok) return;
      const result = updateFormationBoxItem(item.id, f.dancers);
      if (result.ok) {
        reloadBox();
      } else {
        window.alert(result.message);
      }
    },
    [viewMode, project.formations, targetFormationId, reloadBox]
  );

  const visibleBoxItems = useMemo(() => {
    if (boxShowAllCounts) return boxItems;
    return boxItems.filter((x) => x.dancerCount === nClamped);
  }, [boxItems, boxShowAllCounts, nClamped]);

  const floatingFrame =
    variant === "floating"
      ? {
          position: "fixed" as const,
          zIndex: 45,
          top: 72,
          right: 12,
          width: "min(400px, calc(100vw - 24px))",
          maxHeight: "calc(100vh - 88px)",
          borderRadius: "12px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.55)",
        }
      : {
          position: "relative" as const,
          zIndex: 1,
          width: "100%",
          flex: "1 1 0",
          minHeight: 0,
          maxHeight: "100%",
          marginTop: 0,
          borderRadius: "10px",
          boxShadow: "none",
        };

  return (
    <aside
      data-formation-suggestion-panel
      data-variant={variant}
      role="complementary"
      aria-label="フォーメーション案"
      style={{
        ...floatingFrame,
        display: "flex",
        flexDirection: "column",
        border: "1px solid #334155",
        background: "#0f172a",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: "10px 12px",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "10px",
        }}
      >
        <div>
          <h3
            style={{
              margin: "0 0 4px",
              fontSize: "14px",
              fontWeight: 700,
              color: "#e2e8f0",
            }}
          >
            フォーメーション案
          </h3>
          <p style={{ margin: 0, fontSize: "11px", color: "#64748b", lineHeight: 1.45 }}>
            上で人数を決め、下のカードをタップすると
            {variant === "embedded" ? "上のステージ" : "左のステージ"}
            にすぐ配置されます。
          </p>
        </div>
        <button
          type="button"
          style={{ ...btnSecondary, padding: "4px 10px", fontSize: "12px", flexShrink: 0 }}
          onClick={onClose}
          aria-label="フォーメーション案を閉じる"
        >
          閉じる
        </button>
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: "8px 12px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px",
          borderBottom: "1px solid #1e293b",
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "#94a3b8",
          }}
        >
          人数
          <input
            type="number"
            min={MIN_DANCERS_PER_FORMATION}
            max={MAX_DANCERS_PER_FORMATION}
            value={count}
            disabled={viewMode === "view"}
            onChange={(e) => {
              const next = clampDancerCount(Number(e.target.value));
              if (isDancerCountOverFreeLimit(me, next)) {
                requestProUpgrade("dancer_limit");
                return;
              }
              setCount(next);
            }}
            style={{
              width: "56px",
              padding: "4px 6px",
              borderRadius: "6px",
              border: "1px solid #475569",
              background: "#020617",
              color: "#e2e8f0",
              fontSize: "13px",
            }}
          />
        </label>
          <span style={{ fontSize: "11px", color: "#64748b" }}>
          反映時 {nClamped} 人分で上書きします
        </span>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11px",
            color: "#94a3b8",
            cursor: viewMode === "view" ? "not-allowed" : "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={surplusToWings}
            disabled={viewMode === "view"}
            onChange={(e) => setSurplusToWings(e.target.checked)}
          />
          §6 余りを袖へ（増員時のみメイン人数ぶんをプリセット）
        </label>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "10px 10px 12px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* §6 形の箱: ユーザが保存した立ち位置（端末横断・無期限） */}
        <div
          style={{
            marginBottom: 12,
            padding: "8px 8px 10px",
            border: "1px solid #1e293b",
            borderRadius: "10px",
            background: "#0b1220",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#cbd5e1",
                letterSpacing: "0.04em",
              }}
            >
              形の箱
            </span>
            <span style={{ fontSize: "10px", color: "#64748b" }}>
              {boxShowAllCounts
                ? `全 ${boxItems.length} 件`
                : `${nClamped}人の形 ${visibleBoxItems.length} 件 / 全 ${boxItems.length} 件`}
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  padding: "3px 8px",
                  fontSize: "11px",
                }}
                onClick={() => setBoxShowAllCounts((v) => !v)}
                title="現在人数でフィルタ／すべて表示を切替"
              >
                {boxShowAllCounts ? "現人数のみ" : "すべて表示"}
              </button>
              <button
                type="button"
                style={{
                  ...btnPrimary,
                  padding: "3px 10px",
                  fontSize: "11px",
                }}
                disabled={viewMode === "view"}
                onClick={saveCurrentToBox}
                title="いまのステージの立ち位置を箱に保存"
              >
                現在を保存
              </button>
            </div>
          </div>
          <div
            role="radiogroup"
            aria-label="保存データの引き継ぎ方"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 8,
            }}
          >
            {FORMATION_BOX_APPLY_MODE_OPTIONS.map((opt) => {
              const active = boxApplyMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={opt.hint}
                  onClick={() => setBoxApplyMode(opt.value)}
                  style={{
                    ...btnSecondary,
                    padding: "3px 8px",
                    fontSize: "11px",
                    borderColor: active ? "#d4af37" : undefined,
                    background: active ? "rgba(212,175,55,0.2)" : undefined,
                    color: active ? "#fef3c7" : undefined,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {visibleBoxItems.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              {boxItems.length === 0
                ? "まだ形の箱は空です。ステージで並べた立ち位置を「現在を保存」で残しておくと、別のプロジェクトからでも呼び出せます。"
                : `この人数の形はまだありません。「すべて表示」で他人数の形も見られます。`}
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: "6px",
              }}
            >
              {visibleBoxItems.map((item) => {
                const selected = lastAppliedBoxItemId === item.id;
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      padding: "6px 6px 5px",
                      borderRadius: "8px",
                      border: selected
                        ? "1px solid #38bdf8"
                        : "1px solid #1e293b",
                      background: selected ? "#0c2942" : "#020617",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => applyBoxItem(item)}
                      disabled={viewMode === "view"}
                      aria-pressed={selected}
                      title={`${item.name}（${item.dancerCount}人）・タップで配置`}
                      style={{
                        appearance: "none",
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        cursor: viewMode === "view" ? "not-allowed" : "pointer",
                        color: selected ? "#bae6fd" : "#cbd5e1",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        alignItems: "stretch",
                        textAlign: "left",
                      }}
                    >
                      <FormationBoxItemThumb item={item} width={120} />
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          lineHeight: 1.3,
                          color: "inherit",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#64748b",
                        }}
                      >
                        {item.dancerCount}人
                      </span>
                    </button>
                    <div
                      style={{
                        display: "flex",
                        gap: 3,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        style={{
                          ...btnPrimary,
                          padding: "2px 7px",
                          fontSize: "10px",
                          flex: "1 1 auto",
                        }}
                        disabled={viewMode === "view"}
                        onClick={() => applyBoxItem(item)}
                      >
                        反映
                      </button>
                      <button
                        type="button"
                        style={{
                          ...btnSecondary,
                          padding: "2px 6px",
                          fontSize: "10px",
                        }}
                        disabled={viewMode === "view"}
                        onClick={() => overwriteBoxItem(item)}
                        title="現在のステージで上書き保存"
                      >
                        上書
                      </button>
                      <button
                        type="button"
                        style={{
                          ...btnSecondary,
                          padding: "2px 6px",
                          fontSize: "10px",
                        }}
                        onClick={() => renameBoxItem(item)}
                        title="名前を変更"
                      >
                        改名
                      </button>
                      <button
                        type="button"
                        style={{
                          ...btnSecondary,
                          padding: "2px 6px",
                          fontSize: "10px",
                          color: "#f87171",
                        }}
                        onClick={() => deleteBoxItem(item)}
                        title="削除"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))",
            gap: "8px",
          }}
        >
          {LAYOUT_PRESET_OPTIONS.map((opt, i) => {
            const selected = lastAppliedPreset === opt.id;
            return (
              <Fragment key={opt.id}>
                {i === 0 ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#64748b",
                      letterSpacing: "0.06em",
                      padding: "2px 2px 4px",
                    }}
                  >
                    ピラミッド・段
                  </div>
                ) : null}
                {opt.id === "line" ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#64748b",
                      letterSpacing: "0.06em",
                      padding: "10px 2px 4px",
                      borderTop: "1px solid #1e293b",
                      marginTop: 4,
                    }}
                  >
                    定番の形
                  </div>
                ) : null}
                {opt.id === "scatter" ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#64748b",
                      letterSpacing: "0.06em",
                      padding: "10px 2px 4px",
                      borderTop: "1px solid #1e293b",
                      marginTop: 4,
                    }}
                  >
                    個性的な形
                  </div>
                ) : null}
                <button
                  type="button"
                  aria-pressed={selected}
                  disabled={viewMode === "view"}
                  onClick={() => applyPreset(opt.id)}
                  title={`${opt.label}・タップで配置`}
                  style={{
                    ...(selected ? btnPrimary : btnSecondary),
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: "6px",
                    padding: "8px",
                    textAlign: "left",
                    minHeight: "88px",
                    borderRadius: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: selected ? "#f8fafc" : "#cbd5e1",
                    }}
                  >
                    <FormationPresetThumb preset={opt.id} width={40} />
                    <span style={{ fontSize: "12px", fontWeight: 600, lineHeight: 1.3 }}>
                      {opt.label}
                    </span>
                  </div>
                  <span style={{ fontSize: "10px", opacity: 0.85, lineHeight: 1.35 }}>
                    客席は下側。番号は左から順に割り当て
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
      </div>

    </aside>
  );
}
