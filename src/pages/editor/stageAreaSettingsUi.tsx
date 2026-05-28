import {
  memo,
  type CSSProperties,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react";
import { StageDimensionFields } from "../../components/StageDimensionFields";
import { EditorSideSheet } from "../../components/EditorSideSheet";
import { btnSecondary } from "../../components/stageButtonStyles";
import { listStagePresets, saveStagePreset, type StagePresetItem } from "../../lib/stagePresets";
import type { ChoreographyProjectJson } from "../../types/choreography";
import {
  STAGE_AREA_DIM_ROWS,
  type StageAreaSettingsDraft,
} from "./stageAreaSettingsDraft";
import { useI18n } from "../../i18n/I18nContext";

export const STAGE_AREA_SHEET_SECTION: CSSProperties = {
  borderRadius: "10px",
  border: "1px solid rgba(99,102,241,0.15)",
  background: "linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(30,41,59,0.5) 100%)",
  backdropFilter: "blur(6px)",
  padding: "8px 10px",
  marginBottom: "6px",
};


type StageAreaSettingsSheetProps = {
  stageAreaSettingsOpen: boolean;
  onClose: () => void;
  children: ReactNode;
};

export const StageAreaSettingsSheet = memo(function StageAreaSettingsSheet({
  stageAreaSettingsOpen,
  onClose,
  children,
}: StageAreaSettingsSheetProps) {
  if (!stageAreaSettingsOpen) return null;
  return (
    <EditorSideSheet
      open
      zIndex={61}
      width="min(320px, calc(100vw - 16px))"
      onClose={onClose}
      ariaLabelledBy="stage-area-settings-title"
    >
      {children}
    </EditorSideSheet>
  );
});

type StageAreaDimensionRowsProps = {
  disabled: boolean;
  draft: StageAreaSettingsDraft;
  onChangeDraft: Dispatch<SetStateAction<StageAreaSettingsDraft>>;
};

const M_OPTIONS = Array.from({ length: 100 }, (_, i) => i); // 0..99
const CM_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95];

const selectStyle: CSSProperties = {
  padding: "5px 4px",
  borderRadius: "6px",
  border: "1px solid rgba(51,65,85,0.8)",
  background: "#0f172a",
  color: "#e2e8f0",
  fontSize: "12px",
  outline: "none",
  cursor: "pointer",
};

export const StageAreaDimensionRows = memo(function StageAreaDimensionRows({
  disabled,
  draft,
  onChangeDraft,
}: StageAreaDimensionRowsProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 8px", marginBottom: "6px" }}>
      {STAGE_AREA_DIM_ROWS.map((row) => {
        const hasVal = draft[row.key].m !== "" || draft[row.key].cm !== "";
        return (
          <div key={row.key} style={row.key === "guide" ? { gridColumn: "1 / -1" } : {}}>
            <div style={{ fontSize: "10px", color: "rgba(148,163,184,0.8)", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {row.title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "3px", minWidth: 0 }}>
              <select
                disabled={disabled}
                className="stage-area-dim-select"
                value={draft[row.key].m}
                onChange={(e) =>
                  onChangeDraft((d) => ({
                    ...d,
                    [row.key]: { ...d[row.key], m: e.target.value },
                  }))
                }
                aria-label={`${row.title} m`}
                style={{
                  ...selectStyle,
                  flex: "0 0 auto",
                  width: "48px",
                  padding: "5px 2px",
                  border: hasVal ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(51,65,85,0.8)",
                }}
              >
                <option value="">-</option>
                {M_OPTIONS.map((v) => (
                  <option key={v} value={String(v)}>{v}</option>
                ))}
              </select>
              <span style={{ fontSize: "10px", color: "rgba(148,163,184,0.5)", flexShrink: 0 }}>m</span>
              <select
                disabled={disabled}
                className="stage-area-dim-select"
                value={draft[row.key].cm}
                onChange={(e) =>
                  onChangeDraft((d) => ({
                    ...d,
                    [row.key]: { ...d[row.key], cm: e.target.value },
                  }))
                }
                aria-label={`${row.title} cm`}
                style={{
                  ...selectStyle,
                  flex: "0 0 auto",
                  width: "48px",
                  padding: "5px 2px",
                  border: hasVal ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(51,65,85,0.8)",
                }}
              >
                <option value="0">0</option>
                {CM_OPTIONS.filter(v => v > 0).map((v) => (
                  <option key={v} value={String(v)}>{v}</option>
                ))}
              </select>
              <span style={{ fontSize: "10px", color: "rgba(148,163,184,0.5)", flexShrink: 0 }}>cm</span>
            </div>
          </div>
        );
      })}
    </div>
  );
});

type StageAreaPresetBlockProps = {
  disabled: boolean;
  stageAreaPresetSelectNonce: number;
  stageAreaPresetList: StagePresetItem[];
  onChangeDraft: Dispatch<SetStateAction<StageAreaSettingsDraft>>;
  onBumpPresetNonce: () => void;
  onSavePreset: () => void;
};

