import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { ChoreographyProjectJson, DancerSpot } from "../types/choreography";
import { sortCuesByStart } from "../lib/cueInterval";
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

type Props = {
  open: boolean;
  onClose: () => void;
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  selectedCueId?: string | null;
  onStagePreviewChange?: (dancers: DancerSpot[] | null) => void;
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
}: Props) {
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
    if (selectedCueId) {
      const sorted = sortCuesByStart(project.cues);
      const idx = sorted.findIndex((c) => c.id === selectedCueId);
      if (idx > 0) {
        const prev = sorted[idx - 1]!;
        const prevF = project.formations.find((f) => f.id === prev.formationId);
        if (prevF && prevF.dancers.length > 0) return prevF.dancers;
      }
    }
    return targetFormation?.dancers ?? [];
  }, [project.cues, project.formations, selectedCueId, targetFormation]);

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

  const previewDancers = useMemo(() => {
    if (!selectedPresetId || !targetFormation) return null;
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
    spacingOpts,
    nearestMatchSource,
  ]);

  const closeAndCleanup = useCallback(() => {
    onStagePreviewChange?.(null);
    onClose();
  }, [onClose, onStagePreviewChange]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setShowAllTiers(false);
      setFavoritesOnly(false);
      setBasicTab(false);
      setSelectedPresetId(null);
    }
    wasOpenRef.current = open;
    if (!open) {
      setSelectedPresetId(null);
      setShowAllTiers(false);
      setFavoritesOnly(false);
      setBasicTab(false);
    }
  }, [open, setFavoritesOnly]);

  useEffect(() => {
    if (!open || !selectedPresetId) return;
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
    if (!targetFormation || !selectedPresetId || !previewDancers) return;
    setProject((p) => ({
      ...p,
      formations: p.formations.map((f) =>
        f.id === targetFormation.id
          ? {
              ...f,
              dancers: previewDancers,
              confirmedDancerCount: previewDancers.length,
            }
          : f
      ),
    }));
    closeAndCleanup();
  }, [targetFormation, selectedPresetId, previewDancers, setProject, closeAndCleanup]);

  const cueLabel = useMemo(() => {
    if (!selectedCueId) return null;
    const cue = project.cues.find((c) => c.id === selectedCueId);
    return cue?.label ?? null;
  }, [project.cues, selectedCueId]);

  const noTarget = !targetFormation;

  const untouchedCount = (targetFormation?.dancers.length ?? 0) - targetIds.length;
  const subtitle = noTarget
    ? "適用先のフォーメーションがありません"
    : isSubsetApply
      ? `選択中の ${targetIds.length} 人に反映（他の ${untouchedCount} 人はそのまま）`
      : cueLabel
        ? `「${cueLabel}」に反映（${count} 人）`
        : `現在のフォーメーションに反映（${count} 人）`;

  /** スマホ: 左下固定 / PC: 右上 sticky（スクロールしても常時表示） */
  const actionsDocked = portraitFullscreen || landscapeHorizontal;

  const actionsControls = (
    <>
      <button
        type="button"
        onClick={() => setBasicTab((v) => !v)}
        aria-pressed={basicTab}
        title={basicTab ? "すべての雛形カテゴリを表示" : "定番の提案だけを表示"}
        style={{
          ...basicTabBtnStyle,
          ...(basicTab ? basicTabBtnActiveStyle : null),
          marginRight: 4,
          flexShrink: 0,
          ...(actionsDocked
            ? { minHeight: 44, height: 44, boxShadow: "0 4px 18px rgba(0, 0, 0, 0.55)" }
            : null),
        }}
      >
        BASIC
      </button>
      <FormationPresetFavoritesFilter
        active={favoritesOnly}
        onToggle={toggleFavoritesOnly}
        count={favoriteCount}
        style={
          actionsDocked
            ? { minHeight: 44, height: 44, boxShadow: "0 4px 18px rgba(0, 0, 0, 0.55)" }
            : undefined
        }
      />
      <span style={{ flex: 1, minWidth: 8 }} aria-hidden />
      <button type="button" onClick={closeAndCleanup} style={cancelBtnCompactStyle}>
        閉じる
      </button>
      <button
        type="button"
        onClick={apply}
        disabled={noTarget || !selectedPresetId}
        style={{
          ...applyBtnCompactStyle,
          opacity: noTarget || !selectedPresetId ? 0.45 : 1,
          cursor: noTarget || !selectedPresetId ? "not-allowed" : "pointer",
        }}
      >
        適用
      </button>
    </>
  );

  const stickyActionsBar = !actionsDocked ? (
    <div
      role="group"
      aria-label="立ち位置雛形の操作"
      className="formation-preset-picker-actions-sticky"
    >
      {actionsControls}
    </div>
  ) : null;

  const dockedActionsBar =
    actionsDocked && typeof document !== "undefined" ? (
      <div
        role="group"
        aria-label="立ち位置雛形の操作"
        className="formation-preset-picker-actions formation-preset-picker-actions--portrait-docked"
      >
        {actionsControls}
      </div>
    ) : null;

  // 横画面はドック表示・波形たたみ表示のどちらも同じ大きな正方グリッドを使い、見やすさを揃える
  const useBigGrid = portraitFullscreen || landscapeHorizontal;

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
        <div
          style={{
            padding: "24px 12px",
            textAlign: "center",
            color: "#64748b",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
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
          <h2 id="formation-preset-picker-title">立ち位置の雛形</h2>
          <p>{subtitle}</p>
        </div>
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
      </div>
    </div>
  );

  if (!open) return null;

  if (landscapeHorizontal && typeof document !== "undefined") {
    return createPortal(
      <>
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
          {presetGrid}
        </div>
        {dockedActionsBar}
      </>,
      document.body
    );
  }

  if (portraitFullscreen && typeof document !== "undefined") {
    return createPortal(
      <>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="formation-preset-picker-title"
          data-editor-sheet="formation-preset-picker"
          className="formation-preset-picker-fullscreen"
        >
          {sheetHeader}
          {presetGrid}
        </div>
        {dockedActionsBar}
      </>,
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
                立ち位置の雛形
              </h2>
              <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#94a3b8", lineHeight: 1.45 }}>
                {subtitle}
              </p>
            </div>
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
          </div>
        </div>
        {stickyActionsBar}
        {presetGrid}
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
