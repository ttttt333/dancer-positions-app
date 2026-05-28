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
import {
  dancersForLayoutPreset,
  LAYOUT_PRESET_LABELS,
  PRESET_CATEGORIES,
  transferDancerIdentitiesByOrder,
  type LayoutPresetId,
} from "../lib/formationLayouts";
import { EditorSideSheet } from "./EditorSideSheet";

type Props = {
  open: boolean;
  onClose: () => void;
  project: ChoreographyProjectJson;
  setProject: React.Dispatch<React.SetStateAction<ChoreographyProjectJson>>;
  selectedCueId?: string | null;
  onStagePreviewChange?: (dancers: DancerSpot[] | null) => void;
};

function SpotThumb({ dancers }: { dancers: { xPct: number; yPct: number }[] }) {
  const radius = dancers.length >= 12 ? 2.4 : dancers.length >= 6 ? 3.0 : 3.4;
  return (
    <svg
      viewBox="0 0 100 60"
      width={44}
      height={26}
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

  const count = Math.max(1, targetFormation?.dancers.length ?? 1);
  const [selectedPresetId, setSelectedPresetId] = useState<LayoutPresetId | null>(
    null
  );
  const wasOpenRef = useRef(false);
  const portraitMobileShell = usePortraitMobileShell();
  const dockActionsBottomLeft = open && portraitMobileShell;

  const spacingOpts = useMemo(
    () => ({
      dancerSpacingMm: project.dancerSpacingMm ?? undefined,
      stageWidthMm: project.stageWidthMm ?? undefined,
    }),
    [project.dancerSpacingMm, project.stageWidthMm]
  );

  const presetCategoryPreviews = useMemo(
    () =>
      PRESET_CATEGORIES.map((cat) => ({
        ...cat,
        items: cat.ids.map((id) => ({
          id,
          label: LAYOUT_PRESET_LABELS[id] ?? id,
          dancers: dancersForLayoutPreset(count, id, spacingOpts),
        })),
      })),
    [count, spacingOpts]
  );

  const previewDancers = useMemo(() => {
    if (!selectedPresetId) return null;
    return dancersForLayoutPreset(count, selectedPresetId, spacingOpts);
  }, [count, selectedPresetId, spacingOpts]);

  const closeAndCleanup = useCallback(() => {
    onStagePreviewChange?.(null);
    onClose();
  }, [onClose, onStagePreviewChange]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSelectedPresetId(PRESET_CATEGORIES[0]?.ids[0] ?? null);
    }
    wasOpenRef.current = open;
    if (!open) {
      setSelectedPresetId(null);
    }
  }, [open]);

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
    const dancers = transferDancerIdentitiesByOrder(
      previewDancers,
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
    closeAndCleanup();
  }, [
    targetFormation,
    selectedPresetId,
    previewDancers,
    setProject,
    closeAndCleanup,
  ]);

  const cueLabel = useMemo(() => {
    if (!selectedCueId) return null;
    const cue = project.cues.find((c) => c.id === selectedCueId);
    return cue?.label ?? null;
  }, [project.cues, selectedCueId]);

  const noTarget = !targetFormation;

  const actionsPanel = (
    <div
      role="group"
      aria-label="立ち位置雛形の操作"
      className={
        dockActionsBottomLeft
          ? "formation-preset-picker-actions formation-preset-picker-actions--portrait-docked"
          : "formation-preset-picker-actions"
      }
    >
      <button type="button" onClick={closeAndCleanup} style={cancelBtnStyle}>
        閉じる
      </button>
      <button
        type="button"
        onClick={apply}
        disabled={noTarget || !selectedPresetId}
        style={{
          ...applyBtnStyle,
          opacity: noTarget || !selectedPresetId ? 0.45 : 1,
          cursor: noTarget || !selectedPresetId ? "not-allowed" : "pointer",
        }}
      >
        適用
      </button>
    </div>
  );

  return (
    <>
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
          minHeight: "100%",
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
          <h2
            id="formation-preset-picker-title"
            style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}
          >
            立ち位置の雛形
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#94a3b8", lineHeight: 1.45 }}>
            {noTarget
              ? "適用先のフォーメーションがありません"
              : cueLabel
                ? `「${cueLabel}」に反映（${count} 人）`
                : `現在のフォーメーションに反映（${count} 人）`}
          </p>
        </div>

        <div
          className="formation-preset-picker-sheet-body"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {presetCategoryPreviews.map((cat) => (
            <div key={cat.label}>
              <div
                className="add-cue-preset-category"
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#94a3b8",
                  letterSpacing: "0.02em",
                  marginBottom: "6px",
                  paddingLeft: "2px",
                }}
              >
                {cat.label}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {cat.items.map((item) => {
                  const active = selectedPresetId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="add-cue-preset-btn"
                      disabled={noTarget}
                      onClick={() => setSelectedPresetId(item.id)}
                      title={item.label}
                      style={{
                        ...presetBtnStyle,
                        border: active ? "2px solid #d4af37" : presetBtnStyle.border,
                        background: active
                          ? "rgba(212,175,55,0.15)"
                          : presetBtnStyle.background,
                        boxShadow: active ? "0 0 0 1px rgba(212,175,55,0.35)" : "none",
                        opacity: noTarget ? 0.45 : 1,
                        cursor: noTarget ? "not-allowed" : "pointer",
                      }}
                    >
                      <SpotThumb dancers={item.dancers} />
                      <span className="add-cue-preset-label" style={presetLabelStyle}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {!dockActionsBottomLeft ? actionsPanel : null}
      </div>
    </EditorSideSheet>
    {dockActionsBottomLeft && typeof document !== "undefined"
      ? createPortal(actionsPanel, document.body)
      : null}
    </>
  );
}

const presetBtnStyle: CSSProperties = {
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#0a0f1e",
  color: "#e2e8f0",
  cursor: "pointer",
};

const presetLabelStyle: CSSProperties = {};

const cancelBtnStyle: CSSProperties = {
  padding: "10px 18px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "rgba(15,23,42,0.94)",
  color: "#cbd5e1",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

const applyBtnStyle: CSSProperties = {
  padding: "10px 20px",
  borderRadius: "8px",
  border: "1px solid #d4af37",
  background: "rgba(212,175,55,0.28)",
  color: "#fef3c7",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};