export const StageAreaPresetBlock = memo(function StageAreaPresetBlock({
  disabled,
  stageAreaPresetSelectNonce,
  stageAreaPresetList,
  onChangeDraft,
  onBumpPresetNonce,
  onSavePreset,
}: StageAreaPresetBlockProps) {
  const { t } = useI18n();
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
        alignItems: "flex-end",
        marginTop: "6px",
        marginBottom: "6px",
      }}
    >
      <label
        style={{
          flex: "1 1 140px",
          minWidth: 0,
          fontSize: "10px",
          fontWeight: 700,
          color: "#64748b",
          letterSpacing: "0.04em",
        }}
      >
        {t("editor.layout.loadPreset")}
        <select
          key={stageAreaPresetSelectNonce}
          defaultValue=""
          disabled={disabled || stageAreaPresetList.length === 0}
          title={t("editor.layout.loadPresetTitle")}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) return;
            const item = stageAreaPresetList.find((x) => x.id === id);
            if (!item) return;
            onChangeDraft((d) => ({
              ...d,
              width: mmToMeterCmDraft(item.stageWidthMm),
              depth: mmToMeterCmDraft(item.stageDepthMm),
              side: mmToMeterCmDraft(item.sideStageMm),
              back: mmToMeterCmDraft(item.backStageMm),
              guide: mmToMeterCmDraft(item.centerFieldGuideIntervalMm),
            }));
            onBumpPresetNonce();
          }}
          style={{
            width: "100%",
            marginTop: "3px",
            padding: "5px 8px",
            borderRadius: "6px",
            border: "1px solid #334155",
            background: "#020617",
            color: "#e2e8f0",
            fontSize: "11px",
          }}
        >
          <option value="">{stageAreaPresetList.length === 0 ? t("editor.layout.presetEmpty") : t("editor.layout.presetSelect")}</option>
          {stageAreaPresetList.map((pr) => (
            <option key={pr.id} value={pr.id}>
              {pr.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={disabled}
        title={t("editor.layout.savePresetTitle")}
        onClick={onSavePreset}
        style={{
          ...btnSecondary,
          flex: "0 0 auto",
          padding: "6px 10px",
          fontSize: "11px",
          fontWeight: 600,
        }}
      >
        {t("editor.layout.savePresetButton")}
      </button>
    </div>
  );
});

type StageAreaGridStepControlProps = {
  disabled: boolean;
  gridStep: number;
  onChangeDraft: Dispatch<SetStateAction<StageAreaSettingsDraft>>;
};

const GRID_STEP_OPTIONS = [0.5, 1, 2, 5, 10];

export const StageAreaGridStepControl = memo(function StageAreaGridStepControl({
  disabled,
  gridStep,
  onChangeDraft,
}: StageAreaGridStepControlProps) {
  const { t } = useI18n();
  return (
    <div style={{ marginBottom: "6px" }} title={t("editor.layout.gridStepNoDimsTitle")}>
      <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "5px" }}>
        {t("editor.layout.gridStepRef")}
      </div>
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
        {GRID_STEP_OPTIONS.map((step) => {
          const active = gridStep === step;
          return (
            <button
              key={step}
              type="button"
              disabled={disabled}
              onClick={() => onChangeDraft((d) => ({ ...d, gridStep: step }))}
              style={{
                padding: "4px 9px",
                borderRadius: "6px",
                border: active ? "1px solid rgba(99,102,241,0.7)" : "1px solid rgba(51,65,85,0.6)",
                background: active ? "rgba(99,102,241,0.2)" : "rgba(15,23,42,0.5)",
                color: active ? "#a5b4fc" : "rgba(100,116,139,0.8)",
                fontSize: "11px",
                fontWeight: active ? 700 : 400,
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 0.1s",
              }}
            >
              {step}%
            </button>
          );
        })}
      </div>
    </div>
  );
});

type StageAreaGridSpacingControlsProps = {
  disabled: boolean;
  gridWidthCmInput: string;
  gridDepthCmInput: string;
  onStageGridCmInput: (axis: "width" | "depth", raw: string) => void;
  commitStageGridCmInput: (axis: "width" | "depth") => void;
  startGridNudgeRepeat: (axis: "width" | "depth", delta: number) => void;
  stopGridNudgeRepeat: () => void;
  nudgeStageGridCm: (axis: "width" | "depth", delta: number) => void;
  gridNudgeDidRepeatRef: MutableRefObject<boolean>;
};

