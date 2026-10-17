import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { ChoreographyProjectJson, Cue, DancerSpot } from "../types/choreography";
import {
  cloneFormationForNewCue,
  resolveCueIntervalNonOverlap,
  sortCuesByStart,
} from "../lib/cueInterval";
import {
  DEFAULT_CUE_SPAN_WITH_AUDIO_SEC,
  MIN_CUE_DURATION_SEC,
  trimHiSecForCueTimeline,
} from "../core/timelineController";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import { formatMmSsFloor } from "../lib/timeFormat";
import {
  PRESET_CATEGORIES,
  type LayoutPresetId,
} from "../lib/formationLayouts";
import {
  applyLayoutPresetToTargetDancers,
  resolveChangeTargetIds,
} from "../lib/applyLayoutPresetToSelection";
import { useStageBoardInteractionStore } from "../store/stage/stageBoardInteractionStore";
import {
  countPresetsAboveTierFrom,
  DEFAULT_UI_PRESET_MAX_TIER,
  getPresetTier,
} from "../lib/formationPresetTiers";
import {
  firstPresetIdInCategories,
  splitClassicPresetCategories,
  useFormationPresetCategoryPreviews,
} from "../hooks/useFormationPresetCategoryPreviews";
import { FormationPresetTierToggle } from "./FormationPresetTierToggle";
import {
  FormationPresetFavoriteStar,
  FormationPresetFavoritesFilter,
} from "./FormationPresetFavoriteControls";
import { EditorSideSheet } from "./EditorSideSheet";
import { useFormationPresetFavorites } from "../hooks/useFormationPresetFavorites";
import { filterPresetItemsByFavorites } from "../lib/formationPresetFavorites";
import {
  applyFormationBoxItemToStage,
  FORMATION_BOX_APPLY_MODE_OPTIONS,
  FORMATION_BOX_CHANGE_EVENT,
  listFormationBoxItems,
  type FormationBoxApplyMode,
  type FormationBoxItem,
} from "../lib/formationBox";
import { FormationBoxItemThumb } from "./FormationBoxItemThumb";

type PickerSourceTab = "preset" | "box";

type Props = {
  open: boolean;
  onClose: () => void;
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  selectedCueId?: string | null;
  onStagePreviewChange?: (dancers: DancerSpot[] | null) => void;
  /** 再生位置にキューが無いとき、適用で新規キューを作った直後に呼ぶ */
  onCueCreated?: (cueId: string) => void;
};

function SpotThumb({
  dancers,
  large = false,
}: {
  dancers: { xPct: number; yPct: number }[];
  large?: boolean;
}) {
  const radius = dancers.length >= 12 ? 2.4 : dancers.length >= 6 ? 3.0 : 3.4;
  return (
    <svg
      viewBox="0 0 100 60"
      width={large ? 72 : 44}
      height={large ? 44 : 26}
      aria-hidden
      className={large ? "formation-preset-picker-thumb formation-preset-picker-thumb--large" : "formation-preset-picker-thumb"}
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

function usePortraitMobileShell(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const read = () =>
      setActive(
        typeof document !== "undefined" &&
          document.querySelector("[data-shell-portrait]") != null
      );
    read();
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, []);
  return active;
}

function useLandscapeMobileShell(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const read = () =>
      setActive(
        typeof document !== "undefined" &&
          document.querySelector("[data-shell-landscape]") != null
      );
    read();
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, []);
  return active;
}