export const StageAreaGridSpacingControls = memo(function StageAreaGridSpacingControls({
  disabled,
  gridWidthCmInput,
  gridDepthCmInput,
  onStageGridCmInput,
  commitStageGridCmInput,
  startGridNudgeRepeat,
  stopGridNudgeRepeat,
  nudgeStageGridCm,
  gridNudgeDidRepeatRef,
}: StageAreaGridSpacingControlsProps) {
  const { t } = useI18n();
  const renderInput = (axis: "width" | "depth", label: string, value: string) => (
    <label style={{ fontSize: "10px", color: "#94a3b8" }}>
      {label}
      <div
        style={{
          marginTop: "3px",
          display: "grid",
          gridTemplateColumns: "1fr 28px 28px",
          gap: "4px",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          className="stage-area-grid-input"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          disabled={disabled}
          onChange={(e) => onStageGridCmInput(axis, e.target.value)}
          onBlur={() => commitStageGridCmInput(axis)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitStageGridCmInput(axis);
            }
          }}
          aria-label={`${label}（センチ）`}
          style={{
            width: "100%",
            padding: "4px 8px",
            borderRadius: "5px",
            border: "1px solid #334155",
            background: "#020617",
            color: "#e2e8f0",
            fontSize: "11px",
            textAlign: "center",
          }}
        />
        <button
          type="button"
          disabled={disabled}
          onPointerDown={(e) => {
            if (disabled) return;
            e.preventDefault();
            startGridNudgeRepeat(axis, -1);
          }}
          onPointerUp={stopGridNudgeRepeat}
          onPointerCancel={stopGridNudgeRepeat}
          onPointerLeave={stopGridNudgeRepeat}
          onClick={() => {
            if (disabled) return;
            if (gridNudgeDidRepeatRef.current) {
              gridNudgeDidRepeatRef.current = false;
              return;
            }
            nudgeStageGridCm(axis, -1);
          }}
          style={{
            ...btnSecondary,
            padding: "3px 0",
            fontSize: "12px",
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          −
        </button>
        <button
          type="button"
          disabled={disabled}
          onPointerDown={(e) => {
            if (disabled) return;
            e.preventDefault();
            startGridNudgeRepeat(axis, 1);
          }}
          onPointerUp={stopGridNudgeRepeat}
          onPointerCancel={stopGridNudgeRepeat}
          onPointerLeave={stopGridNudgeRepeat}
          onClick={() => {
            if (disabled) return;
            if (gridNudgeDidRepeatRef.current) {
              gridNudgeDidRepeatRef.current = false;
              return;
            }
            nudgeStageGridCm(axis, 1);
          }}
          style={{
            ...btnSecondary,
            padding: "3px 0",
            fontSize: "12px",
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          ＋
        </button>
      </div>
    </label>
  );
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "6px",
        marginBottom: "6px",
      }}
    >
      {renderInput("width", t("editor.layout.gridWidthCm"), gridWidthCmInput)}
      {renderInput("depth", t("editor.layout.gridDepthCm"), gridDepthCmInput)}
    </div>
  );
});

type StageAreaGridVisibilityTogglesProps = {
  disabled: boolean;
  hasMainFloor: boolean;
  verticalEnabled: boolean;
  horizontalEnabled: boolean;
  onChangeDraft: Dispatch<SetStateAction<StageAreaSettingsDraft>>;
};

export const StageAreaGridVisibilityToggles = memo(function StageAreaGridVisibilityToggles({
  disabled,
  hasMainFloor,
  verticalEnabled,
  horizontalEnabled,
  onChangeDraft,
}: StageAreaGridVisibilityTogglesProps) {
  const { t } = useI18n();
  const canToggle = !disabled && hasMainFloor;
  const toggleStyle = (active: boolean): CSSProperties => ({
    flex: 1,
    padding: "7px 8px",
    borderRadius: "8px",
    border: active
      ? "1px solid rgba(99,102,241,0.7)"
      : "1px solid rgba(51,65,85,0.6)",
    background: active ? "rgba(99,102,241,0.18)" : "rgba(15,23,42,0.5)",
    color: active ? "#a5b4fc" : "rgba(100,116,139,0.7)",
    fontSize: "11px",
    fontWeight: active ? 700 : 400,
    cursor: canToggle ? "pointer" : "not-allowed",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    transition: "all 0.15s",
    opacity: hasMainFloor ? 1 : 0.45,
  });
  return (
    <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
      <button
        type="button"
        disabled={!canToggle}
        onClick={() => onChangeDraft((d) => ({ ...d, stageGridLinesVerticalEnabled: !verticalEnabled }))}
        title={t("editor.layout.gridVerticalTitle")}
        style={toggleStyle(verticalEnabled)}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="6" y1="3" x2="6" y2="21" />
          <line x1="18" y1="3" x2="18" y2="21" />
        </svg>
        {t("editor.layout.gridVertical")}
      </button>
      <button
        type="button"
        disabled={!canToggle}
        onClick={() => onChangeDraft((d) => ({ ...d, stageGridLinesHorizontalEnabled: !horizontalEnabled }))}
        title={t("editor.layout.gridHorizontalTitle")}
        style={toggleStyle(horizontalEnabled)}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        {t("editor.layout.gridHorizontal")}
      </button>
    </div>
  );
});