export function FormationPresetPickerSheet({
  open,
  onClose,
  project,
  setProject,
  selectedCueId,
  onStagePreviewChange,
  onCueCreated,
}: Props) {
  const playheadSec = usePlaybackUiStore((s) =>
    open ? Math.round(s.currentTimeSec * 100) / 100 : 0
  );
  /** 赤い再生位置がどのキューの範囲にも入っていなければ、適用時にそこへ新規キューを作る */
  const createCueAtPlayhead = useMemo(
    () =>
      !project.cues.some(
        (c) => playheadSec >= c.tStartSec - 1e-6 && playheadSec <= c.tEndSec + 1e-6
      ),
    [project.cues, playheadSec]
  );
  const targetFormationId = useMemo(() => {
    if (selectedCueId) {
      const cue = project.cues.find((c) => c.id === selectedCueId);
      if (cue?.formationId) return cue.formationId;
    }
    return project.activeFormationId;
  }, [project.cues, project.activeFormationId, selectedCueId]);

  const targetFormation = useMemo(
    () =>
      targetFormationId
        ? project.formations.find((f) => f.id === targetFormationId) ?? null
        : null,
    [project.formations, targetFormationId]
  );

  /**
   * Change 適用時の「前の立ち位置」参照。
   * 直前キューのフォーメーションがあればそちらを優先（複製キューへ雛形を載せる用途）。
   * なければ編集中フォーメーション自体を使う。
   */
  const nearestMatchSource = useMemo((): DancerSpot[] => {
    if (createCueAtPlayhead) {
      const before = sortCuesByStart(project.cues).filter(
        (c) => c.tEndSec <= playheadSec + 1e-6
      );
      const prev = before[before.length - 1];
      const prevF = prev
        ? project.formations.find((f) => f.id === prev.formationId)
        : null;
      if (prevF && prevF.dancers.length > 0) return prevF.dancers;
    } else if (selectedCueId) {
      const sorted = sortCuesByStart(project.cues);
      const idx = sorted.findIndex((c) => c.id === selectedCueId);
      if (idx > 0) {
        const prev = sorted[idx - 1]!;
        const prevF = project.formations.find((f) => f.id === prev.formationId);
        if (prevF && prevF.dancers.length > 0) return prevF.dancers;
      }
    }
    return targetFormation?.dancers ?? [];
  }, [
    project.cues,
    project.formations,
    selectedCueId,
    targetFormation,
    createCueAtPlayhead,
    playheadSec,
  ]);

  const selectedDancerIds = useStageBoardInteractionStore(
    (s) => s.selectedDancerIds
  );
  const formationDancerIds = useMemo(
    () => targetFormation?.dancers.map((d) => d.id) ?? [],
    [targetFormation]
  );
  const targetIds = useMemo(
    () => resolveChangeTargetIds(formationDancerIds, selectedDancerIds),
    [formationDancerIds, selectedDancerIds]
  );
  const isSubsetApply =
    Boolean(targetFormation) &&
    targetIds.length >= 2 &&
    targetIds.length < (targetFormation?.dancers.length ?? 0);
  const count = Math.max(1, targetIds.length || targetFormation?.dancers.length || 1);
  const [selectedPresetId, setSelectedPresetId] = useState<LayoutPresetId | null>(
    null
  );
  const [sourceTab, setSourceTab] = useState<PickerSourceTab>("preset");
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [boxApplyMode, setBoxApplyMode] =
    useState<FormationBoxApplyMode>("positions");
  const [boxRev, setBoxRev] = useState(0);
  const [showAllBoxCounts, setShowAllBoxCounts] = useState(false);
  const [showAllTiers, setShowAllTiers] = useState(false);
  /** true = 定番の提案のみ（BASIC タブ）。初期は全カテゴリ表示 */
  const [basicTab, setBasicTab] = useState(false);
  const {
    favoriteSet,
    favoriteCount,
    isFavorite,
    toggleFavorite,
    favoritesOnly,
    setFavoritesOnly,
    toggleFavoritesOnly,
  } = useFormationPresetFavorites();
  const wasOpenRef = useRef(false);
  const portraitMobileShell = usePortraitMobileShell();
  const landscapeMobileShell = useLandscapeMobileShell();
  const portraitFullscreen = open && portraitMobileShell;
  const landscapeHorizontal = open && landscapeMobileShell && !portraitMobileShell;
  /** 波形表示中でも隠して構わないので、横画面では常に画面いっぱいに大きく表示する */
  const landscapeFullscreen = landscapeHorizontal;

  const spacingOpts = useMemo(
    () => ({
      dancerSpacingMm: project.dancerSpacingMm ?? undefined,
      stageWidthMm: project.stageWidthMm ?? undefined,
    }),
    [project.dancerSpacingMm, project.stageWidthMm]
  );

  const presetCategoryPreviews = useFormationPresetCategoryPreviews(
    count,
    spacingOpts,
    showAllTiers
  );

  const visiblePresetCategories = useMemo(() => {
    const filtered = filterPresetItemsByFavorites(
      presetCategoryPreviews,
      favoriteSet,
      favoritesOnly
    );
    const { classic, catalog } = splitClassicPresetCategories(filtered);
    if (basicTab) {
      return classic && classic.items.length > 0 ? [classic] : [];
    }
    return catalog;
  }, [presetCategoryPreviews, favoriteSet, favoritesOnly, basicTab]);

  const hiddenTierCount = useMemo(
    () => countPresetsAboveTierFrom(PRESET_CATEGORIES, DEFAULT_UI_PRESET_MAX_TIER),
    []
  );

  useEffect(() => {
    if (!open) return;
    const onBoxChanged = () => setBoxRev((n) => n + 1);
    window.addEventListener(FORMATION_BOX_CHANGE_EVENT, onBoxChanged);
    return () =>
      window.removeEventListener(FORMATION_BOX_CHANGE_EVENT, onBoxChanged);
  }, [open]);

  const allBoxItems = useMemo(
    () => listFormationBoxItems(),
    [boxRev, open]
  );

  /** 現在人数に合う保存形を優先。無ければ全件（空にしない） */
  const boxItems = useMemo((): FormationBoxItem[] => {
    if (showAllBoxCounts) return allBoxItems;
    const matched = allBoxItems.filter((it) => it.dancerCount === count);
    return matched.length > 0 ? matched : allBoxItems;
  }, [allBoxItems, showAllBoxCounts, count]);

  const selectedBoxItem = useMemo(
    () =>
      selectedBoxId
        ? allBoxItems.find((b) => b.id === selectedBoxId) ?? null
        : null,
    [allBoxItems, selectedBoxId]
  );

  const previewDancers = useMemo(() => {
    if (!targetFormation) return null;
    if (sourceTab === "box") {
      if (!selectedBoxItem) return null;
      const stage =
        nearestMatchSource.length > 0
          ? nearestMatchSource
          : targetFormation.dancers;
      return applyFormationBoxItemToStage(
        selectedBoxItem,
        stage,
        boxApplyMode
      );
    }
    if (!selectedPresetId) return null;
    return applyLayoutPresetToTargetDancers(
      targetFormation.dancers,
      targetIds,
      selectedPresetId,
      spacingOpts,
      nearestMatchSource
    );
  }, [
    targetFormation,
    targetIds,
    selectedPresetId,
    selectedBoxItem,
    sourceTab,
    boxApplyMode,
    spacingOpts,
    nearestMatchSource,
  ]);

  const closeAndCleanup = useCallback(() => {
    onStagePreviewChange?.(null);
    onClose();
  }, [onClose, onStagePreviewChange]);

  const selectSourceTab = useCallback((tab: PickerSourceTab) => {
    setSourceTab(tab);
    if (tab === "preset") {
      setSelectedBoxId(null);
    } else {
      setSelectedPresetId(null);
    }
  }, []);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setShowAllTiers(false);
      setFavoritesOnly(false);
      setBasicTab(false);
      setSelectedPresetId(null);
      setSelectedBoxId(null);
      setSourceTab("preset");
      setBoxApplyMode("positions");
      setShowAllBoxCounts(false);
      setBoxRev((n) => n + 1);
    }
    wasOpenRef.current = open;
    if (!open) {
      setSelectedPresetId(null);
      setSelectedBoxId(null);
      setSourceTab("preset");
      setBoxApplyMode("positions");
      setShowAllTiers(false);
      setFavoritesOnly(false);
      setBasicTab(false);
      setShowAllBoxCounts(false);
    }
  }, [open, setFavoritesOnly]);

  useEffect(() => {
    if (!open || sourceTab !== "preset" || !selectedPresetId) return;
    const maxTier = showAllTiers ? 3 : DEFAULT_UI_PRESET_MAX_TIER;
    const stillVisible = visiblePresetCategories.some((cat) =>
      cat.items.some((item) => item.id === selectedPresetId)
    );
    if (
      (!basicTab && getPresetTier(selectedPresetId) > maxTier) ||
      !stillVisible
    ) {
      setSelectedPresetId(firstPresetIdInCategories(visiblePresetCategories));
    }
  }, [
    open,
    showAllTiers,
    selectedPresetId,
    visiblePresetCategories,
    basicTab,
    sourceTab,
  ]);

  useEffect(() => {
    if (!open) return;
    onStagePreviewChange?.(previewDancers);
  }, [open, previewDancers, onStagePreviewChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeAndCleanup();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true } as EventListenerOptions);
  }, [open, closeAndCleanup]);

  const apply = useCallback(() => {
    const canApplyPreset = sourceTab === "preset" && selectedPresetId;
    const canApplyBox = sourceTab === "box" && selectedBoxItem;
    if (!targetFormation || !previewDancers || (!canApplyPreset && !canApplyBox))
      return;
    /** プレビューは既に applyMode 反映済み。適用先の現行メンバーへ再マージして id を安定させる */
    const dancersToWrite =
      sourceTab === "box" && selectedBoxItem
        ? applyFormationBoxItemToStage(
            selectedBoxItem,
            targetFormation.dancers,
            boxApplyMode
          )
        : previewDancers;
    if (createCueAtPlayhead) {
      const newCueId = crypto.randomUUID();
      const build = (p: ChoreographyProjectJson): ChoreographyProjectJson | null => {
        if (p.cues.length >= 100) return null;
        const src = p.formations.find((f) => f.id === targetFormation.id);
        if (!src) return null;
        const newFm = {
          ...cloneFormationForNewCue(src),
          dancers: dancersToWrite.map((d) => ({ ...d })),
          confirmedDancerCount: dancersToWrite.length,
        };
        const trimLo = p.trimStartSec;
        const trimHi = trimHiSecForCueTimeline(
          p.trimEndSec,
          usePlaybackUiStore.getState().durationSec
        );
        const t0 = Math.max(
          trimLo,
          Math.min(trimHi - MIN_CUE_DURATION_SEC, playheadSec)
        );
        const { tStartSec, tEndSec } = resolveCueIntervalNonOverlap(
          p.cues,
          newCueId,
          t0,
          Math.min(trimHi, t0 + DEFAULT_CUE_SPAN_WITH_AUDIO_SEC),
          trimLo,
          trimHi
        );
        if (!(tEndSec > tStartSec)) return null;
        const cue: Cue = {
          id: newCueId,
          tStartSec,
          tEndSec,
          formationId: newFm.id,
        };
        return {
          ...p,
          formations: [...p.formations, newFm],
          cues: sortCuesByStart([...p.cues, cue]),
          activeFormationId: newFm.id,
        };
      };
      if (build(project)) {
        setProject((p) => build(p) ?? p);
        onCueCreated?.(newCueId);
        closeAndCleanup();
        return;
      }
    }
    setProject((p) => ({
      ...p,
      formations: p.formations.map((f) =>
        f.id === targetFormation.id
          ? {
              ...f,
              dancers: dancersToWrite,
              confirmedDancerCount: dancersToWrite.length,
            }
          : f
      ),
    }));
    closeAndCleanup();
  }, [
    targetFormation,
    selectedPresetId,
    selectedBoxItem,
    sourceTab,
    boxApplyMode,
    previewDancers,
    setProject,
    closeAndCleanup,
    createCueAtPlayhead,
    playheadSec,
    onCueCreated,
    project,
  ]);

  const cueLabel = useMemo(() => {
    if (!selectedCueId) return null;
    const cue = project.cues.find((c) => c.id === selectedCueId);
    return cue?.label ?? null;
  }, [project.cues, selectedCueId]);

  const noTarget = !targetFormation;

  const untouchedCount = (targetFormation?.dancers.length ?? 0) - targetIds.length;
  const subtitle = noTarget
    ? "適用先のフォーメーションがありません"
    : sourceTab === "box"
      ? selectedBoxItem
        ? `保存「${selectedBoxItem.name || `${selectedBoxItem.dancerCount}人`}」を${
            boxApplyMode === "positions" ? "位置のみ" : "データすべて"
          }で適用`
        : `保存した立ち位置から選ぶ（いま ${count} 人）・引き継ぎは下で選択`
      : createCueAtPlayhead
      ? `再生位置 ${formatMmSsFloor(playheadSec)} に新しいキューとして追加（${
          targetFormation?.dancers.length ?? count
        } 人）`
      : isSubsetApply
      ? `選択中の ${targetIds.length} 人に反映（他の ${untouchedCount} 人はそのまま）`
      : cueLabel
        ? `「${cueLabel}」に反映（${count} 人）`
        : `現在のフォーメーションに反映（${count} 人）`;

  /** スマホ全画面: フッター固定。PC: ヘッダー下 sticky */
  const actionsDocked = portraitFullscreen || landscapeHorizontal;

  const sourceTabControls = (
    <div
      role="tablist"
      aria-label="雛形または保存した立ち位置"
      style={{ display: "flex", gap: 4, flexShrink: 0 }}
    >
      <button
        type="button"
        role="tab"
        aria-selected={sourceTab === "preset"}
        onClick={() => selectSourceTab("preset")}
        style={{
          ...sourceTabBtnStyle,
          ...(sourceTab === "preset" ? sourceTabBtnActiveStyle : null),
        }}
      >
        雛形
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={sourceTab === "box"}
        onClick={() => selectSourceTab("box")}
        title="立ち位置保存で入れた形の箱から選ぶ"
        style={{
          ...sourceTabBtnStyle,
          ...(sourceTab === "box" ? sourceTabBtnActiveStyle : null),
        }}
      >
        保存
        {allBoxItems.length > 0 ? (
          <span style={{ opacity: 0.75, fontWeight: 600 }}>
            {" "}
            {allBoxItems.length}
          </span>
        ) : null}
      </button>
    </div>
  );

  const filterControls = (
    <>
      {sourceTabControls}
      {sourceTab === "preset" ? (
        <>
          <button
            type="button"
            onClick={() => setBasicTab((v) => !v)}
            aria-pressed={basicTab}
            title={
              basicTab ? "すべての雛形カテゴリを表示" : "定番の提案だけを表示"
            }
            style={{
              ...basicTabBtnStyle,
              ...(basicTab ? basicTabBtnActiveStyle : null),
              flexShrink: 0,
            }}
          >
            BASIC
          </button>
          <FormationPresetFavoritesFilter
            active={favoritesOnly}
            onToggle={toggleFavoritesOnly}
            count={favoriteCount}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setShowAllBoxCounts((v) => !v)}
          aria-pressed={showAllBoxCounts}
          title={
            showAllBoxCounts
              ? `${count}人の保存だけ表示`
              : "人数を問わずすべての保存を表示"
          }
          style={{
            ...basicTabBtnStyle,
            ...(showAllBoxCounts ? basicTabBtnActiveStyle : null),
            flexShrink: 0,
          }}
        >
          {showAllBoxCounts ? "全員数" : `${count}人`}
        </button>
      )}
    </>
  );

  const applyDisabled =
    noTarget ||
    (sourceTab === "preset" ? !selectedPresetId : !selectedBoxItem);

  const footerActions = (
    <div
      role="group"
      aria-label="立ち位置雛形の操作"
      className={
        actionsDocked
          ? "formation-preset-picker-footer"
          : "formation-preset-picker-actions-sticky"
      }
    >
      {!actionsDocked ? filterControls : null}
      {!actionsDocked ? <span style={{ flex: 1, minWidth: 8 }} aria-hidden /> : null}
      <button
        type="button"
        onClick={closeAndCleanup}
        className="formation-preset-picker-footer-cancel"
        style={actionsDocked ? undefined : cancelBtnCompactStyle}
      >
        閉じる
      </button>
      <button
        type="button"
        onClick={apply}
        disabled={applyDisabled}
        className="formation-preset-picker-footer-apply"
        style={
          actionsDocked
            ? undefined
            : {
                ...applyBtnCompactStyle,
                opacity: applyDisabled ? 0.45 : 1,
                cursor: applyDisabled ? "not-allowed" : "pointer",
              }
        }
      >
        適用
      </button>
    </div>
  );

  // 横画面はドック表示・波形たたみ表示のどちらも同じ大きな正方グリッドを使い、見やすさを揃える
  const useBigGrid = portraitFullscreen || landscapeHorizontal;

  const mobileToolbar = actionsDocked ? (
    <div className="formation-preset-picker-mobile-toolbar">
      {filterControls}
      <span style={{ flex: 1, minWidth: 4 }} aria-hidden />
      {sourceTab === "preset" ? (
        <FormationPresetTierToggle
          showAll={showAllTiers}
          onToggle={() => setShowAllTiers((v) => !v)}
          hiddenCount={hiddenTierCount}
          style={{
            flexShrink: 0,
            visibility: basicTab ? "hidden" : "visible",
            pointerEvents: basicTab ? "none" : "auto",
          }}
        />
      ) : null}
    </div>
  ) : null;

  const emptyHintStyle: CSSProperties = {
    padding: "24px 12px",
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
  };

  const boxApplyModePicker = (
    <div
      role="radiogroup"
      aria-label="保存データの引き継ぎ方"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #334155",
        background: "rgba(15,23,42,0.75)",
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "#cbd5e1" }}>
        引き継ぐ内容
      </div>
      {FORMATION_BOX_APPLY_MODE_OPTIONS.map((opt) => {
        const active = boxApplyMode === opt.value;
        return (
          <label
            key={opt.value}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              cursor: "pointer",
              fontSize: 12,
              color: "#e2e8f0",
            }}
          >
            <input
              type="radio"
              name="formation-box-apply-mode"
              checked={active}
              onChange={() => setBoxApplyMode(opt.value)}
              style={{ marginTop: 2 }}
            />
            <span>
              <strong>{opt.label}</strong>
              <span style={{ display: "block", color: "#94a3b8", fontSize: 11, marginTop: 2 }}>
                {opt.hint}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );

  const boxGrid = (
    <div
      className={
        useBigGrid
          ? "formation-preset-picker-sheet-body formation-preset-picker-sheet-body--portrait-full"
          : "formation-preset-picker-sheet-body"
      }
      style={
        useBigGrid
          ? undefined
          : {
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }
      }
    >
      {allBoxItems.length === 0 ? (
        <div style={emptyHintStyle}>
          保存した立ち位置はまだありません。
          <br />
          ステージの「立ち位置保存」から形の箱へ入れてください。
        </div>
      ) : (
        <>
      {boxApplyModePicker}
      {boxItems.length === 0 ? (
        <div style={emptyHintStyle}>表示できる保存がありません。</div>
      ) : (
        <div className="formation-preset-picker-category">
          <div
            className="formation-preset-picker-category-heading"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#94a3b8",
              marginBottom: 8,
            }}
          >
            形の箱
            {!showAllBoxCounts &&
            allBoxItems.some((b) => b.dancerCount === count)
              ? `（${count}人）`
              : `（全${allBoxItems.length}件）`}
          </div>
          <div
            className={
              useBigGrid
                ? "add-cue-preset-grid formation-preset-picker-grid formation-preset-picker-grid--large"
                : "add-cue-preset-grid formation-preset-picker-grid"
            }
          >
            {boxItems.map((item) => {
              const active = selectedBoxId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="add-cue-preset-btn formation-preset-picker-preset-btn"
                  disabled={noTarget}
                  onClick={() => setSelectedBoxId(item.id)}
                  title={`${item.name || "無題"}（${item.dancerCount}人）`}
                  style={{
                    ...presetBtnStyle,
                    position: "relative",
                    border: active ? "2px solid #d4af37" : presetBtnStyle.border,
                    background: active
                      ? "rgba(212,175,55,0.15)"
                      : presetBtnStyle.background,
                    boxShadow: active
                      ? "0 0 0 1px rgba(212,175,55,0.35)"
                      : "none",
                    opacity: noTarget ? 0.45 : 1,
                    cursor: noTarget ? "not-allowed" : "pointer",
                  }}
                >
                  <FormationBoxItemThumb
                    item={item}
                    width={useBigGrid ? 72 : 44}
                  />
                  <span className="add-cue-preset-label formation-preset-picker-preset-label">
                    {item.name || `${item.dancerCount}人`}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      color: "#64748b",
                      fontWeight: 600,
                    }}
                  >
                    {item.dancerCount}人
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );

  const presetGrid = (
    <div
      className={
        useBigGrid
          ? "formation-preset-picker-sheet-body formation-preset-picker-sheet-body--portrait-full"
          : "formation-preset-picker-sheet-body"
      }
      style={
        useBigGrid
          ? undefined
          : {
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }
      }
    >
      {visiblePresetCategories.length === 0 ? (
        <div style={emptyHintStyle}>
          {favoritesOnly
            ? "お気に入りの雛形がありません。☆を押して追加できます。"
            : basicTab
              ? "定番の提案がありません。"
              : "表示できる雛形がありません。"}
        </div>
      ) : (
        visiblePresetCategories.map((cat) => (
        <div key={cat.label} className="formation-preset-picker-category">
          {basicTab ? null : (
          <div
            className="formation-preset-picker-category-heading"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 6,
            }}
          >
            <div className="add-cue-preset-category formation-preset-picker-category-label">
              {cat.label}
            </div>
          </div>
          )}
          {basicTab ? (
            <div
              className="add-cue-preset-category formation-preset-picker-category-label"
              style={{ marginBottom: 6 }}
            >
              定番の提案
            </div>
          ) : null}
          <div
            className={
              useBigGrid ? "formation-preset-picker-grid" : "add-cue-preset-grid"
            }
          >
            {cat.items.map((item) => {
              const active = selectedPresetId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="add-cue-preset-btn formation-preset-picker-preset-btn"
                  disabled={noTarget}
                  onClick={() => setSelectedPresetId(item.id)}
                  title={item.label}
                  style={{
                    ...presetBtnStyle,
                    position: "relative",
                    border: active ? "2px solid #d4af37" : presetBtnStyle.border,
                    background: active
                      ? "rgba(212,175,55,0.15)"
                      : presetBtnStyle.background,
                    boxShadow: active ? "0 0 0 1px rgba(212,175,55,0.35)" : "none",
                    opacity: noTarget ? 0.45 : 1,
                    cursor: noTarget ? "not-allowed" : "pointer",
                  }}
                >
                  <SpotThumb dancers={item.dancers} large={useBigGrid} />
                  <span className="add-cue-preset-label formation-preset-picker-preset-label">
                    {item.label}
                  </span>
                  <FormationPresetFavoriteStar
                    active={isFavorite(item.id)}
                    onToggle={() => toggleFavorite(item.id)}
                    disabled={noTarget}
                  />
                </button>
              );
            })}
          </div>
        </div>
        ))
      )}
    </div>
  );

  const pickerTitle =
    sourceTab === "box" ? "保存した立ち位置" : "立ち位置の雛形";

  const sheetHeader = (
    <div className="formation-preset-picker-sheet-header">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "10px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 id="formation-preset-picker-title">{pickerTitle}</h2>
          <p>{subtitle}</p>
        </div>
        {actionsDocked || sourceTab === "box" ? null : (
          <FormationPresetTierToggle
            showAll={showAllTiers}
            onToggle={() => setShowAllTiers((v) => !v)}
            hiddenCount={hiddenTierCount}
            style={{
              flexShrink: 0,
              marginTop: 2,
              visibility: basicTab ? "hidden" : "visible",
              pointerEvents: basicTab ? "none" : "auto",
            }}
          />
        )}
      </div>
    </div>
  );

  const pickerBody = sourceTab === "box" ? boxGrid : presetGrid;

  if (!open) return null;

  if (landscapeHorizontal && typeof document !== "undefined") {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="formation-preset-picker-title"
        data-editor-sheet="formation-preset-picker"
        className={
          landscapeFullscreen
            ? "formation-preset-picker-landscape-fullscreen"
            : "formation-preset-picker-landscape-dock"
        }
      >
        {sheetHeader}
        {mobileToolbar}
        {pickerBody}
        {footerActions}
      </div>,
      document.body
    );
  }

  if (portraitFullscreen && typeof document !== "undefined") {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="formation-preset-picker-title"
        data-editor-sheet="formation-preset-picker"
        className="formation-preset-picker-fullscreen"
      >
        {sheetHeader}
        {mobileToolbar}
        {pickerBody}
        {footerActions}
      </div>,
      document.body
    );
  }

  return (
    <EditorSideSheet
      open={open}
      onClose={closeAndCleanup}
      zIndex={200}
      width="min(360px, 92vw)"
      ariaLabelledBy="formation-preset-picker-title"
      sheetId="formation-preset-picker"
    >
      <div
        className="formation-preset-picker-sheet"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: "100%",
          overflow: "hidden",
          color: "#e2e8f0",
        }}
      >
        <div
          className="formation-preset-picker-sheet-header"
          style={{
            flexShrink: 0,
            padding: "14px 16px 10px",
            borderBottom: "1px solid rgba(212,175,55,0.2)",
            background: "#07090f",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "10px",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2
                id="formation-preset-picker-title"
                style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}
              >
                {pickerTitle}
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#94a3b8", lineHeight: 1.45 }}>
                {subtitle}
              </p>
            </div>
            {sourceTab === "preset" ? (
              <FormationPresetTierToggle
                showAll={showAllTiers}
                onToggle={() => setShowAllTiers((v) => !v)}
                hiddenCount={hiddenTierCount}
                style={{
                  flexShrink: 0,
                  marginTop: 2,
                  visibility: basicTab ? "hidden" : "visible",
                  pointerEvents: basicTab ? "none" : "auto",
                }}
              />
            ) : null}
          </div>
        </div>
        {footerActions}
        {pickerBody}
      </div>
    </EditorSideSheet>
  );
}

const presetBtnStyle: CSSProperties = {
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#0a0f1e",
  color: "#e2e8f0",
  cursor: "pointer",
};

const cancelBtnCompactStyle: CSSProperties = {
  padding: "6px 12px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "rgba(15,23,42,0.94)",
  color: "#cbd5e1",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const applyBtnCompactStyle: CSSProperties = {
  padding: "6px 14px",
  borderRadius: "8px",
  border: "1px solid #d4af37",
  background: "rgba(212,175,55,0.28)",
  color: "#fef3c7",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const basicTabBtnStyle: CSSProperties = {
  padding: "6px 12px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "rgba(15,23,42,0.94)",
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const basicTabBtnActiveStyle: CSSProperties = {
  border: "1px solid #d4af37",
  background: "rgba(212,175,55,0.22)",
  color: "#fef3c7",
};

const sourceTabBtnStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "rgba(15,23,42,0.94)",
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const sourceTabBtnActiveStyle: CSSProperties = {
  border: "1px solid #d4af37",
  background: "rgba(212,175,55,0.22)",
  color: "#fef3c7",
};
