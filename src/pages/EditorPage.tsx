import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ChoreoCoreLogo } from "../components/ChoreoGridLogo";
import { StageBoard, type FloorTextPlaceSession } from "../components/StageBoard";
import { StageDimensionFields } from "../components/StageDimensionFields";
import {
  mmFromMeterAndCm,
  mmToMeterCm,
  STAGE_MAIN_FLOOR_MM_MAX,
} from "../lib/stageDimensions";
const Stage3DView = lazy(() =>
  import("../components/Stage3DView").then((m) => ({ default: m.Stage3DView }))
);
import { TimelinePanel, type TimelinePanelHandle } from "../components/TimelinePanel";
import { RosterTimelineStrip } from "../components/RosterTimelineStrip";
import {
  createEmptyProject,
  DEFAULT_DANCER_MARKER_DIAMETER_PX,
  dancerMarkerDiameterAfterRosterImport,
  tryMigrateFromLocalStorage,
} from "../lib/projectDefaults";
import { preloadFFmpeg } from "../lib/extractVideoAudio";
import { normalizeProject } from "../lib/normalizeProject";
import { modDancerColorIndex } from "../lib/dancerColorPalette";
import { sortCuesByStart } from "../lib/cueInterval";
import { dancersAtTime } from "../lib/interpolatePlayback";
import { floorMarkupAtTime, setPiecesAtTime } from "../lib/interpolateSetPieces";
import { FormationBoxManagerDialog } from "../components/FormationBoxManagerDialog";
import {
  listStagePresets,
  saveStagePreset,
  type StagePresetItem,
} from "../lib/stagePresets";
import { pickSpotForAppendedDancer } from "../lib/dancerAppendPlacement";
import {
  buildCrewFromRows,
  type RosterNameImportMode,
} from "../lib/crewCsvImport";
import {
  ROSTER_FILE_ACCEPT,
  labelForKind,
  parseRosterFile,
  type RosterFileKind,
} from "../lib/rosterFileImport";
import type {
  ChoreographyProjectJson,
  Cue,
  DancerSpot,
  Formation,
  SetPieceKind,
} from "../types/choreography";
import {
  SetPiecePickerModal,
  type SetPiecePickerSubmit,
} from "../components/SetPiecePickerModal";
import { ChoreoCoreToolbar } from "../components/ChoreoCoreToolbar";
import {
  EditorStageWorkbench,
  WorkbenchCuePager,
  type EditorStageWorkbenchProps,
} from "../components/EditorStageWorkbench";
import { StageShapePicker } from "../components/StageShapePicker";
import { EditorSideSheet } from "../components/EditorSideSheet";
import { ExportDialog } from "../components/ExportDialog";
import { FlowLibraryDialog } from "../components/FlowLibraryDialog";
import { AddCueWithFormationDialog } from "../components/AddCueWithFormationDialog";
import { projectApi } from "../api/client";
import { isSupabaseBackend } from "../lib/supabaseClient";
import { projectShareLinks } from "../lib/shareProjectLinks";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { btnAccent, btnSecondary, inputField } from "../components/stageButtonStyles";
import { panelCard, shell } from "../theme/choreoShell";
import { useYjsCollaboration } from "../hooks/useYjsCollaboration";
import {
  captureStageSnapshot,
  mergeStageSnapshotIntoProject,
} from "../lib/savedSpotStageSnapshot";
import { getViewRosterEntries } from "../lib/viewRoster";
import {
  ChoreoStudentViewGate,
  type StudentPick,
} from "../components/ChoreoStudentViewGate";
import { ShareLinksSheetContent } from "../components/ShareLinksSheetContent";
import { ViewerModeSheetContent } from "../components/ViewerModeSheetContent";

const HISTORY_CAP = 80;

function studentPickToStageFocus(
  p: StudentPick
):
  | { kind: "all" }
  | { kind: "one"; crewMemberId: string; label: string } {
  if (p.kind === "all") {
    return { kind: "all" };
  }
  return { kind: "one", crewMemberId: p.id, label: p.label };
}

function round2Pct(n: number): number {
  return Math.round(n * 100) / 100;
}

const EDITOR_WIDE_MIN_PX = 1280;
/** メイン 3 列グリッドの列間・行間（参照スクリーンショットの段間に合わせる） */
const EDITOR_GRID_GAP_PX = 10;
/** 上部波形ドック行の既定高さ（px）。可変シェル時の未保存グリッド行に使う */
const TOP_DOCK_HEIGHT_PX = 62;
/**
 * ワイド＋上部波形時の固定シェル：波形行の外枠高さのベース（px）。
 * 参照 UI（波形帯が画面高の約 1/10 前後）に合わせた既定。
 */
const EDITOR_SHELL_TOP_WAVE_BASE_PX = 110;
/** 名簿ありで上部に「メンバーを表示」行を出すとき、ベースに足す高さ（px） */
const EDITOR_SHELL_TOP_WAVE_ROSTER_ROW_PX = 40;
/**
 * 再生・波形・タイムライン列をまとめて上へ詰める。
 * 参照スクリーンショット（ヘッダと再生行が切れず、ステージブロックがやや上）のバランス。
 */
const EDITOR_PLAYBACK_LAYOUT_SHIFT_UP = "calc(1.45cm + 3mm - 1cm)";

/** ステージ列とタイムライン列の間のドラッグ幅 */
const STAGE_RESIZER_PX = 4;
/** 右列タイムラインとの分割時のステージ列の最小幅（狭すぎると編集しづらい） */
const STAGE_COL_MIN_PX = 340;
/** 波形が右列にあるときのタイムライン列の最小幅 */
const TIMELINE_FULL_COL_MIN_PX = 240;
/** 上部ドック時：右列はツール帯のみなので幅を抑える（グリッドは minmax(MIN, MAX)） */
const RIGHT_TOOLS_RAIL_MIN_PX = 152;
const RIGHT_TOOLS_RAIL_MAX_PX = 210;
/** 右ペイン：タイムライン（またはキュー一覧）の縦スタック */

/**
 * ワイド＋上部波形固定シェル時の既定の列比（参照 UI：ステージ約 80%・右アクション列約 20%）。
 * `stageColumnPx` が未保存のときは `minmax(MIN, Nfr)` でこの比を再現する。
 */
const STAGE_COL_FR_DEFAULT = 80;
const RIGHT_RAIL_FR_DEFAULT = 20;

/** 上部波形ドック行の高さの許容範囲（保存・ドラッグ・clamp と readStored と一致） */
const TOP_DOCK_ROW_MIN_PX = 60;
const TOP_DOCK_ROW_MAX_PX = 480;

function clampTopDockRowPx(n: number): number {
  return Math.min(
    TOP_DOCK_ROW_MAX_PX,
    Math.max(TOP_DOCK_ROW_MIN_PX, Math.round(n))
  );
}

/** 波形行の高さ・ステージ〜右列の幅分割を端末に覚えさせる */
const EDITOR_LAYOUT_STORAGE_KEY = "dancer-positions.editorLayout.v2";
const EDITOR_LAYOUT_LEGACY_STORAGE_KEY = "dancer-positions.editorLayout.v1";

function readStoredEditorLayout(): {
  stageColumnPx: number | null;
  topDockRowPx: number | null;
} {
  if (typeof window === "undefined") {
    return { stageColumnPx: null, topDockRowPx: null };
  }
  try {
    const rawCurrent = window.localStorage.getItem(EDITOR_LAYOUT_STORAGE_KEY);
    const rawLegacy = window.localStorage.getItem(EDITOR_LAYOUT_LEGACY_STORAGE_KEY);
    const raw = rawCurrent ?? rawLegacy;
    if (!raw) return { stageColumnPx: null, topDockRowPx: null };
    const o = JSON.parse(raw) as {
      stageColumnPx?: unknown;
      topDockRowPx?: unknown;
    };
    const sc =
      typeof o.stageColumnPx === "number" &&
      Number.isFinite(o.stageColumnPx) &&
      o.stageColumnPx >= STAGE_COL_MIN_PX
        ? o.stageColumnPx
        : null;
    const td =
      typeof o.topDockRowPx === "number" &&
      Number.isFinite(o.topDockRowPx) &&
      o.topDockRowPx >= TOP_DOCK_ROW_MIN_PX &&
      o.topDockRowPx <= TOP_DOCK_ROW_MAX_PX
        ? Math.round(o.topDockRowPx)
        : null;
    if (!rawCurrent && rawLegacy) {
      try {
        window.localStorage.setItem(EDITOR_LAYOUT_STORAGE_KEY, raw);
      } catch {
        /* 移行失敗は無視 */
      }
    }
    return { stageColumnPx: sc, topDockRowPx: td };
  } catch {
    return { stageColumnPx: null, topDockRowPx: null };
  }
}

/** ステージ「設定」パネル：客席は画面上辺・下辺のみ */
const STAGE_AREA_AUDIENCE_OPTIONS: {
  value: ChoreographyProjectJson["audienceEdge"];
  label: string;
}[] = [
  { value: "top", label: "上" },
  { value: "bottom", label: "下" },
];

type StageAreaMeterCmDraft = { m: string; cm: string };

function clampStageMainMm(mm: number): number {
  if (!Number.isFinite(mm) || mm <= 0) return 0;
  return Math.min(STAGE_MAIN_FLOOR_MM_MAX, Math.round(mm));
}

function mmToMeterCmDraft(mm: number | null | undefined): StageAreaMeterCmDraft {
  if (mm == null || mm <= 0) return { m: "", cm: "" };
  const u = mmToMeterCm(clampStageMainMm(mm));
  return { m: String(u.m), cm: String(u.cm) };
}

/** 空欄なら null（未設定）。cm は 0〜99（10 mm 刻み） */
function parseMeterCmDraftToMm(d: StageAreaMeterCmDraft): number | null {
  const mT = d.m.trim();
  const cT = d.cm.trim();
  if (mT === "" && cT === "") return null;
  const m = mT === "" ? 0 : parseInt(mT, 10);
  const cm = cT === "" ? 0 : parseInt(cT, 10);
  if (!Number.isFinite(m) || !Number.isFinite(cm)) return null;
  const mm = clampStageMainMm(mmFromMeterAndCm(m, cm));
  return mm > 0 ? mm : null;
}

const STAGE_AREA_DIM_ROWS: {
  key: "width" | "depth" | "side" | "back" | "guide";
  title: string;
}[] = [
  { key: "width", title: "メイン幅（上手〜下手）" },
  { key: "depth", title: "奥行（客席方向）" },
  { key: "side", title: "サイド（片側）" },
  { key: "back", title: "バック" },
  { key: "guide", title: "場ミリ（センターから）" },
];

/** 場ミリはメイン幅の半分以下（`StageDimensionFields` と同じ） */
function clampGuideIntervalToWidth(
  widthMm: number | null,
  intervalMm: number | null
): number | null {
  if (intervalMm == null || widthMm == null || widthMm <= 0) return intervalMm;
  const maxHalf = Math.max(1, Math.floor(widthMm / 2));
  return Math.min(Math.max(1, Math.floor(intervalMm)), maxHalf);
}

type StageAreaSettingsDraft = {
  audienceEdge: ChoreographyProjectJson["audienceEdge"];
  width: StageAreaMeterCmDraft;
  depth: StageAreaMeterCmDraft;
  side: StageAreaMeterCmDraft;
  back: StageAreaMeterCmDraft;
  guide: StageAreaMeterCmDraft;
  gridStep: number;
  stageGridLinesVerticalEnabled: boolean;
  stageGridLinesHorizontalEnabled: boolean;
  gridWidthCm: number;
  gridDepthCm: number;
  dancerLabelPosition: "inside" | "below";
};

function emptyStageAreaSettingsDraft(): StageAreaSettingsDraft {
  return {
    audienceEdge: "bottom",
    width: { m: "", cm: "" },
    depth: { m: "", cm: "" },
    side: { m: "", cm: "" },
    back: { m: "", cm: "" },
    guide: { m: "", cm: "" },
    gridStep: 1,
    stageGridLinesVerticalEnabled: false,
    stageGridLinesHorizontalEnabled: false,
    gridWidthCm: 1,
    gridDepthCm: 1,
    dancerLabelPosition: "inside",
  };
}

function clampGridSpacingCm(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.min(100, Math.round(raw)));
}

function parseGridSpacingInput(raw: string): number {
  const normalized = raw
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[^\d]/g, "");
  return Number(normalized);
}

function projectToStageAreaDraft(p: ChoreographyProjectJson): StageAreaSettingsDraft {
  const gridWmm = p.stageGridSpacingWidthMm ?? p.stageGridLineSpacingMm ?? 10;
  const gridDmm = p.stageGridSpacingDepthMm ?? p.stageGridLineSpacingMm ?? 10;
  return {
    audienceEdge: p.audienceEdge,
    width: mmToMeterCmDraft(p.stageWidthMm),
    depth: mmToMeterCmDraft(p.stageDepthMm),
    side: mmToMeterCmDraft(p.sideStageMm),
    back: mmToMeterCmDraft(p.backStageMm),
    guide: mmToMeterCmDraft(p.centerFieldGuideIntervalMm),
    gridStep: p.gridStep,
    stageGridLinesVerticalEnabled:
      p.stageGridLinesVerticalEnabled ?? p.stageGridLinesEnabled ?? false,
    stageGridLinesHorizontalEnabled:
      p.stageGridLinesHorizontalEnabled ?? p.stageGridLinesEnabled ?? false,
    gridWidthCm: clampGridSpacingCm(gridWmm / 10),
    gridDepthCm: clampGridSpacingCm(gridDmm / 10),
    dancerLabelPosition: p.dancerLabelPosition ?? "inside",
  };
}

const STAGE_AREA_DIM_INPUT: CSSProperties = {
  width: "52px",
  padding: "4px 6px",
  borderRadius: "5px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e2e8f0",
  fontSize: "12px",
};
const STAGE_AREA_DIM_INPUT_CM: CSSProperties = {
  ...STAGE_AREA_DIM_INPUT,
  width: "44px",
};

const STAGE_AREA_SHEET_SECTION: CSSProperties = {
  borderBottom: "1px solid #1e293b",
  paddingBottom: "6px",
  marginBottom: "6px",
};

type StageAreaSettingsSheetProps = {
  stageAreaSettingsOpen: boolean;
  onClose: () => void;
  children: ReactNode;
};

const StageAreaSettingsSheet = memo(function StageAreaSettingsSheet({
  stageAreaSettingsOpen,
  onClose,
  children,
}: StageAreaSettingsSheetProps) {
  if (!stageAreaSettingsOpen) return null;
  return (
    <EditorSideSheet
      open
      zIndex={61}
      width="min(440px, calc(100vw - 16px))"
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

const StageAreaDimensionRows = memo(function StageAreaDimensionRows({
  disabled,
  draft,
  onChangeDraft,
}: StageAreaDimensionRowsProps) {
  return (
    <>
      {STAGE_AREA_DIM_ROWS.map((row) => (
        <div
          key={row.key}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) auto auto auto auto auto",
            gap: "4px",
            alignItems: "center",
            marginBottom: "4px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "#94a3b8",
              lineHeight: 1.25,
              minWidth: 0,
            }}
          >
            {row.title}
          </span>
          <input
            type="number"
            min={0}
            max={999}
            disabled={disabled}
            placeholder="m"
            value={draft[row.key].m}
            onChange={(e) =>
              onChangeDraft((d) => ({
                ...d,
                [row.key]: { ...d[row.key], m: e.target.value },
              }))
            }
            aria-label={`${row.title} メートル`}
            style={STAGE_AREA_DIM_INPUT}
          />
          <span style={{ fontSize: "10px", color: "#64748b" }}>m</span>
          <input
            type="number"
            min={0}
            max={99}
            disabled={disabled}
            placeholder="cm"
            value={draft[row.key].cm}
            onChange={(e) =>
              onChangeDraft((d) => ({
                ...d,
                [row.key]: { ...d[row.key], cm: e.target.value },
              }))
            }
            aria-label={`${row.title} センチ`}
            style={STAGE_AREA_DIM_INPUT_CM}
          />
          <span style={{ fontSize: "10px", color: "#64748b" }}>cm</span>
        </div>
      ))}
    </>
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

const StageAreaPresetBlock = memo(function StageAreaPresetBlock({
  disabled,
  stageAreaPresetSelectNonce,
  stageAreaPresetList,
  onChangeDraft,
  onBumpPresetNonce,
  onSavePreset,
}: StageAreaPresetBlockProps) {
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
        保存済みから読込
        <select
          key={stageAreaPresetSelectNonce}
          defaultValue=""
          disabled={disabled || stageAreaPresetList.length === 0}
          title="端末に保存した寸法セットを入力欄に読み込み（決定で反映）"
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
          <option value="">{stageAreaPresetList.length === 0 ? "（なし）" : "選ぶ…"}</option>
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
        title="現在の入力を名前付きで保存"
        onClick={onSavePreset}
        style={{
          ...btnSecondary,
          flex: "0 0 auto",
          padding: "6px 10px",
          fontSize: "11px",
          fontWeight: 600,
        }}
      >
        名前で保存
      </button>
    </div>
  );
});

type StageAreaGridStepControlProps = {
  disabled: boolean;
  gridStep: number;
  onChangeDraft: Dispatch<SetStateAction<StageAreaSettingsDraft>>;
};

const StageAreaGridStepControl = memo(function StageAreaGridStepControl({
  disabled,
  gridStep,
  onChangeDraft,
}: StageAreaGridStepControlProps) {
  return (
    <label
      style={{
        display: "block",
        fontSize: "10px",
        color: "#94a3b8",
        marginBottom: "2px",
      }}
      title="幅・奥行が未設定のときの％刻み（参考用）"
    >
      寸法なし時の％刻み
      <select
        value={gridStep}
        disabled={disabled}
        onChange={(e) =>
          onChangeDraft((d) => ({
            ...d,
            gridStep: Number(e.target.value),
          }))
        }
        style={{
          width: "100%",
          marginTop: "3px",
          marginBottom: "6px",
          padding: "4px 8px",
          borderRadius: "5px",
          border: "1px solid #334155",
          background: "#020617",
          color: "#e2e8f0",
          fontSize: "11px",
        }}
      >
        <option value={0.5}>0.5%</option>
        <option value={1}>1%</option>
        <option value={2}>2%</option>
        <option value={5}>5%</option>
        <option value={10}>10%</option>
      </select>
    </label>
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

const StageAreaGridSpacingControls = memo(function StageAreaGridSpacingControls({
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
      {renderInput("width", "縦線間隔（cm）", gridWidthCmInput)}
      {renderInput("depth", "横線間隔（cm）", gridDepthCmInput)}
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

const StageAreaGridVisibilityToggles = memo(function StageAreaGridVisibilityToggles({
  disabled,
  hasMainFloor,
  verticalEnabled,
  horizontalEnabled,
  onChangeDraft,
}: StageAreaGridVisibilityTogglesProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        marginTop: "4px",
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "11px",
          color: "#cbd5e1",
          cursor: disabled ? "default" : "pointer",
        }}
        title="幅方向（画面上では縦に走る線）"
      >
        <input
          type="checkbox"
          checked={verticalEnabled}
          disabled={disabled || !hasMainFloor}
          onChange={(e) =>
            onChangeDraft((d) => ({
              ...d,
              stageGridLinesVerticalEnabled: e.target.checked,
            }))
          }
        />
        縦線（幅方向のグリッド）を表示
      </label>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "11px",
          color: "#cbd5e1",
          cursor: disabled ? "default" : "pointer",
        }}
        title="奥行方向（画面上では横に走る線）"
      >
        <input
          type="checkbox"
          checked={horizontalEnabled}
          disabled={disabled || !hasMainFloor}
          onChange={(e) =>
            onChangeDraft((d) => ({
              ...d,
              stageGridLinesHorizontalEnabled: e.target.checked,
            }))
          }
        />
        横線（奥行方向のグリッド）を表示
      </label>
    </div>
  );
});

/**
 * ステージ列の最大幅（px）。
 * 右列の最小幅＋列間ギャップ＋リサイザを除いた残りまで許可する。
 * （旧: 画面幅の 2/3 上限があり、2fr レイアウトより狭くなりドラッグ直後に幅が跳ぶ原因になっていた）
 */
function readMaxStageWidthPx(
  gridEl: HTMLElement,
  minRightColPx: number = TIMELINE_FULL_COL_MIN_PX
): number {
  const rect = gridEl.getBoundingClientRect();
  const cs = getComputedStyle(gridEl);
  const padX =
    (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const gap =
    parseFloat(cs.columnGap) ||
    parseFloat(cs.rowGap) ||
    parseFloat(cs.gap) ||
    EDITOR_GRID_GAP_PX;
  const gapsBetween3Cols = 2 * gap;
  /** ステージ＋列間ギャップ＋リサイザ＋右列で使える横方向の余白 */
  const inner =
    rect.width - padX - gapsBetween3Cols - STAGE_RESIZER_PX;
  const maxStage = inner - minRightColPx;
  return Math.max(STAGE_COL_MIN_PX, Math.floor(maxStage));
}

export function EditorPage({
  choreoPublicView = false,
}: {
  choreoPublicView?: boolean;
} = {}) {
  const { projectId, shareToken: shareTokenParam } = useParams<{
    projectId?: string;
    shareToken?: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { me, ready: authReady } = useAuth();
  const { t } = useI18n();
  const collabParam = searchParams.get("collab") === "1" && !choreoPublicView;
  const [plainProject, setPlainProject] = useState<ChoreographyProjectJson | null>(null);
  const [projectName, setProjectName] = useState("無題の作品");
  const [serverId, setServerId] = useState<number | null>(null);
  /** Supabase: 生徒用閲覧 URL `/view/s/{token}` 用。従来 API では null のまま */
  const [serverShareToken, setServerShareToken] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** 初回クラウド保存直後の GET をスキップ（画面を空にしない） */
  const skipNextProjectFetchRef = useRef<number | null>(null);
  const [cloudSaveDialogOpen, setCloudSaveDialogOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stageView, setStageView] = useState<"2d" | "3d">("2d");
  const [stagePreviewDancers, setStagePreviewDancers] = useState<DancerSpot[] | null>(
    null
  );
  /** ChoreoCore: 編集対象のキュー（ステージ・プリセット・インスペクタの書き込み先） */
  const [selectedCueIds, setSelectedCueIds] = useState<string[]>([]);
  const selectedCueId =
    selectedCueIds.length === 0
      ? null
      : selectedCueIds[selectedCueIds.length - 1]!;
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [flowLibraryOpen, setFlowLibraryOpen] = useState(false);
  /** 立ち位置保存ボタンから開く管理ダイアログ */
  const [formationBoxManagerOpen, setFormationBoxManagerOpen] = useState(false);
  /** キュー追加 ＋ 形選択 ＋ 形の箱保存を 1 画面に統合したダイアログ */
  const [addCueDialogOpen, setAddCueDialogOpen] = useState(false);
  /**
   * 右ペイン（タイムライン／右ツール列）を畳んでステージを最大化するトグル。
   * 畳んでもステージ上にグリッド用ツールバーが出るほか、ステージ上部のページャーから
   * キュー切替は引き続き可能。狭いビューポート（!wideEditorLayout）では無効。
   */
  const [rightPaneCollapsed, setRightPaneCollapsed] = useState(false);
  const timelineRef = useRef<TimelinePanelHandle>(null);
  const [stageSettingsOpen, setStageSettingsOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  /** ステージ列ヘッダの「設定」：舞台・グリッド・名前・共有・ヒントを集約 */
  const [stageAreaSettingsOpen, setStageAreaSettingsOpen] = useState(false);
  const [stageAreaSettingsDraft, setStageAreaSettingsDraft] =
    useState<StageAreaSettingsDraft>(emptyStageAreaSettingsDraft);
  const [gridWidthCmInput, setGridWidthCmInput] = useState<string>("1");
  const [gridDepthCmInput, setGridDepthCmInput] = useState<string>("1");
  const stageAreaSettingsDraftRef = useRef(stageAreaSettingsDraft);
  stageAreaSettingsDraftRef.current = stageAreaSettingsDraft;
  const [stageAreaPresetList, setStageAreaPresetList] = useState<StagePresetItem[]>([]);
  const [stageAreaPresetSelectNonce, setStageAreaPresetSelectNonce] = useState(0);
  const prevStageAreaOpenRef = useRef(false);
  const [shareLinkCopiedFlash, setShareLinkCopiedFlash] = useState(false);
  const shareCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 生徒向け /view ルート: メンバー選択後の閲覧 */
  const [choreoStudentPick, setChoreoStudentPick] = useState<StudentPick | null>(null);
  const [choreoGatePhase, setChoreoGatePhase] = useState<"remind" | "pick">("pick");
  const [choreoStoredPick, setChoreoStoredPick] = useState<StudentPick | null>(null);
  const [shareLinksOpen, setShareLinksOpen] = useState(false);
  const [choreoMemberSheetOpen, setChoreoMemberSheetOpen] = useState(false);
  /** 編集画面: 生徒用閲覧と同じ「一人強調」をプレビュー */
  const [editorViewerSheetOpen, setEditorViewerSheetOpen] = useState(false);
  const [editorViewerPreviewPick, setEditorViewerPreviewPick] =
    useState<StudentPick | null>(null);
  const [setPiecePickerOpen, setSetPiecePickerOpen] = useState(false);
  /** 変形舞台ピッカー（舞台形状のカスタマイズ） */
  const [stageShapePickerOpen, setStageShapePickerOpen] = useState(false);
  /** ワイド時のみ。null = 既定の fr 比、数値 = ステージ列の幅（px） */
  const [stageColumnPx, setStageColumnPx] = useState<number | null>(() => {
    return readStoredEditorLayout().stageColumnPx;
  });
  const [wideEditorLayout, setWideEditorLayout] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(`(min-width: ${EDITOR_WIDE_MIN_PX}px)`).matches
  );
  /** ワイド＋タイムライン表示時: キュー一覧モーダルの開閉（一覧本体はポータルで描画） */
  const [cueListModalOpen, setCueListModalOpen] = useState(false);
  const [cueListPortalEl, setCueListPortalEl] =
    useState<HTMLDivElement | null>(null);
  /** 上部ドック時の上段（波形・再生）行の高さ（px）。null = 既定の `minmax(160px, min(28vh, 300px))` */
  const [topDockRowPx, setTopDockRowPx] = useState<number | null>(() => {
    return readStoredEditorLayout().topDockRowPx;
  });
  /** ステージのみ全画面（波形・右列・ステージ上の補助行を隠す） */
  const [stageZenFullscreen, setStageZenFullscreen] = useState(false);
  /** `showTopWaveDock` の直前値（早期 return の前でもフック順を一定にするため ref はここで保持） */
  const prevShowTopWaveDockRef = useRef<boolean | undefined>(undefined);
  /** ステージ「名簿取り込み」: ファイル選択後の表示名モード確認 */
  const [rosterImportDraft, setRosterImportDraft] = useState<{
    rows: string[][];
    baseName: string;
    kind: RosterFileKind;
    notice?: string;
  } | null>(null);
  const [rosterImportNameMode, setRosterImportNameMode] =
    useState<RosterNameImportMode>("full");
  /** 名簿取り込み確認ダイアログ: ファイル以外に手入力で追加するメンバー（各行が 1 名） */
  const [rosterImportExtraNames, setRosterImportExtraNames] = useState<string[]>(
    []
  );
  const editorPaneRef = useRef<HTMLDivElement>(null);
  /** 画面テキスト用ポータルの基準（グリッド root）。ref だけだと初回描画後に再レンダーされないため state 併用 */
  const [editorSurfaceEl, setEditorSurfaceEl] = useState<HTMLDivElement | null>(
    null
  );
  const stageSectionRef = useRef<HTMLElement>(null);
  /** ワイド＋上部波形時のグリッド 1 行目（再生・波形ブロック）。高さドラッグの計測用 */
  const topDockSectionRef = useRef<HTMLElement | null>(null);
  /** ステージ床テキスト：ヘッダから入力→プレビュー→完了で設置 */
  const [floorTextPlaceSession, setFloorTextPlaceSession] =
    useState<FloorTextPlaceSession | null>(null);
  /** ステージ床の直接書き込み（テキスト／線）。上部バーと StageBoard で共有 */
  const [floorMarkupTool, setFloorMarkupTool] = useState<
    null | "text" | "line" | "erase"
  >(null);
  const splitDragRef = useRef<{
    pointerId: number;
    startX: number;
    startW: number;
  } | null>(null);
  const topDockDragRef = useRef<{
    pointerId: number;
    startY: number;
    startH: number;
  } | null>(null);
  const rightPaneStackRef = useRef<HTMLDivElement>(null);
  /** 舞台設定の保存・復元に使う直前のフォーメーション id（キュー／アクティブ切替） */
  const lastFormationIdForStageRef = useRef<string | null>(null);

  const historyRef = useRef<{ undo: string[]; redo: string[] }>({
    undo: [],
    redo: [],
  });

  const collabActive =
    collabParam &&
    !!me &&
    serverId != null &&
    projectId != null &&
    projectId !== "new";

  const yjsCollab = useYjsCollaboration(serverId, collabActive);
  const project = collabActive ? yjsCollab.project : plainProject;

  const viewerLocalStorageKey = useMemo(
    () =>
      choreoPublicView && serverId != null
        ? `choreoViewerMemberV1:${serverId}`
        : null,
    [choreoPublicView, serverId]
  );

  const shareLinksUrls = useMemo(() => {
    if (serverId == null) return { collab: "", view: "" };
    if (typeof window === "undefined") return { collab: "", view: "" };
    return projectShareLinks(serverId, serverShareToken);
  }, [serverId, serverShareToken]);

  const storageRemindHandledRef = useRef(false);
  useEffect(() => {
    storageRemindHandledRef.current = false;
  }, [viewerLocalStorageKey]);

  useEffect(() => {
    if (choreoPublicView) {
      setRightPaneCollapsed(true);
    }
  }, [choreoPublicView]);

  useEffect(() => {
    if (!choreoPublicView || !viewerLocalStorageKey) return;
    if (choreoStudentPick != null) return;
    if (storageRemindHandledRef.current) return;
    try {
      const raw = localStorage.getItem(viewerLocalStorageKey);
      if (!raw) {
        storageRemindHandledRef.current = true;
        return;
      }
      const parsed = JSON.parse(raw) as {
        kind?: string;
        id?: string;
        label?: string;
      };
      if (parsed.kind === "all") {
        setChoreoStoredPick({ kind: "all" });
        setChoreoGatePhase("remind");
      } else if (
        parsed.kind === "member" &&
        typeof parsed.id === "string" &&
        typeof parsed.label === "string"
      ) {
        setChoreoStoredPick({
          kind: "member",
          id: parsed.id,
          label: parsed.label,
        });
        setChoreoGatePhase("remind");
      }
    } catch {
      /* ignore */
    } finally {
      storageRemindHandledRef.current = true;
    }
  }, [choreoPublicView, viewerLocalStorageKey, choreoStudentPick]);

  /** ドラッグ中は毎フレーム積まない。離したときだけ 1 手分を積む（StageBoard の立ち位置ドラッグ用） */
  const gestureHistoryDepthRef = useRef(0);
  const gestureHistoryBaselineRef = useRef<string | null>(null);
  const skipNextHistoryPushRef = useRef(false);
  const projectForHistoryRef = useRef<ChoreographyProjectJson | null>(null);
  if (project) {
    projectForHistoryRef.current = project;
  }

  /** `jumpToPagerSlot` が名簿取り込み直後などで古い `project` を参照しないようにする */
  const projectPagerRef = useRef<ChoreographyProjectJson | null>(null);
  if (project) {
    projectPagerRef.current = project;
  }

  /**
   * クラウド保存は確認ダイアログ経由で非同期に走るため、`useCallback` が掴む `project` が
   * 編集前のスナップショットのまま残ることがある。保存直前は常に ref の最新値を送る。
   */
  const projectSaveRef = useRef<ChoreographyProjectJson | null>(null);
  if (project) {
    projectSaveRef.current = project;
  } else {
    projectSaveRef.current = null;
  }

  const cancelGestureHistory = useCallback(() => {
    gestureHistoryDepthRef.current = 0;
    gestureHistoryBaselineRef.current = null;
  }, []);

  const beginGestureHistory = useCallback(() => {
    if (collabActive) return;
    gestureHistoryDepthRef.current += 1;
    if (
      gestureHistoryDepthRef.current === 1 &&
      projectForHistoryRef.current != null
    ) {
      gestureHistoryBaselineRef.current = JSON.stringify(
        projectForHistoryRef.current
      );
    }
  }, [collabActive]);

  const endGestureHistory = useCallback(() => {
    if (collabActive) return;
    if (gestureHistoryDepthRef.current <= 0) return;
    gestureHistoryDepthRef.current -= 1;
    if (gestureHistoryDepthRef.current !== 0) return;
    const baseline = gestureHistoryBaselineRef.current;
    gestureHistoryBaselineRef.current = null;
    if (!baseline) return;
    const cur = projectForHistoryRef.current;
    if (!cur) return;
    let curStr: string;
    try {
      curStr = JSON.stringify(cur);
    } catch {
      return;
    }
    if (curStr === baseline) return;
    const { undo, redo } = historyRef.current;
    if (undo.length >= HISTORY_CAP) undo.shift();
    undo.push(baseline);
    redo.length = 0;
  }, [collabActive]);

  const markHistorySkipNextPush = useCallback(() => {
    skipNextHistoryPushRef.current = true;
  }, []);

  /**
   * 上部波形ドック時は右列を狭くする（未ロード時は false で右列を広めに確保）。
   * ワイドでは名簿モードでも常に上部ドックを使う（`showTopWaveDock` と揃え Timeline をアンマウントしない）。
   */
  const showTopWaveDockForGrid = !!project && wideEditorLayout;
  /** 上部波形＋ステージ＋右列の「枠だけ固定」レイアウト（拡大モードではオフ） */
  const editorFixedWaveDockLayout =
    showTopWaveDockForGrid && !stageZenFullscreen;
  /** 右列の最小幅ぶんをステージ上限から控除（固定シェルでも分割ドラッグ可能にしたためレール最小を使う） */
  const minRightColForStageSplitPx = editorFixedWaveDockLayout
    ? RIGHT_TOOLS_RAIL_MIN_PX
    : showTopWaveDockForGrid
      ? RIGHT_TOOLS_RAIL_MAX_PX
      : TIMELINE_FULL_COL_MIN_PX;

  /** 名簿モード終了などで上部ドックが復帰したとき、手動リサイズ幅を捨てて波形エリアの高さを既定に戻す */
  useEffect(() => {
    if (prevShowTopWaveDockRef.current === false && showTopWaveDockForGrid) {
      setTopDockRowPx(null);
    }
    prevShowTopWaveDockRef.current = showTopWaveDockForGrid;
  }, [showTopWaveDockForGrid]);

  /** FFmpeg.wasm は音源取り込みボタン押下時のみロードする（バックグラウンド自動 DL だとタブのスピナーが常時表示されてしまうため削除） */

  useEffect(() => {
    /** 生徒用: /view/s/{token} かつログイン不要（Supabase RPC） */
    if (choreoPublicView && shareTokenParam) {
      let cancelled = false;
      (async () => {
        setPlainProject(null);
        setLoadError(null);
        setServerShareToken(shareTokenParam);
        try {
          if (!isSupabaseBackend()) {
            if (!cancelled) {
              setLoadError("共有閲覧には VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY の設定が必要です。");
            }
            return;
          }
          const row = await projectApi.getByShareToken(shareTokenParam);
          if (cancelled) return;
          setServerId(row.id);
          setServerShareToken(row.share_token ?? shareTokenParam);
          setProjectName(row.name);
          const baseJson = normalizeProject(row.json);
          setPlainProject({ ...baseJson, viewMode: "view" });
          setLoadError(null);
          historyRef.current = { undo: [], redo: [] };
        } catch (e) {
          if (!cancelled) {
            setLoadError(e instanceof Error ? e.message : "読み込み失敗");
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    /** 新規は API・ログイン不要のため認証待ちを挟まず即表示（立ち上げ短縮） */
    if (projectId === "new" || !projectId) {
      const migrated = tryMigrateFromLocalStorage();
      setPlainProject(migrated ?? createEmptyProject());
      setServerId(null);
      setServerShareToken(null);
      setLoadError(null);
      historyRef.current = { undo: [], redo: [] };
      return;
    }

    const id = Number(projectId);
    if (!Number.isFinite(id)) {
      setPlainProject(null);
      setLoadError("無効な ID");
      return;
    }

    /** 共同編集だけ「未ログイン」と区別するために認証確定を待つ */
    if (collabParam) {
      if (!authReady) {
        setPlainProject(null);
        setLoadError(null);
        return;
      }
      if (!me) {
        setPlainProject(null);
        setLoadError("共同編集にはログインが必要です");
        return;
      }
    }

    if (skipNextProjectFetchRef.current === id) {
      skipNextProjectFetchRef.current = null;
      return;
    }

    type NavSeed = {
      editorSeed?: ChoreographyProjectJson;
      editorSeedProjectId?: number;
    };
    const nav = (location.state ?? null) as NavSeed | null;
    if (
      !collabParam &&
      nav?.editorSeed &&
      nav.editorSeedProjectId === id
    ) {
      const seeded = normalizeProject(nav.editorSeed);
      setPlainProject(seeded);
      setServerId(id);
      const title = seeded.pieceTitle?.trim() || "無題の作品";
      setProjectName(title);
      setLoadError(null);
      skipNextProjectFetchRef.current = id;
      navigate(
        { pathname: location.pathname, search: location.search },
        { replace: true, state: {} }
      );
      return;
    }

    let cancelled = false;
    (async () => {
      setPlainProject(null);
      setLoadError(null);
      try {
        const row = await projectApi.get(id);
        if (cancelled) return;
        setServerId(row.id);
        setServerShareToken(row.share_token ?? null);
        setProjectName(row.name);
        const baseJson = normalizeProject(row.json);
        if (collabParam && me) {
          setPlainProject(null);
        } else {
          setPlainProject(
            choreoPublicView ? { ...baseJson, viewMode: "view" } : baseJson
          );
        }
        setLoadError(null);
        historyRef.current = { undo: [], redo: [] };
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "読み込み失敗");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    projectId,
    shareTokenParam,
    collabParam,
    me,
    authReady,
    location.state,
    location.pathname,
    location.search,
    navigate,
    choreoPublicView,
  ]);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${EDITOR_WIDE_MIN_PX}px)`);
    const onChange = () => setWideEditorLayout(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!wideEditorLayout) {
      setTopDockRowPx(null);
    }
  }, [wideEditorLayout]);

  useEffect(() => {
    if (!wideEditorLayout) {
      setStageColumnPx(null);
      return;
    }
    const clamp = () => {
      setStageColumnPx((cur) => {
        if (cur == null) return cur;
        const grid = editorPaneRef.current;
        if (!grid) return cur;
        const maxW = readMaxStageWidthPx(grid, minRightColForStageSplitPx);
        const minW = STAGE_COL_MIN_PX;
        if (!Number.isFinite(maxW)) return cur;
        if (maxW < minW) return Math.max(minW, Math.round(maxW));
        return Math.min(maxW, Math.max(minW, cur));
      });
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [wideEditorLayout, minRightColForStageSplitPx, editorFixedWaveDockLayout]);

  useEffect(() => {
    if (!wideEditorLayout || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        EDITOR_LAYOUT_STORAGE_KEY,
        JSON.stringify({
          stageColumnPx,
          topDockRowPx:
            topDockRowPx == null
              ? null
              : clampTopDockRowPx(topDockRowPx),
        })
      );
    } catch {
      /* ストレージ不可 */
    }
  }, [wideEditorLayout, stageColumnPx, topDockRowPx]);

  useEffect(() => {
    if (!stageZenFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setStageZenFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stageZenFullscreen]);

  useEffect(() => {
    if (!wideEditorLayout && stageZenFullscreen) {
      setStageZenFullscreen(false);
    }
  }, [wideEditorLayout, stageZenFullscreen]);

  const onSplitPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!wideEditorLayout || e.button !== 0) return;
      const grid = editorPaneRef.current;
      const stageSec = stageSectionRef.current;
      if (!grid || !stageSec) return;
      e.preventDefault();
      const startW = stageSec.getBoundingClientRect().width;
      splitDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startW,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [wideEditorLayout]
  );

  const onSplitPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = splitDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const grid = editorPaneRef.current;
    if (!grid) return;
    let maxW = readMaxStageWidthPx(grid, minRightColForStageSplitPx);
    const minW = STAGE_COL_MIN_PX;
    if (!Number.isFinite(maxW) || maxW < minW) maxW = minW;
    const next = Math.round(
      Math.min(maxW, Math.max(minW, d.startW + (e.clientX - d.startX)))
    );
    setStageColumnPx(next);
  }, [minRightColForStageSplitPx]);

  const endSplitDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = splitDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    splitDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const onSplitLostCapture = useCallback(() => {
    splitDragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const onTopDockResizeDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const grid = editorPaneRef.current;
      if (!grid) return;
      e.preventDefault();
      const gridRect = grid.getBoundingClientRect();
      const topSection = topDockSectionRef.current;
      const startH = topSection
        ? topSection.getBoundingClientRect().height
        : Math.max(160, gridRect.height * 0.28);
      topDockDragRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startH,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    []
  );

  const onTopDockResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = topDockDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const grid = editorPaneRef.current;
      if (!grid) return;
      const gridRect = grid.getBoundingClientRect();
      /**
       * ユーザーが「波形を上の方までできるだけ縮めたい」ケース向けに、
       * 最小高さはコンパクト再生行＋ルーラー＋波形が潰れない程度まで許可する。
       */
      const minH = TOP_DOCK_ROW_MIN_PX;
      const maxH = Math.max(
        minH,
        Math.min(TOP_DOCK_ROW_MAX_PX, gridRect.height - 200)
      );
      const next = clampTopDockRowPx(
        Math.min(maxH, Math.max(minH, d.startH + (e.clientY - d.startY)))
      );
      setTopDockRowPx(next);
    },
    []
  );

  const endTopDockResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = topDockDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      topDockDragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    },
    []
  );

  const onTopDockResizeDoubleClick = useCallback(() => {
    setTopDockRowPx(null);
  }, []);

  const rightPaneTopSectionStyle = useMemo(
    (): CSSProperties => ({
      flex: 1,
      minHeight: 0,
      minWidth: 0,
    }),
    []
  );

  const editorGridColumns = useMemo(() => {
    if (choreoPublicView) {
      if (!wideEditorLayout) return "1fr";
      return "1fr";
    }
    if (!wideEditorLayout) return "1fr";
    if (rightPaneCollapsed) return "1fr";
    if (editorFixedWaveDockLayout) {
      if (stageColumnPx == null) {
        return `minmax(${STAGE_COL_MIN_PX}px, ${STAGE_COL_FR_DEFAULT}fr) ${STAGE_RESIZER_PX}px minmax(${RIGHT_TOOLS_RAIL_MIN_PX}px, ${RIGHT_RAIL_FR_DEFAULT}fr)`;
      }
      return `${Math.round(stageColumnPx)}px ${STAGE_RESIZER_PX}px minmax(${RIGHT_TOOLS_RAIL_MIN_PX}px, 1fr)`;
    }
    const rightTrackFullTimeline = `minmax(${TIMELINE_FULL_COL_MIN_PX}px, 1fr)`;
    const rightTrackRailFixed = `minmax(${RIGHT_TOOLS_RAIL_MIN_PX}px, ${RIGHT_TOOLS_RAIL_MAX_PX}px)`;
    const rightTrackRailProportional = `clamp(${RIGHT_TOOLS_RAIL_MIN_PX}px, ${RIGHT_RAIL_FR_DEFAULT}fr, ${RIGHT_TOOLS_RAIL_MAX_PX}px)`;
    if (stageColumnPx == null) {
      if (showTopWaveDockForGrid) {
        return `minmax(${STAGE_COL_MIN_PX}px, ${STAGE_COL_FR_DEFAULT}fr) ${STAGE_RESIZER_PX}px ${rightTrackRailProportional}`;
      }
      return `minmax(${STAGE_COL_MIN_PX}px, 2fr) ${STAGE_RESIZER_PX}px ${rightTrackFullTimeline}`;
    }
    const rightTrack = showTopWaveDockForGrid
      ? rightTrackRailFixed
      : rightTrackFullTimeline;
    return `${Math.round(stageColumnPx)}px ${STAGE_RESIZER_PX}px ${rightTrack}`;
  }, [
    wideEditorLayout,
    rightPaneCollapsed,
    stageColumnPx,
    showTopWaveDockForGrid,
    editorFixedWaveDockLayout,
    choreoPublicView,
  ]);

  const setProjectSafePlain: Dispatch<SetStateAction<ChoreographyProjectJson>> =
    useCallback((action) => {
      setPlainProject((prev) => {
        if (!prev) return prev;
        const next =
          typeof action === "function"
            ? (action as (p: ChoreographyProjectJson) => ChoreographyProjectJson)(prev)
            : action;
        if (next === prev) return prev;
        let unchanged = false;
        try {
          unchanged = JSON.stringify(next) === JSON.stringify(prev);
        } catch {
          unchanged = false;
        }
        if (unchanged) return prev;
        if (skipNextHistoryPushRef.current) {
          skipNextHistoryPushRef.current = false;
          return next;
        }
        if (gestureHistoryDepthRef.current > 0) {
          return next;
        }
        const { undo, redo } = historyRef.current;
        if (undo.length >= HISTORY_CAP) undo.shift();
        undo.push(JSON.stringify(prev));
        redo.length = 0;
        return next;
      });
    }, []);

  const setProjectSafe: Dispatch<SetStateAction<ChoreographyProjectJson>> =
    useMemo(
      () => (collabActive ? yjsCollab.setProjectSafe : setProjectSafePlain),
      [collabActive, yjsCollab.setProjectSafe, setProjectSafePlain]
    );

  /** ステージまわりシートのドラフトをプロジェクトへ一括反映（閉じない） */
  const applyStageAreaSettingsDraft = useCallback(() => {
    if (!project || project.viewMode === "view") return;
    const d = stageAreaSettingsDraftRef.current;
    const w = parseMeterCmDraftToMm(d.width);
    const depthMm = parseMeterCmDraftToMm(d.depth);
    const s = parseMeterCmDraftToMm(d.side);
    const b = parseMeterCmDraftToMm(d.back);
    const gRaw = parseMeterCmDraftToMm(d.guide);
    const g = clampGuideIntervalToWidth(w, gRaw);
    const gw = Math.max(1, Math.min(100, Math.round(d.gridWidthCm))) * 10;
    const gd = Math.max(1, Math.min(100, Math.round(d.gridDepthCm))) * 10;
    setProjectSafe((p) => ({
      ...p,
      audienceEdge: d.audienceEdge,
      stageWidthMm: w,
      stageDepthMm: depthMm,
      sideStageMm: s,
      backStageMm: b,
      centerFieldGuideIntervalMm: g,
      snapGrid: false,
      gridStep: d.gridStep,
      stageGridLinesVerticalEnabled: d.stageGridLinesVerticalEnabled,
      stageGridLinesHorizontalEnabled: d.stageGridLinesHorizontalEnabled,
      stageGridLinesEnabled:
        d.stageGridLinesVerticalEnabled || d.stageGridLinesHorizontalEnabled,
      stageGridSpacingWidthMm: gw,
      stageGridLineSpacingMm: gw,
      stageGridSpacingDepthMm: gd,
      dancerLabelPosition: d.dancerLabelPosition,
    }));
  }, [project, setProjectSafe]);

  const stageAreaDraftHasMainFloor = useMemo(() => {
    const w = parseMeterCmDraftToMm(stageAreaSettingsDraft.width);
    const d = parseMeterCmDraftToMm(stageAreaSettingsDraft.depth);
    return w != null && w > 0 && d != null && d > 0;
  }, [stageAreaSettingsDraft.width, stageAreaSettingsDraft.depth]);

  const onStageGridCmInput = useCallback((axis: "width" | "depth", raw: string) => {
    if (axis === "width") setGridWidthCmInput(raw);
    else setGridDepthCmInput(raw);
  }, []);

  const commitStageGridCmInput = useCallback((axis: "width" | "depth") => {
    if (axis === "width") {
      const next = clampGridSpacingCm(parseGridSpacingInput(gridWidthCmInput));
      setStageAreaSettingsDraft((d) => ({ ...d, gridWidthCm: next }));
      setGridWidthCmInput(String(next));
      return;
    }
    const next = clampGridSpacingCm(parseGridSpacingInput(gridDepthCmInput));
    setStageAreaSettingsDraft((d) => ({ ...d, gridDepthCm: next }));
    setGridDepthCmInput(String(next));
  }, [gridDepthCmInput, gridWidthCmInput]);

  const nudgeStageGridCm = useCallback((axis: "width" | "depth", delta: number) => {
    setStageAreaSettingsDraft((d) => {
      const base = axis === "width" ? d.gridWidthCm : d.gridDepthCm;
      const next = clampGridSpacingCm(base + delta);
      if (axis === "width") setGridWidthCmInput(String(next));
      else setGridDepthCmInput(String(next));
      return axis === "width" ? { ...d, gridWidthCm: next } : { ...d, gridDepthCm: next };
    });
  }, []);

  const gridNudgeTimeoutRef = useRef<number | null>(null);
  const gridNudgeIntervalRef = useRef<number | null>(null);
  const gridNudgeDidRepeatRef = useRef(false);

  const stopGridNudgeRepeat = useCallback(() => {
    if (gridNudgeTimeoutRef.current != null) {
      window.clearTimeout(gridNudgeTimeoutRef.current);
      gridNudgeTimeoutRef.current = null;
    }
    if (gridNudgeIntervalRef.current != null) {
      window.clearInterval(gridNudgeIntervalRef.current);
      gridNudgeIntervalRef.current = null;
    }
  }, []);

  const startGridNudgeRepeat = useCallback(
    (axis: "width" | "depth", delta: number) => {
      stopGridNudgeRepeat();
      gridNudgeDidRepeatRef.current = false;
      gridNudgeTimeoutRef.current = window.setTimeout(() => {
        gridNudgeDidRepeatRef.current = true;
        nudgeStageGridCm(axis, delta);
        gridNudgeIntervalRef.current = window.setInterval(() => {
          nudgeStageGridCm(axis, delta);
        }, 70);
      }, 260);
    },
    [nudgeStageGridCm, stopGridNudgeRepeat]
  );

  useEffect(() => stopGridNudgeRepeat, [stopGridNudgeRepeat]);
  useEffect(() => {
    setGridWidthCmInput(String(stageAreaSettingsDraft.gridWidthCm));
    setGridDepthCmInput(String(stageAreaSettingsDraft.gridDepthCm));
  }, [stageAreaSettingsDraft.gridWidthCm, stageAreaSettingsDraft.gridDepthCm]);

  /**
   * 「ステージまわりの設定」表示中はドラフト（グリッド線のON/OFF・間隔・寸法など）を
   * メインの StageBoard に反映し、決定前でもステージ上でプレビューできるようにする。
   */
  const projectForStageBoard = useMemo((): ChoreographyProjectJson | null => {
    if (!project) return null;
    if (!stageAreaSettingsOpen) return project;
    const d = stageAreaSettingsDraft;
    const w = parseMeterCmDraftToMm(d.width);
    const depthMm = parseMeterCmDraftToMm(d.depth);
    const s = parseMeterCmDraftToMm(d.side);
    const b = parseMeterCmDraftToMm(d.back);
    const gRaw = parseMeterCmDraftToMm(d.guide);
    const g = clampGuideIntervalToWidth(w, gRaw);
    const gw = Math.max(1, Math.min(100, Math.round(d.gridWidthCm))) * 10;
    const gd = Math.max(1, Math.min(100, Math.round(d.gridDepthCm))) * 10;
    return {
      ...project,
      audienceEdge: d.audienceEdge,
      stageWidthMm: w,
      stageDepthMm: depthMm,
      sideStageMm: s,
      backStageMm: b,
      centerFieldGuideIntervalMm: g,
      snapGrid: false,
      gridStep: d.gridStep,
      stageGridLinesVerticalEnabled: d.stageGridLinesVerticalEnabled,
      stageGridLinesHorizontalEnabled: d.stageGridLinesHorizontalEnabled,
      stageGridLinesEnabled:
        d.stageGridLinesVerticalEnabled || d.stageGridLinesHorizontalEnabled,
      stageGridSpacingWidthMm: gw,
      stageGridLineSpacingMm: gw,
      stageGridSpacingDepthMm: gd,
      dancerLabelPosition: d.dancerLabelPosition,
    };
  }, [project, stageAreaSettingsOpen, stageAreaSettingsDraft]);

  useEffect(() => {
    if (!project) {
      prevStageAreaOpenRef.current = false;
      return;
    }
    if (stageAreaSettingsOpen && !prevStageAreaOpenRef.current) {
      setStageAreaSettingsDraft(projectToStageAreaDraft(project));
      setStageAreaPresetList(listStagePresets());
      setStageAreaPresetSelectNonce((n) => n + 1);
    }
    prevStageAreaOpenRef.current = stageAreaSettingsOpen;
  }, [stageAreaSettingsOpen, project]);

  const undoPlain = useCallback(() => {
    setPlainProject((cur) => {
      if (!cur) return cur;
      const { undo, redo } = historyRef.current;
      if (undo.length === 0) return cur;
      const prevStr = undo.pop()!;
      redo.push(JSON.stringify(cur));
      return normalizeProject(JSON.parse(prevStr));
    });
  }, []);

  const redoPlain = useCallback(() => {
    setPlainProject((cur) => {
      if (!cur) return cur;
      const { undo, redo } = historyRef.current;
      if (redo.length === 0) return cur;
      const nextStr = redo.pop()!;
      undo.push(JSON.stringify(cur));
      return normalizeProject(JSON.parse(nextStr));
    });
  }, []);

  const undo = useCallback(() => {
    if (collabActive) yjsCollab.undo();
    else undoPlain();
  }, [collabActive, yjsCollab, undoPlain]);

  const redo = useCallback(() => {
    if (collabActive) yjsCollab.redo();
    else redoPlain();
  }, [collabActive, yjsCollab, redoPlain]);

  const copyEditorShareLink = useCallback(async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      if (shareCopiedTimerRef.current) clearTimeout(shareCopiedTimerRef.current);
      setShareLinkCopiedFlash(true);
      shareCopiedTimerRef.current = setTimeout(() => {
        setShareLinkCopiedFlash(false);
        shareCopiedTimerRef.current = null;
      }, 2200);
    } catch {
      try {
        window.prompt("次の URL をコピーしてください", url);
      } catch {
        /** ignore */
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (shareCopiedTimerRef.current) clearTimeout(shareCopiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }
      if (e.key === "Escape" && cloudSaveDialogOpen) {
        setCloudSaveDialogOpen(false);
        return;
      }
      if (e.key === "Escape" && stageAreaSettingsOpen) {
        setStageAreaSettingsOpen(false);
        return;
      }
      if (e.key === "Escape" && stageSettingsOpen) {
        setStageSettingsOpen(false);
        return;
      }
      if (e.key === "Escape" && exportDialogOpen) {
        setExportDialogOpen(false);
        return;
      }
      if (e.key === "Escape" && flowLibraryOpen) {
        setFlowLibraryOpen(false);
        return;
      }
      if (e.key === "Escape" && cueListModalOpen) {
        setCueListModalOpen(false);
        return;
      }
      if (e.key === "Escape" && shortcutsHelpOpen) {
        setShortcutsHelpOpen(false);
        return;
      }
      if (e.key === "Escape" && rosterImportDraft) {
        setRosterImportDraft(null);
        setRosterImportExtraNames([]);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        timelineRef.current?.togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    redo,
    undo,
    cloudSaveDialogOpen,
    stageAreaSettingsOpen,
    stageSettingsOpen,
    shortcutsHelpOpen,
    exportDialogOpen,
    flowLibraryOpen,
    rosterImportDraft,
    cueListModalOpen,
  ]);

  const interpolatedDancers = useMemo(() => {
    if (!project || project.cues.length === 0) return null;
    return dancersAtTime(
      currentTime,
      project.cues,
      project.formations,
      project.activeFormationId
    );
  }, [project, currentTime]);

  const interpolatedSetPieces = useMemo(() => {
    if (!project || project.cues.length === 0) return null;
    return setPiecesAtTime(
      currentTime,
      project.cues,
      project.formations,
      project.activeFormationId
    );
  }, [project, currentTime]);

  const interpolatedFloorMarkup = useMemo(() => {
    if (!project || project.cues.length === 0) return null;
    return floorMarkupAtTime(
      currentTime,
      project.cues,
      project.formations,
      project.activeFormationId
    );
  }, [project, currentTime]);

  const formationById = useMemo(() => {
    if (!project) return new Map<string, Formation>();
    return new Map(project.formations.map((f) => [f.id, f] as const));
  }, [project]);

  const cueById = useMemo(() => {
    if (!project) return new Map<string, Cue>();
    return new Map(project.cues.map((c) => [c.id, c] as const));
  }, [project]);

  const selectedCue = useMemo(
    () => (selectedCueId ? cueById.get(selectedCueId) ?? null : null),
    [selectedCueId, cueById]
  );

  useEffect(() => {
    lastFormationIdForStageRef.current = null;
  }, [projectId]);

  /**
   * フォーメーション（ページ）を切り替えたとき、直前ページの舞台設定を `stageSnapshot` に保存し、
   * 次のページに保存済みがあればプロジェクトの舞台へ復元する。
   */
  useEffect(() => {
    if (!project) return;
    const nextId = selectedCue?.formationId ?? project.activeFormationId;
    if (!nextId) return;
    const prevId = lastFormationIdForStageRef.current;
    if (prevId === nextId) return;

    if (prevId !== null) {
      setProjectSafe((p) => {
        const snap = captureStageSnapshot(p);
        const formations1 = p.formations.map((f) =>
          f.id === prevId ? { ...f, stageSnapshot: snap } : f
        );
        const base: ChoreographyProjectJson = { ...p, formations: formations1 };
        const nf = formations1.find((f) => f.id === nextId);
        return nf?.stageSnapshot
          ? mergeStageSnapshotIntoProject(base, nf.stageSnapshot)
          : base;
      });
    } else {
      const nf = formationById.get(nextId);
      if (nf?.stageSnapshot) {
        setProjectSafe((p) => mergeStageSnapshotIntoProject(p, nf.stageSnapshot));
      }
    }
    lastFormationIdForStageRef.current = nextId;
  }, [project, selectedCue, formationById, setProjectSafe]);

  const cueIdsSig =
    project?.cues
      .map((c) => `${c.id}:${c.tStartSec}:${c.tEndSec}:${c.formationId}`)
      .join("|") ?? "";

  const cuesSortedForStageJump = useMemo(
    () => (project ? sortCuesByStart(project.cues) : []),
    [project, cueIdsSig]
  );

  const jumpToCueByIdx = useCallback(
    (idx: number) => {
      if (!project || project.viewMode === "view") return;
      const cue = cuesSortedForStageJump[idx];
      if (!cue) return;
      /** 先に選択と activeFormation を確定してからシークする（順序逆だとステージ・一覧と再生位置が一瞬ずれる） */
      setSelectedCueIds([cue.id]);
      setProjectSafe((p) => ({ ...p, activeFormationId: cue.formationId }));
      timelineRef.current?.pauseAndSeekToSec(cue.tStartSec);
    },
    [project, cuesSortedForStageJump, setProjectSafe]
  );

  /** ステージ右上ページャ: 名簿があるとき slot 0 = 名簿、1.. = キュー順 */
  const jumpToPagerSlot = useCallback(
    (slotIdx: number) => {
      const p = projectPagerRef.current;
      if (!p || p.viewMode === "view") return;
      const cuesSorted = sortCuesByStart(p.cues);
      const hasRoster = p.crews.some((c) => c.members.length > 0);
      if (!hasRoster) {
        const cue = cuesSorted[slotIdx];
        if (!cue) return;
        setSelectedCueIds([cue.id]);
        setProjectSafe((prev) => ({
          ...prev,
          activeFormationId: cue.formationId,
        }));
        timelineRef.current?.pauseAndSeekToSec(cue.tStartSec);
        return;
      }
      if (slotIdx === 0) {
        setProjectSafe((prev) => ({
          ...prev,
          rosterHidesTimeline: true,
          rosterStripCollapsed: false,
        }));
        return;
      }
      const cue = cuesSorted[slotIdx - 1];
      if (!cue) return;
      setSelectedCueIds([cue.id]);
      setProjectSafe((prev) => ({
        ...prev,
        rosterHidesTimeline: false,
        activeFormationId: cue.formationId,
      }));
      timelineRef.current?.pauseAndSeekToSec(cue.tStartSec);
    },
    [setProjectSafe]
  );

  /** 名簿「決定」直後に最新の jumpToPagerSlot で先頭キューへ飛ばす */
  const jumpToPagerSlotRef = useRef(jumpToPagerSlot);
  jumpToPagerSlotRef.current = jumpToPagerSlot;
  const onRosterConfirmReturnToTimeline = useCallback(() => {
    queueMicrotask(() => {
      jumpToPagerSlotRef.current(1);
    });
  }, []);

  useEffect(() => {
    if (!project) return;
    if (project.cues.length === 0) {
      setSelectedCueIds([]);
      return;
    }
    setSelectedCueIds((ids) => {
      const valid = ids.filter((id) => cueById.has(id));
      if (valid.length > 0) {
        const seen = new Set<string>();
        const deduped: string[] = [];
        for (const id of valid) {
          if (seen.has(id)) continue;
          seen.add(id);
          deduped.push(id);
        }
        return deduped;
      }
      const first = cuesSortedForStageJump[0]?.id;
      return first ? [first] : [];
    });
  }, [project, cueIdsSig, cueById, cuesSortedForStageJump]);

  /** 再生中のみ補間表示 */
  const playbackDancersForStage = !isPlaying ? null : interpolatedDancers;

  const playbackSetPiecesForStage = !isPlaying ? null : interpolatedSetPieces;

  const playbackFloorMarkupForStage = !isPlaying ? null : interpolatedFloorMarkup;

  const browseFormationDancers = useMemo(() => {
    if (!project || isPlaying) return null;
    if (stagePreviewDancers && stagePreviewDancers.length > 0) return null;
    if (selectedCue) {
      const f = formationById.get(selectedCue.formationId);
      return f?.dancers ?? null;
    }
    if (project.cues.length > 0) {
      return dancersAtTime(
        currentTime,
        project.cues,
        project.formations,
        project.activeFormationId
      );
    }
    const f = formationById.get(project.activeFormationId);
    return f?.dancers ?? null;
  }, [project, isPlaying, stagePreviewDancers, selectedCue, currentTime, formationById]);

  const browseSetPieces = useMemo(() => {
    if (!project || isPlaying) return null;
    if (stagePreviewDancers && stagePreviewDancers.length > 0) return null;
    if (selectedCue) {
      const f = formationById.get(selectedCue.formationId);
      return f?.setPieces ?? null;
    }
    if (project.cues.length > 0) {
      return setPiecesAtTime(
        currentTime,
        project.cues,
        project.formations,
        project.activeFormationId
      );
    }
    const f = formationById.get(project.activeFormationId);
    return f?.setPieces ?? null;
  }, [project, isPlaying, stagePreviewDancers, selectedCue, currentTime, formationById]);

  const browseFloorMarkup = useMemo(() => {
    if (!project || isPlaying) return null;
    if (stagePreviewDancers && stagePreviewDancers.length > 0) return null;
    if (selectedCue) {
      const f = formationById.get(selectedCue.formationId);
      return f?.floorMarkup ?? null;
    }
    if (project.cues.length > 0) {
      return floorMarkupAtTime(
        currentTime,
        project.cues,
        project.formations,
        project.activeFormationId
      );
    }
    const f = formationById.get(project.activeFormationId);
    return f?.floorMarkup ?? null;
  }, [project, isPlaying, stagePreviewDancers, selectedCue, currentTime, formationById]);

  useEffect(() => {
    if (!wideEditorLayout) setFloorMarkupTool(null);
  }, [wideEditorLayout]);

  useEffect(() => {
    if (stageView !== "2d") setFloorMarkupTool(null);
  }, [stageView]);

  const dancersFor3d = useMemo(() => {
    if (!project) return [];
    if (stagePreviewDancers?.length) return stagePreviewDancers;
    if (interpolatedDancers && isPlaying) return interpolatedDancers;
    if (browseFormationDancers?.length) return browseFormationDancers;
    const f = formationById.get(project.activeFormationId);
    return f?.dancers ?? [];
  }, [
    project,
    interpolatedDancers,
    isPlaying,
    stagePreviewDancers,
    browseFormationDancers,
    formationById,
  ]);

  const onFloorTextPlaceSessionChange = useCallback((next: FloorTextPlaceSession) => {
    setFloorTextPlaceSession(next);
  }, []);

  const commitFloorTextPlace = useCallback(() => {
    if (!project || project.viewMode === "view") return;
    if (project.cues.length > 0 && !selectedCueId) return;
    if (!floorTextPlaceSession) return;
    const text = floorTextPlaceSession.body.trim().slice(0, 400);
    if (!text) {
      window.alert("テキストを入力してください");
      return;
    }
    const formationId = selectedCue?.formationId ?? project.activeFormationId;
    const fs = Math.round(
      Math.min(56, Math.max(8, floorTextPlaceSession.fontSizePx))
    );
    const fw =
      Math.round(Math.min(900, Math.max(300, floorTextPlaceSession.fontWeight)) / 50) *
      50;
    const rawCol = floorTextPlaceSession.color?.trim();
    const color =
      rawCol && /^#[0-9a-fA-F]{6}$/i.test(rawCol)
        ? rawCol.toLowerCase()
        : "#fef08a";
    const fontFamily =
      (floorTextPlaceSession.fontFamily ?? "").trim() ||
      "system-ui, -apple-system, 'Segoe UI', sans-serif";
    const sc = floorTextPlaceSession.scale;
    const scale =
      typeof sc === "number" && Number.isFinite(sc) && sc > 0
        ? Math.min(8, Math.max(0.2, sc))
        : 1;
    setProjectSafe((p) => ({
      ...p,
      formations: p.formations.map((f) => {
        if (f.id !== formationId) return f;
        return {
          ...f,
          floorMarkup: [
            ...(f.floorMarkup ?? []),
            {
              kind: "text" as const,
              id: crypto.randomUUID(),
              layer: "screen" as const,
              xPct: round2Pct(
                Math.min(100, Math.max(0, floorTextPlaceSession.xPct))
              ),
              yPct: round2Pct(
                Math.min(100, Math.max(0, floorTextPlaceSession.yPct))
              ),
              text,
              color,
              fontFamily,
              scale,
              fontSizePx: fs,
              fontWeight: fw,
            },
          ],
        };
      }),
    }));
    setFloorTextPlaceSession(null);
  }, [
    project,
    floorTextPlaceSession,
    selectedCueId,
    selectedCue,
    setProjectSafe,
  ]);

  useEffect(() => {
    if (stageView === "3d") setFloorTextPlaceSession(null);
  }, [stageView]);

  /**
   * ＋ダンサーボタンで 1 人ずつ追加。
   * 既存の立ち位置・表示名は一切変えず、追加 1 人だけを
   * 既存印から離れた空きに置く（ピラミッド全体の並べ替えはしない）。
   */
  const addDancerFromStageToolbar = useCallback(() => {
    if (!project || project.viewMode === "view") return;
    const fid =
      selectedCue?.formationId ??
      project.formations.find((x) => x.id === project.activeFormationId)?.id ??
      project.formations[0]?.id;
    if (!fid) return;
    setProjectSafe((p) => {
      const f = p.formations.find((x) => x.id === fid);
      if (!f) return p;
      const n = f.dancers.length;
      const { xPct, yPct } = pickSpotForAppendedDancer(f.dancers);
      const newDancer = {
        id: crypto.randomUUID(),
        label: String(n + 1),
        xPct,
        yPct,
        colorIndex: modDancerColorIndex(n),
      };
      return {
        ...p,
        formations: p.formations.map((fm) =>
          fm.id === fid
            ? {
                ...fm,
                dancers: [...f.dancers.map((d) => ({ ...d })), newDancer],
                confirmedDancerCount: n + 1,
              }
            : fm
        ),
      };
    });
  }, [project, selectedCue, setProjectSafe]);

  /**
   * ステージ上部の「名簿取り込み」ボタンから名簿ファイルを選んで、
   * 新しい名簿（Crew）として `project.crews` に追加する。
   *
   * 対応形式: CSV / TSV / TXT / XLSX / XLS / XLSM / ODS / HTML / PDF
   * - 1 列目に名前が入っていれば見出しなしでも取り込める。
   * - XLSX や PDF など重いライブラリは選択時に動的読み込みされる。
   * - PDF はレイアウト依存で結果が崩れることがあるため、取り込み後に確認を促す。
   */
  const importCrewCsvFromStageToolbar = useCallback(() => {
    if (!project || project.viewMode === "view") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ROSTER_FILE_ACCEPT;
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const result = await parseRosterFile(f);
        const defaultName =
          result.baseName || `名簿 ${(project.crews?.length ?? 0) + 1}`;
        setRosterImportNameMode("full");
        setRosterImportExtraNames([]);
        setRosterImportDraft({
          rows: result.rows,
          baseName: defaultName,
          kind: result.kind,
          notice: result.notice,
        });
      } catch (e) {
        window.alert(
          e instanceof Error ? e.message : "ファイルの読み込みに失敗しました"
        );
      }
    };
    input.click();
  }, [project, setProjectSafe]);

  const openSetPiecePicker = useCallback(() => {
    if (!project || project.viewMode === "view") return;
    const fid =
      selectedCue?.formationId ??
      project.formations.find((x) => x.id === project.activeFormationId)?.id ??
      project.formations[0]?.id;
    if (!fid) return;
    setSetPiecePickerOpen(true);
  }, [project, selectedCue]);

  /**
   * 「立ち位置保存」ボタン押下 → 管理ダイアログを開く。
   */
  const saveStageToFormationBox = useCallback(() => {
    if (!project || project.viewMode === "view") return;
    setFormationBoxManagerOpen(true);
  }, [project]);

  const confirmAddSetPiece = useCallback(
    (opts: SetPiecePickerSubmit) => {
      if (!project || project.viewMode === "view") return;
      const fid =
        selectedCue?.formationId ??
        project.formations.find((x) => x.id === project.activeFormationId)?.id ??
        project.formations[0]?.id;
      if (!fid) return;
      const pieceId = crypto.randomUUID();
      const kind: SetPieceKind = opts.kind;
      const onScreen = Boolean(opts.placeOnEditorSurface);
      const wPct = onScreen
        ? kind === "ellipse"
          ? 12
          : 14
        : kind === "ellipse"
          ? 20
          : 24;
      const hPct = onScreen
        ? kind === "ellipse"
          ? 12
          : 11
        : kind === "ellipse"
          ? 20
          : 18;
      const xPct = onScreen ? 8 : 38;
      const yPct = onScreen ? 10 : 32;
      setProjectSafe((p) => ({
        ...p,
        formations: p.formations.map((fm) =>
          fm.id === fid
            ? {
                ...fm,
                setPieces: [
                  ...(fm.setPieces ?? []),
                  {
                    id: pieceId,
                    kind,
                    fillColor: opts.fillColor,
                    label: `大道具${(fm.setPieces?.length ?? 0) + 1}`,
                    xPct,
                    yPct,
                    wPct,
                    hPct,
                    ...(onScreen ? { layer: "screen" as const } : {}),
                    interpolateInGaps: false,
                  },
                ],
              }
            : fm
        ),
      }));
      setSetPiecePickerOpen(false);
    },
    [project, selectedCue, setProjectSafe]
  );

  const onStopPlaybackFromStage = useCallback(() => {
    timelineRef.current?.stopPlayback();
  }, []);

  const performCloudSave = useCallback(async () => {
    if (!me) return;
    const live = projectSaveRef.current;
    if (!live) return;
    setCloudSaveDialogOpen(false);
    setSaving(true);
    try {
      let json: ChoreographyProjectJson;
      try {
        json = normalizeProject(
          JSON.parse(JSON.stringify(live)) as ChoreographyProjectJson
        );
      } catch {
        alert(
          "作品データの保存用コピーを作れませんでした。ページを再読み込みしてから再度お試しください。"
        );
        return;
      }
      const title =
        json.pieceTitle?.trim() || projectName.trim() || "無題の作品";
      const body: ChoreographyProjectJson = { ...json, pieceTitle: title };
      if (serverId != null) {
        const row = await projectApi.update(serverId, title, body);
        setProjectName(title);
        if (row.share_token) setServerShareToken(row.share_token);
      } else {
        const row = await projectApi.create(title, body);
        setServerId(row.id);
        if (row.share_token) setServerShareToken(row.share_token);
        navigate(`/editor/${row.id}`, {
          replace: true,
          state: {
            editorSeed: body,
            editorSeedProjectId: row.id,
          },
        });
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [me, projectName, serverId, navigate]);
  const handleAddCueCreated = useCallback(
    (cueId: string, startSec: number) => {
      setSelectedCueIds([cueId]);
      setIsPlaying(false);
      if (typeof startSec === "number" && Number.isFinite(startSec)) {
        timelineRef.current?.pauseAndSeekToSec(startSec);
      }
    },
    []
  );

  const exportDialogEl = useMemo(
    () =>
      project ? (
        <ExportDialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          project={project}
          projectName={projectName}
          stage2dVisible={stageView === "2d"}
        />
      ) : null,
    [project, exportDialogOpen, projectName, stageView]
  );

  const flowLibraryDialogEl = useMemo(
    () =>
      project ? (
        <FlowLibraryDialog
          open={flowLibraryOpen}
          onClose={() => setFlowLibraryOpen(false)}
          serverId={serverId}
          serverShareToken={serverShareToken}
          project={project}
          setProject={setProjectSafe}
          audioDurationSec={duration}
          getWavePeaks={() => timelineRef.current?.getWavePeaksSnapshot() ?? null}
          onRestoreWaveform={(peaks, dur) => {
            timelineRef.current?.restoreWavePeaks(peaks, dur);
          }}
          getAudioBlobForFlowLibrary={() =>
            timelineRef.current?.getCurrentAudioBlobForFlowLibrary() ?? Promise.resolve(null)
          }
        />
      ) : null,
    [project, flowLibraryOpen, setProjectSafe, duration, serverId, serverShareToken]
  );

  /** 立ち位置管理ダイアログに渡す現在のダンサー */
  const formationBoxCurrentDancers = useMemo((): DancerSpot[] => {
    if (!project) return [];
    const fid =
      selectedCue?.formationId ??
      project.formations.find((x) => x.id === project.activeFormationId)?.id ??
      project.formations[0]?.id;
    if (!fid) return [];
    return project.formations.find((x) => x.id === fid)?.dancers ?? [];
  }, [project, selectedCue]);

  const formationBoxManagerDialogEl = (
    <FormationBoxManagerDialog
      open={formationBoxManagerOpen}
      onClose={() => setFormationBoxManagerOpen(false)}
      currentDancers={formationBoxCurrentDancers}
    />
  );

  const addCueDialogEl = useMemo(
    () =>
      project ? (
        <AddCueWithFormationDialog
          open={addCueDialogOpen}
          onClose={() => setAddCueDialogOpen(false)}
          project={project}
          setProject={setProjectSafe}
          currentTimeSec={currentTime}
          durationSec={duration}
          selectedCueId={selectedCueId}
          onStagePreviewChange={setStagePreviewDancers}
          onImportRoster={importCrewCsvFromStageToolbar}
          onCueCreated={handleAddCueCreated}
        />
      ) : null,
    [
      project,
      addCueDialogOpen,
      setProjectSafe,
      currentTime,
      duration,
      selectedCueId,
      importCrewCsvFromStageToolbar,
      handleAddCueCreated,
    ]
  );

  const rosterImportSheetEl = useMemo(
    () =>
      project && rosterImportDraft ? (
        <EditorSideSheet
          open
          zIndex={60}
          width="min(320px, 90vw)"
          onClose={() => {
            setRosterImportDraft(null);
            setRosterImportExtraNames([]);
          }}
          ariaLabelledBy="roster-import-dialog-title"
        >
          <div style={{ padding: "14px 16px" }}>
            <div
              id="roster-import-dialog-title"
              style={{ fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}
            >
              名簿を取り込みます
            </div>
            <p style={{ margin: "0 0 10px", fontSize: "11px", color: "#94a3b8", lineHeight: 1.45, wordBreak: "break-all" }}>
              ステージ表示は最大8文字。同名の場合は苗字の頭1文字を自動付加。「出欠」列があれば参加行のみ取込。フリガナ列があれば下の設定で表示名を選択できます。
            </p>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
              表示名の取り込み方
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "6px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              <input
                type="radio"
                name="roster-import-name-mode"
                checked={rosterImportNameMode === "full"}
                onChange={() => setRosterImportNameMode("full")}
              />
              <span><strong>フルネーム</strong><span style={{ color: "#64748b", marginLeft: 4 }}>（姓＋名）</span></span>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "6px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              <input
                type="radio"
                name="roster-import-name-mode"
                checked={rosterImportNameMode === "family_only"}
                onChange={() => setRosterImportNameMode("family_only")}
              />
              <span><strong>苗字だけ</strong><span style={{ color: "#64748b", marginLeft: 4 }}>（姓のみ）</span></span>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "12px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              <input
                type="radio"
                name="roster-import-name-mode"
                checked={rosterImportNameMode === "given_only"}
                onChange={() => setRosterImportNameMode("given_only")}
              />
              <span><strong>名前だけ</strong><span style={{ color: "#64748b", marginLeft: 4 }}>（名のみ）</span></span>
            </label>
            <div
              style={{
                marginBottom: "12px",
                paddingTop: "8px",
                borderTop: "1px solid #334155",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#cbd5e1",
                  marginBottom: "6px",
                }}
              >
                メンバーを追加（任意）
              </div>
              {rosterImportExtraNames.map((extraName, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "6px",
                  }}
                >
                  <input
                    type="text"
                    value={extraName}
                    placeholder="表示名"
                    maxLength={120}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRosterImportExtraNames((prev) =>
                        prev.map((x, j) => (j === idx ? v : x))
                      );
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: "1px solid #334155",
                      background: "#020617",
                      color: "#e2e8f0",
                      fontSize: "12px",
                    }}
                  />
                  <button
                    type="button"
                    style={{
                      ...btnSecondary,
                      flexShrink: 0,
                      fontSize: "11px",
                      padding: "6px 8px",
                    }}
                    onClick={() =>
                      setRosterImportExtraNames((prev) =>
                        prev.filter((_, j) => j !== idx)
                      )
                    }
                  >
                    削除
                  </button>
                </div>
              ))}
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  fontSize: "12px",
                  padding: "6px 10px",
                  borderColor: "#0369a1",
                  color: "#7dd3fc",
                }}
                onClick={() =>
                  setRosterImportExtraNames((prev) => [...prev, ""])
                }
              >
                ＋メンバーを追加
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                style={btnSecondary}
                onClick={() => {
                  setRosterImportDraft(null);
                  setRosterImportExtraNames([]);
                }}
              >
                キャンセル
              </button>
              <button
                type="button"
                style={{
                  ...btnSecondary,
                  borderColor: "#0284c7",
                  background: "#0ea5e9",
                  color: "#0b1220",
                  fontWeight: 600,
                }}
                onClick={() => {
                  if (!project) return;
                  const d = rosterImportDraft;
                  const extraRows = rosterImportExtraNames
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
                    .map((label) => [label] as string[]);
                  const mergedRows = [...d.rows, ...extraRows];
                  let att = { excludedRows: 0, hadAttendanceColumn: false };
                  const crew = buildCrewFromRows(d.baseName, mergedRows, {
                    nameMode: rosterImportNameMode,
                    onAttendanceFiltered: (info) => {
                      att = info;
                    },
                  });
                  if (crew.members.length === 0) {
                    let msg =
                      `${labelForKind(d.kind)} から名前らしき列を見つけられませんでした。\n` +
                      "1 列目に名前を入れるか、見出し行に「名前」「姓」「名」「label」「name」などを含めてください。";
                    if (att.hadAttendanceColumn) {
                      msg +=
                        "\n\n出欠列は検出されましたが、参加（○・参加 など）と判定できる行がありませんでした。";
                    }
                    window.alert(msg);
                    return;
                  }
                  setProjectSafe((p) => {
                    const sorted = sortCuesByStart(p.cues);
                    const firstCue = sorted[0];
                    const nextCues =
                      firstCue &&
                      firstCue.formationId !== p.activeFormationId
                        ? p.cues.map((c) =>
                            c.id === firstCue.id
                              ? { ...c, formationId: p.activeFormationId }
                              : c
                          )
                        : p.cues;
                    return {
                      ...p,
                      crews: [...p.crews, crew],
                      cues: nextCues,
                      rosterStripCollapsed: false,
                      /**
                       * 名簿取り込み直後はタイムライン全面表示のままにし、
                       * 波形用 TimelinePanel をアンマウントしない（ワイドでは常に上部ドック）。
                       * 名簿一覧は「メンバーを表示」またはページャで切り替え可能。
                       */
                      rosterHidesTimeline: false,
                      dancerMarkerDiameterPx:
                        dancerMarkerDiameterAfterRosterImport(
                          p.dancerMarkerDiameterPx
                        ),
                    };
                  });
                  /** 先頭キュー（ページ 1）を選択し、いまのステージの形と同期 */
                  window.setTimeout(() => {
                    jumpToPagerSlotRef.current(1);
                  }, 0);
                  setRosterImportDraft(null);
                  setRosterImportExtraNames([]);
                  const attLine =
                    att.hadAttendanceColumn && att.excludedRows > 0
                      ? `\n（出欠で不参加・空欄など ${att.excludedRows} 行をスキップ）`
                      : "";
                  if (d.notice) {
                    window.alert(
                      `${labelForKind(d.kind)} から ${crew.members.length} 名を取り込みました。${attLine}\n\n` +
                        d.notice
                    );
                  } else {
                    window.alert(
                      `${labelForKind(d.kind)} から ${crew.members.length} 名を取り込みました。${attLine}`
                    );
                  }
                }}
              >
                取り込む
              </button>
            </div>
          </div>
        </EditorSideSheet>
      ) : null,
    [
      project,
      rosterImportDraft,
      rosterImportNameMode,
      rosterImportExtraNames,
      setProjectSafe,
      setRosterImportDraft,
      setRosterImportNameMode,
      setRosterImportExtraNames,
      btnSecondary,
    ]
  );

  const studentViewerFocusForStage = useMemo(() => {
    if (choreoPublicView) {
      if (!choreoStudentPick) return null;
      return studentPickToStageFocus(choreoStudentPick);
    }
    if (editorViewerPreviewPick) {
      return studentPickToStageFocus(editorViewerPreviewPick);
    }
    return null;
  }, [choreoPublicView, choreoStudentPick, editorViewerPreviewPick]);

  if (loadError) {
    return (
      <div style={{ padding: 24, color: "#f87171" }}>
        {loadError}{" "}
        <Link to="/library" style={{ color: "#93c5fd" }}>
          戻る
        </Link>
      </div>
    );
  }

  if (collabActive && !yjsCollab.synced) {
    return (
      <div style={{ padding: 24, color: "#94a3b8" }}>
        共同編集を同期しています…（Yjs）
      </div>
    );
  }

  if (!project) {
    return <div style={{ padding: 24, color: "#94a3b8" }}>読み込み中…</div>;
  }

  if (choreoPublicView) {
    if (choreoStudentPick == null) {
      if (choreoGatePhase === "remind" && choreoStoredPick) {
        return (
          <ChoreoStudentViewGate
            pieceTitle={project.pieceTitle}
            entries={getViewRosterEntries(project)}
            gateMode="remind"
            lastPick={choreoStoredPick}
            onRemindContinue={() => {
              setChoreoStudentPick(choreoStoredPick);
            }}
            onRemindChooseOther={() => {
              setChoreoGatePhase("pick");
              setChoreoStoredPick(null);
            }}
            onPick={() => {}}
          />
        );
      }
      return (
        <ChoreoStudentViewGate
          pieceTitle={project.pieceTitle}
          entries={getViewRosterEntries(project)}
          gateMode="pick"
          onPick={(p) => {
            setChoreoStudentPick(p);
            if (viewerLocalStorageKey) {
              try {
                localStorage.setItem(viewerLocalStorageKey, JSON.stringify(p));
              } catch {
                /* ignore */
              }
            }
          }}
        />
      );
    }
  }

  const stageBoardProject = projectForStageBoard!;

  const hasRosterMembers = project.crews.some((c) => c.members.length > 0);
  /** 名簿ストリップのみ表示しタイムライン列を隠す（取り込み直後や「メンバーを表示」から） */
  const rosterOnlyMode =
    project.rosterHidesTimeline === true && hasRosterMembers;
  /** ワイド時は常に上部に波形・再生を固定（名簿モードでも TimelinePanel を外さない） */
  const showTopWaveDock = wideEditorLayout;
  /** ステージのみ全画面（ワイド時のみ有効） */
  const stageZenLayout = wideEditorLayout && stageZenFullscreen;
  /** 固定シェル時：名簿行の有無で上部ドックの確保高さを変え、波形が切れないようにする */
  const editorShellTopWavePx =
    EDITOR_SHELL_TOP_WAVE_BASE_PX +
    (hasRosterMembers && project.rosterHidesTimeline !== true
      ? EDITOR_SHELL_TOP_WAVE_ROSTER_ROW_PX
      : 0);

  const editorPaneGridTemplateRows = stageZenLayout
    ? "1fr"
    : wideEditorLayout
      ? showTopWaveDock
        ? editorFixedWaveDockLayout
          ? `${
              topDockRowPx != null
                ? clampTopDockRowPx(topDockRowPx)
                : editorShellTopWavePx
            }px 4px minmax(0, 1fr)`
          : `${
              topDockRowPx != null
                ? `${topDockRowPx}px`
                : `${TOP_DOCK_HEIGHT_PX}px`
            } 4px minmax(0, 1fr)`
        : "1fr"
      : "auto auto auto auto";

  const editorPaneGridTemplateColumns = stageZenLayout
    ? "1fr"
    : editorGridColumns;

  const choreoToolbarSharedProps = {
    stageShapeActive:
      (project.stageShape != null &&
        project.stageShape.presetId !== "rectangle") ||
      (project.hanamichiEnabled ?? false),
    disabled: project.viewMode === "view",
    onOpenStageShapePicker: () => setStageShapePickerOpen(true),
    onOpenSetPiecePicker: openSetPiecePicker,
    onOpenShortcutsHelp: () => setShortcutsHelpOpen(true),
    onOpenExport: () => setExportDialogOpen(true),
  };

  const timelinePanelEl = (
    <TimelinePanel
      ref={timelineRef}
      project={project}
      setProject={setProjectSafe}
      currentTime={currentTime}
      setCurrentTime={setCurrentTime}
      isPlaying={isPlaying}
      setIsPlaying={setIsPlaying}
      duration={duration}
      setDuration={setDuration}
      serverProjectId={serverId}
      loggedIn={!!me}
      onStagePreviewChange={setStagePreviewDancers}
      onFormationChosenFromCueList={() => setIsPlaying(false)}
      onUndo={undo}
      onRedo={redo}
      undoDisabled={
        project.viewMode === "view" ||
        (collabActive
          ? yjsCollab.undoStackSize === 0
          : historyRef.current.undo.length === 0)
      }
      redoDisabled={
        project.viewMode === "view" ||
        (collabActive
          ? yjsCollab.redoStackSize === 0
          : historyRef.current.redo.length === 0)
      }
      selectedCueIds={selectedCueIds}
      onSelectedCueIdsChange={setSelectedCueIds}
      formationIdForNewCue={selectedCue?.formationId ?? project.activeFormationId}
      wideWorkbench={wideEditorLayout}
      compactTopDock={showTopWaveDock}
      cueListPortalTarget={showTopWaveDock ? cueListPortalEl : null}
      onSave={() => setFlowLibraryOpen(true)}
    />
  );

  const stageUndoDisabled =
    project.viewMode === "view" ||
    (collabActive
      ? yjsCollab.undoStackSize === 0
      : historyRef.current.undo.length === 0);
  const stageRedoDisabled =
    project.viewMode === "view" ||
    (collabActive
      ? yjsCollab.redoStackSize === 0
      : historyRef.current.redo.length === 0);
  const workbenchInRightRail = wideEditorLayout && !rightPaneCollapsed;

  const stageWorkbenchProps: Omit<EditorStageWorkbenchProps, "layout"> = {
    project,
    setProjectSafe,
    selectedCueId,
    selectedCue: selectedCue ?? null,
    stageAreaSettingsOpen,
    setStageAreaSettingsOpen,
    stageUndoDisabled,
    stageRedoDisabled,
    undo,
    redo,
    setAddCueDialogOpen,
    saveStageToFormationBox,
    setFlowLibraryOpen,
    addDancerFromStageToolbar,
    importCrewCsvFromStageToolbar,
    stageView,
    setStageView,
    floorTextPlaceSession,
    setFloorTextPlaceSession,
    commitFloorTextPlace,
    hasRosterMembers,
    /** 右列でもステージ床テキストを配置できるように常に出す（上部ドック時も非表示にしない） */
    hideFloorTextToolbar: false,
    hideUndoRedoInRail: showTopWaveDock,
    choreoToolbarProps: choreoToolbarSharedProps,
    onOpenCueListModal: showTopWaveDock
      ? () => setCueListModalOpen(true)
      : undefined,
    onOpenAudioImport: () => {
      timelineRef.current?.openAudioImport();
    },
    onPreloadFfmpegForAudio: () => {
      void preloadFFmpeg();
    },
    onEnterStageZen: () => {
      setFloorTextPlaceSession(null);
      setStageZenFullscreen(true);
    },
    stageZenEligible: showTopWaveDock && !rightPaneCollapsed,
    onOpenShareLinks: choreoPublicView ? undefined : () => setShareLinksOpen(true),
    /** false: 未保存でも押せる。シート側でクラウド保存の案内を出す（serverId なしで無効化すると「動かない」ように見える） */
    shareLinksButtonDisabled: false,
    onOpenViewerMode: choreoPublicView
      ? () => setChoreoMemberSheetOpen(true)
      : () => setEditorViewerSheetOpen(true),
  };


  return (
    <div
      className={choreoPublicView ? "choreo-public-view-root" : undefined}
      style={{
        width: "100%",
        maxWidth: "100vw",
        height: "100dvh",
        minHeight: "100dvh",
        maxHeight: "100dvh",
        overflow: "hidden",
        background: shell.bgDeep,
        color: shell.text,
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        WebkitFontSmoothing: "antialiased",
        display: "flex",
        flexDirection: "column",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxSizing: "border-box",
      }}
    >
      {!choreoPublicView ? (
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          alignItems: "center",
          padding:
            "max(4px, env(safe-area-inset-top, 0px)) max(8px, env(safe-area-inset-right, 0px)) 4px max(8px, env(safe-area-inset-left, 0px))",
          borderBottom: `1px solid ${shell.border}`,
          background: shell.bgChrome,
          minHeight: 0,
          flexShrink: 0,
        }}
      >
        <Link
          to="/library"
          title={t("editor.backTitle")}
          aria-label={t("editor.backTitle")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            flexShrink: 0,
            textDecoration: "none",
            borderRadius: 8,
            color: shell.textMuted,
          }}
        >
          {/** 「く」の向きを反転した一本の角括弧（戻る） */}
          <span
            aria-hidden
            style={{
              fontSize: "22px",
              fontWeight: 500,
              lineHeight: 1,
              fontFamily: "ui-serif, 'Hiragino Mincho ProN', serif",
              letterSpacing: "-0.12em",
            }}
          >
            〉
          </span>
        </Link>
        <ChoreoCoreLogo
          height={40}
          title="ChoreoCore"
          style={{ flexShrink: 0, marginLeft: 4 }}
        />
        <div style={{ flex: "1 1 auto", minWidth: 8 }} aria-hidden />
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "11px",
            color: shell.textMuted,
            flexShrink: 0,
          }}
          title={t("editor.headcount")}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            aria-hidden
            style={{ display: "block", opacity: 0.75 }}
          >
            <circle cx="12" cy="9" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M6 20c0-4 3.5-6 6-6s6 2 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="number"
            min={1}
            max={200}
            step={1}
            placeholder="—"
            title="作品の想定人数（メモ用。各フォーメーションの人数とは別です）"
            disabled={project.viewMode === "view"}
            value={project.pieceDancerCount ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === "") {
                setProjectSafe((p) => ({ ...p, pieceDancerCount: null }));
                return;
              }
              const n = Number(raw);
              if (!Number.isFinite(n)) return;
              setProjectSafe((p) => ({
                ...p,
                pieceDancerCount: Math.max(1, Math.min(200, Math.floor(n))),
              }));
            }}
            style={{
              ...inputField,
              width: "56px",
              padding: "6px 8px",
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </label>
        {me ? (
          <button
            type="button"
            style={{
              ...btnAccent,
              padding: "7px 14px",
              fontSize: "12px",
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              ...(saving
                ? { opacity: 0.65, cursor: "wait", boxShadow: "none" }
                : {}),
            }}
            disabled={saving}
            title={
              serverId ? t("editor.saveTitleOverwrite") : t("editor.saveTitleNew")
            }
            aria-label={
              saving
                ? t("editor.savingAria")
                : serverId
                  ? t("editor.saveTitleOverwrite")
                  : t("editor.saveTitleNew")
            }
            onClick={() => setCloudSaveDialogOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              width={16}
              height={16}
              aria-hidden
              style={{ display: "block", opacity: 0.9 }}
            >
              <path
                d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M8 11h8M8 15h5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <span>
              {saving ? t("editor.saving") : serverId ? t("editor.saveOverwrite") : t("editor.save")}
            </span>
          </button>
        ) : null}
      </header>
      ) : null}

      <div
        ref={(el) => {
          editorPaneRef.current = el;
          setEditorSurfaceEl((prev) => (prev === el ? prev : el));
        }}
        className="editor-three-pane"
        style={{
          position: "relative",
          flex: 1,
          display: "grid",
          gridTemplateColumns: editorPaneGridTemplateColumns,
          gridTemplateRows: editorPaneGridTemplateRows,
          gap: `${EDITOR_GRID_GAP_PX}px`,
          padding:
            "6px max(6px, env(safe-area-inset-right, 0px)) calc(max(8px, 2cm) + env(safe-area-inset-bottom, 0px)) max(6px, env(safe-area-inset-left, 0px))",
          paddingBottom:
            choreoPublicView && choreoStudentPick
              ? "calc(8px + 140px + env(safe-area-inset-bottom, 0px))"
              : undefined,
          /** 狭い画面では負のマージンを付けない（レイアウト再計算・はみ出しを抑えスマホで滑らかに） */
          marginTop: wideEditorLayout
            ? `calc(-1 * ${EDITOR_PLAYBACK_LAYOUT_SHIFT_UP})`
            : 0,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {showTopWaveDock && !stageZenLayout ? (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="波形・再生エリアの高さを変更（ダブルクリックで既定に戻す）"
            title="上下ドラッグで高さを調整（ダブルクリックで既定に戻す）"
            onPointerDown={onTopDockResizeDown}
            onPointerMove={onTopDockResizeMove}
            onPointerUp={endTopDockResize}
            onPointerCancel={endTopDockResize}
            onDoubleClick={onTopDockResizeDoubleClick}
            style={{
              gridColumn: "1 / -1",
              gridRow: 2,
              cursor: "row-resize",
              touchAction: "none",
              userSelect: "none",
              alignSelf: "stretch",
              justifySelf: "stretch",
              position: "relative",
              zIndex: 2,
              flexShrink: 0,
              pointerEvents: "auto",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "50%",
                transform: "translateY(-50%)",
                height: 1,
                background: "#334155",
              }}
            />
          </div>
        ) : null}
        {!wideEditorLayout && !choreoPublicView ? (
          <div
            style={{
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              gridRow: 1,
            }}
          >
            <ChoreoCoreToolbar {...choreoToolbarSharedProps} />
          </div>
        ) : null}
        <section
          ref={stageSectionRef}
          style={{
            ...panelCard,
            padding: "5px",
            minHeight: 0,
            minWidth: 0,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            ...(wideEditorLayout
              ? {
                  gridColumn: stageZenLayout ? "1 / -1" : 1,
                  gridRow: stageZenLayout
                    ? "1 / -1"
                    : showTopWaveDock
                      ? 3
                      : 1,
                  ...(stageZenLayout
                    ? { position: "relative" as const }
                    : {}),
                }
              : { gridRow: 2 }),
          }}
        >
          {stageZenLayout ? (
            <button
              type="button"
              onClick={() => setStageZenFullscreen(false)}
              style={{
                position: "absolute",
                top: 8,
                right: 10,
                zIndex: 200,
                ...btnSecondary,
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 700,
              }}
              title="ステージ拡大を終了（Esc でも戻ります）"
              aria-label="縮小して通常表示に戻す"
            >
              縮小
            </button>
          ) : null}
          {wideEditorLayout && rightPaneCollapsed ? (
            <section
              style={{
                ...panelCard,
                padding: "8px",
                marginBottom: "6px",
                flexShrink: 0,
                minWidth: 0,
              }}
            >
              <ChoreoCoreToolbar embedInPanel {...choreoToolbarSharedProps} />
            </section>
          ) : null}
          {!workbenchInRightRail && !stageZenLayout ? (
            <div
              style={
                floorTextPlaceSession
                  ? {
                      position: "relative",
                      zIndex: 130,
                      flexShrink: 0,
                      minWidth: 0,
                      width: "100%",
                    }
                  : { flexShrink: 0, minWidth: 0, width: "100%" }
              }
            >
              <EditorStageWorkbench key="stage-wb" layout="stage" {...stageWorkbenchProps} />
            </div>
          ) : null}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              display: "flex",
              flexDirection: "row",
              alignItems: "stretch",
              gap: 0,
            }}
          >
            <div
              style={{
                position: "relative",
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/*
                キュー・2D/3D は床と重ねない（絶対配置＋高 z-index だと回転ハンドルが隠れる）。
                ステージ列の右上に、床の上の一行として並べる。
              */}
              <div
                style={{
                  flexShrink: 0,
                  display: stageZenLayout ? "none" : "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 3,
                  padding: "0 2px 2px",
                  minWidth: 0,
                  maxWidth: "100%",
                  pointerEvents: "auto",
                }}
              >
                {cuesSortedForStageJump.length > 0 || hasRosterMembers ? (
                  <div
                    style={{
                      flexShrink: 0,
                      maxWidth: "min(200px, 100%)",
                      lineHeight: 0,
                    }}
                  >
                    <WorkbenchCuePager
                      variant="stageCorner"
                      project={project}
                      cuesSortedForStageJump={cuesSortedForStageJump}
                      selectedCueId={selectedCueId}
                      jumpToPagerSlot={jumpToPagerSlot}
                      includeRosterSlot={hasRosterMembers}
                      rosterTimelineHidden={
                        project.rosterHidesTimeline === true
                      }
                    />
                  </div>
                ) : null}
                <div
                  role="group"
                  aria-label="ステージを 2D または 3D で表示"
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    style={{
                      ...btnSecondary,
                      padding: "2px 6px",
                      fontSize: "9px",
                      fontWeight: 700,
                      lineHeight: 1.2,
                      borderRadius: 5,
                      ...(stageView === "2d"
                        ? { borderColor: "#6366f1", color: "#c7d2fe" }
                        : {}),
                    }}
                    title="平面の編集ステージ"
                    onClick={() => setStageView("2d")}
                  >
                    2D
                  </button>
                  <button
                    type="button"
                    style={{
                      ...btnSecondary,
                      padding: "2px 6px",
                      fontSize: "9px",
                      fontWeight: 700,
                      lineHeight: 1.2,
                      borderRadius: 5,
                      ...(stageView === "3d"
                        ? { borderColor: "#6366f1", color: "#c7d2fe" }
                        : {}),
                    }}
                    title="簡易 3D プレビュー"
                    onClick={() => setStageView("3d")}
                  >
                    3D
                  </button>
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {stageView === "2d" ? (
                  <StageBoard
                    project={stageBoardProject}
                    setProject={setProjectSafe}
                    playbackDancers={playbackDancersForStage}
                    browseFormationDancers={browseFormationDancers}
                    previewDancers={stagePreviewDancers}
                    playbackSetPieces={playbackSetPiecesForStage}
                    browseSetPieces={browseSetPieces}
                    playbackFloorMarkup={playbackFloorMarkupForStage}
                    browseFloorMarkup={browseFloorMarkup}
                    isPlaying={isPlaying}
                    onStopPlaybackRequest={onStopPlaybackFromStage}
                    editFormationId={
                      selectedCue?.formationId ?? project.activeFormationId
                    }
                    stageInteractionsEnabled={
                      project.viewMode !== "view" &&
                      (project.cues.length === 0 || Boolean(selectedCueId))
                    }
                    floorTextPlaceSession={floorTextPlaceSession}
                    onFloorTextPlaceSessionChange={onFloorTextPlaceSessionChange}
                    floorMarkupTool={floorMarkupTool}
                    onFloorMarkupToolChange={setFloorMarkupTool}
                    hideFloorMarkupFloatingToolbars={showTopWaveDock}
                    onGestureHistoryBegin={
                      collabActive ? undefined : beginGestureHistory
                    }
                    onGestureHistoryEnd={
                      collabActive ? undefined : endGestureHistory
                    }
                    onGestureHistoryCancel={
                      collabActive ? undefined : cancelGestureHistory
                    }
                    markHistorySkipNextPush={
                      collabActive ? undefined : markHistorySkipNextPush
                    }
                    viewportTextOverlayRoot={editorSurfaceEl}
                    studentViewerFocus={studentViewerFocusForStage}
                  />
                ) : (
                  <Suspense
                    fallback={
                      <div
                        style={{ padding: 24, color: shell.textSubtle, fontSize: "13px" }}
                      >
                        3D ビューを読み込み中…
                      </div>
                    }
                  >
                    <Stage3DView
                      dancers={dancersFor3d}
                      markerDiameterPx={
                        project.dancerMarkerDiameterPx ??
                        DEFAULT_DANCER_MARKER_DIAMETER_PX
                      }
                    />
                  </Suspense>
                )}
              </div>
            </div>
          </div>
        </section>

        {/*
          タイムラインは常にこの 1 ブロックだけにマウントする（ワイド⇔狭いで別ブランチに置くと
          TimelinePanel が再マウントされ、波形・音源の内部状態が消える）。
          グリッド行だけワイド時は 1 行目、狭いときはステージの下（3 行目）に固定する。
        */}
        {!stageZenLayout ? (
          <section
            ref={(el) => {
              topDockSectionRef.current = el;
            }}
            style={{
              gridColumn:
                wideEditorLayout && showTopWaveDock ? "1 / -1" : 1,
              gridRow: wideEditorLayout && showTopWaveDock ? 1 : 3,
              ...(wideEditorLayout && showTopWaveDock
                ? {
                    background: "transparent",
                    border: "none",
                    padding: "0 4px 6px",
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "visible",
                    flexShrink: 0,
                    minHeight: 0,
                  }
                : {
                    ...panelCard,
                    padding: rosterOnlyMode ? "8px 10px" : "12px",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    minHeight: 0,
                    ...(rosterOnlyMode
                      ? {
                          flex: "0 0 auto",
                          maxHeight: "min(42vh, 380px)",
                          flexShrink: 0,
                        }
                      : rightPaneTopSectionStyle),
                  }),
            }}
          >
            {wideEditorLayout &&
            showTopWaveDock &&
            hasRosterMembers &&
            !project.rosterHidesTimeline ? (
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  justifyContent: "flex-end",
                  padding: "0 4px 2px",
                }}
              >
                <button
                  type="button"
                  disabled={project.viewMode === "view"}
                  title="右列で名簿一覧を表示し、タイムラインは隠します"
                  onClick={() =>
                    setProjectSafe((p) => ({
                      ...p,
                      rosterHidesTimeline: true,
                      rosterStripCollapsed: false,
                    }))
                  }
                  style={{
                    fontSize: "11px",
                    padding: "4px 10px",
                    borderRadius: "8px",
                    border: "1px solid #14532d",
                    background: "#14532d",
                    color: "#dcfce7",
                    cursor:
                      project.viewMode === "view" ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  メンバーを表示
                </button>
              </div>
            ) : null}
            {!wideEditorLayout ? (
              rosterOnlyMode ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "6px",
                    flexShrink: 0,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: shell.textMuted,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    波形・再生
                  </h2>
                  <button
                    type="button"
                    disabled={project.viewMode === "view"}
                    title="右列でタイムライン・楽曲を全面表示する"
                    onClick={() => {
                      setProjectSafe((p) => ({ ...p, rosterHidesTimeline: false }));
                      onRosterConfirmReturnToTimeline();
                    }}
                    style={{
                      ...btnSecondary,
                      fontSize: "11px",
                      padding: "4px 10px",
                      marginLeft: "auto",
                      flexShrink: 0,
                    }}
                  >
                    タイムラインを全表示
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "8px",
                    rowGap: "6px",
                    marginBottom: "8px",
                    flexShrink: 0,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: shell.textMuted,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    タイムライン・楽曲
                  </h2>
                  <button
                    type="button"
                    style={{
                      ...btnSecondary,
                      borderColor: "#0284c7",
                      background: "#0ea5e9",
                      color: "#0b1220",
                      padding: "5px 9px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                    disabled={project.viewMode === "view"}
                    title="＋キュー：人数と立ち位置の決め方（変更／複製／雛形／保存リスト）を選んで追加"
                    aria-label="新しいキューを追加"
                    onClick={() => setAddCueDialogOpen(true)}
                  >
                    <svg
                      viewBox="0 0 22 14"
                      width="20"
                      height="13"
                      aria-hidden
                      style={{ display: "block" }}
                    >
                      <path
                        d="M3 7 L9 7 M6 4 L6 10"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <circle cx="13" cy="3" r="1.2" fill="currentColor" />
                      <circle cx="17" cy="3" r="1.2" fill="currentColor" />
                      <circle cx="12" cy="8" r="1.2" fill="currentColor" />
                      <circle cx="15" cy="8" r="1.2" fill="currentColor" />
                      <circle cx="18" cy="8" r="1.2" fill="currentColor" />
                      <circle
                        cx="13.5"
                        cy="12"
                        r="1"
                        fill="currentColor"
                        opacity="0.7"
                      />
                      <circle
                        cx="16.5"
                        cy="12"
                        r="1"
                        fill="currentColor"
                        opacity="0.7"
                      />
                    </svg>
                    <span style={{ fontSize: "11px", fontWeight: 700 }}>キュー</span>
                  </button>
                  {hasRosterMembers && !project.rosterHidesTimeline ? (
                    <button
                      type="button"
                      disabled={project.viewMode === "view"}
                      title="名簿一覧を表示し、タイムライン列は隠します"
                      onClick={() =>
                        setProjectSafe((p) => ({
                          ...p,
                          rosterHidesTimeline: true,
                          rosterStripCollapsed: false,
                        }))
                      }
                      style={{
                        fontSize: "11px",
                        padding: "4px 10px",
                        borderRadius: "8px",
                        border: "1px solid #14532d",
                        background: "#14532d",
                        color: "#dcfce7",
                        cursor:
                          project.viewMode === "view" ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        flexShrink: 0,
                        marginLeft: "auto",
                      }}
                    >
                      メンバーを表示
                    </button>
                  ) : null}
                </div>
              )
            ) : null}
            <div
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                ...(wideEditorLayout && showTopWaveDock
                  ? {
                      overflowX: "hidden" as const,
                      overflowY: "auto" as const,
                    }
                  : {}),
              }}
            >
              {timelinePanelEl}
            </div>
          </section>
        ) : null}

        {wideEditorLayout && !rightPaneCollapsed && !stageZenLayout ? (
          <div
            className="editor-pane-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="ステージとタイムラインの幅を調整"
            title="ドラッグでステージとタイムラインの幅を変更"
            onPointerDown={onSplitPointerDown}
            onPointerMove={onSplitPointerMove}
            onPointerUp={endSplitDrag}
            onPointerCancel={endSplitDrag}
            onLostPointerCapture={onSplitLostCapture}
            style={{
              position: "relative",
              width: STAGE_RESIZER_PX,
              minWidth: STAGE_RESIZER_PX,
              cursor: "col-resize",
              touchAction: "none",
              userSelect: "none",
              justifySelf: "stretch",
              alignSelf: "stretch",
              zIndex: 2,
              gridColumn: 2,
              gridRow: showTopWaveDock ? 3 : 1,
            }}
          />
        ) : null}

        {stageZenLayout ? null : rightPaneCollapsed && wideEditorLayout ? null : wideEditorLayout && showTopWaveDock ? (
          <div
            ref={rightPaneStackRef}
            style={{
              gridColumn: 3,
              gridRow: 3,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minHeight: 0,
              minWidth: 0,
              flexShrink: 0,
              ...(editorFixedWaveDockLayout
                ? {
                    overflowX: "hidden" as const,
                    overflowY: "auto" as const,
                  }
                : { overflow: "hidden" }),
              ...(floorTextPlaceSession
                ? { position: "relative" as const, zIndex: 140 }
                : {}),
            }}
          >
            {rosterOnlyMode ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  /** 名簿モードでは右列の縦スペースの大半をメンバー表に使う（ツールは下で内容分のみ） */
                  flex: "1 1 0",
                  minHeight: 0,
                  ...panelCard,
                  padding: "6px 5px",
                }}
              >
                <RosterTimelineStrip
                  project={project}
                  setProject={setProjectSafe}
                  onConfirmReturnToTimeline={onRosterConfirmReturnToTimeline}
                  onStagePreviewChange={setStagePreviewDancers}
                />
              </div>
            ) : null}
            <section
              className="editor-right-tools-section"
              style={{
                ...panelCard,
                padding: "6px 5px",
                flex: rosterOnlyMode ? "0 0 auto" : "1 1 auto",
                minHeight: 0,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div className="editor-right-tools-host">
                <div className="editor-right-tools-tiles">
                  <EditorStageWorkbench
                    key="wb-tiles"
                    layout="rail"
                    {...stageWorkbenchProps}
                  />
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div
            ref={rightPaneStackRef}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
              minHeight: 0,
              minWidth: 0,
              overflow: "hidden",
              ...(wideEditorLayout
                ? { gridColumn: 3, gridRow: 1 }
                : { gridRow: 4 }),
              ...(floorTextPlaceSession
                ? { position: "relative" as const, zIndex: 140 }
                : {}),
            }}
          >
            {rosterOnlyMode ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  flex: "1 1 0",
                  minHeight: 0,
                  ...rightPaneTopSectionStyle,
                }}
              >
                <RosterTimelineStrip
                  project={project}
                  setProject={setProjectSafe}
                  onConfirmReturnToTimeline={onRosterConfirmReturnToTimeline}
                  onStagePreviewChange={setStagePreviewDancers}
                />
              </div>
            ) : null}
            {workbenchInRightRail ? (
              <section
                className="editor-right-tools-section"
                style={{
                  ...panelCard,
                  padding: "6px 5px",
                  flex: "0 0 auto",
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  marginBottom: rosterOnlyMode ? 0 : 8,
                }}
              >
                <div className="editor-right-tools-host">
                  <div className="editor-right-tools-tiles">
                    <EditorStageWorkbench
                      key="wb-tiles-2"
                      layout="rail"
                      {...stageWorkbenchProps}
                    />
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>

      {showTopWaveDock ? (
        <>
          {cueListModalOpen ? (
            <EditorSideSheet
              open
              zIndex={2200}
              width="min(440px, calc(100vw - 28px))"
              onClose={() => setCueListModalOpen(false)}
              ariaLabelledBy="cue-list-modal-title"
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  minHeight: 0,
                  background: shell.surface,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "10px 12px",
                    borderBottom: `1px solid ${shell.border}`,
                    flexShrink: 0,
                  }}
                >
                  <h2
                    id="cue-list-modal-title"
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      fontWeight: 600,
                      color: shell.text,
                    }}
                  >
                    キュー一覧
                  </h2>
                  <button
                    type="button"
                    aria-label="閉じる"
                    onClick={() => setCueListModalOpen(false)}
                    style={{ ...btnSecondary, padding: "4px 10px" }}
                  >
                    閉じる
                  </button>
                </div>
                <div
                  ref={setCueListPortalEl}
                  style={{
                    flex: "1 1 auto",
                    minHeight: 240,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                />
              </div>
            </EditorSideSheet>
          ) : (
            <div
              ref={setCueListPortalEl}
              aria-hidden
              style={{
                position: "fixed",
                left: -32000,
                top: 0,
                width: 400,
                height: 520,
                overflow: "hidden",
                opacity: 0,
                pointerEvents: "none",
                zIndex: -1,
                display: "flex",
                flexDirection: "column",
              }}
            />
          )}
        </>
      ) : null}

      {stageAreaSettingsOpen ? (
        <StageAreaSettingsSheet
          stageAreaSettingsOpen={stageAreaSettingsOpen}
          onClose={() => setStageAreaSettingsOpen(false)}
        >
          <div style={{ padding: "8px 10px 10px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                marginBottom: "6px",
              }}
            >
              <h3
                id="stage-area-settings-title"
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#e2e8f0",
                }}
              >
                ステージまわりの設定
              </h3>
              <button
                type="button"
                aria-label="閉じる（変更は破棄）"
                onClick={() => setStageAreaSettingsOpen(false)}
                style={{
                  ...btnSecondary,
                  fontSize: "16px",
                  lineHeight: 1,
                  padding: "2px 10px",
                }}
              >
                ×
              </button>
            </div>

            <div style={STAGE_AREA_SHEET_SECTION}>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: "0.05em",
                  marginBottom: "4px",
                }}
              >
                客席の位置
              </div>
              <select
                title="画面上辺または下辺のどちらを客席としてステージを回転表示するか"
                value={stageAreaSettingsDraft.audienceEdge}
                disabled={project.viewMode === "view"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v !== "top" && v !== "bottom") return;
                  setStageAreaSettingsDraft((d) => ({
                    ...d,
                    audienceEdge: v,
                  }));
                }}
                aria-label="客席のある画面の上または下"
                style={{
                  width: "100%",
                  padding: "5px 8px",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                  background: "#020617",
                  color: "#e2e8f0",
                  fontSize: "12px",
                }}
              >
                {STAGE_AREA_AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    客席：画面の{o.label}側
                  </option>
                ))}
              </select>
            </div>

            <div style={STAGE_AREA_SHEET_SECTION}>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: "0.05em",
                  marginBottom: "2px",
                }}
              >
                舞台の寸法
              </div>
              <p
                style={{
                  margin: "0 0 6px",
                  fontSize: "10px",
                  color: "#64748b",
                  lineHeight: 1.35,
                }}
              >
                m・cm（空欄＝未設定）。<strong style={{ color: "#cbd5e1" }}>決定</strong>で反映。
              </p>
              <StageAreaDimensionRows
                disabled={project.viewMode === "view"}
                draft={stageAreaSettingsDraft}
                onChangeDraft={setStageAreaSettingsDraft}
              />
              <StageAreaPresetBlock
                disabled={project.viewMode === "view"}
                stageAreaPresetSelectNonce={stageAreaPresetSelectNonce}
                stageAreaPresetList={stageAreaPresetList}
                onChangeDraft={setStageAreaSettingsDraft}
                onBumpPresetNonce={() => setStageAreaPresetSelectNonce((n) => n + 1)}
                onSavePreset={() => {
                  if (project.viewMode === "view") return;
                  const d = stageAreaSettingsDraftRef.current;
                  const dims = {
                    stageWidthMm: parseMeterCmDraftToMm(d.width),
                    stageDepthMm: parseMeterCmDraftToMm(d.depth),
                    sideStageMm: parseMeterCmDraftToMm(d.side),
                    backStageMm: parseMeterCmDraftToMm(d.back),
                    centerFieldGuideIntervalMm: parseMeterCmDraftToMm(d.guide),
                  };
                  const defaultName = `舞台 ${stageAreaPresetList.length + 1}`;
                  const name = window.prompt("保存する名前", defaultName);
                  if (name === null) return;
                  const result = saveStagePreset(name.trim() || defaultName, dims);
                  if (!result.ok) {
                    window.alert(result.message);
                    return;
                  }
                  setStageAreaPresetList(listStagePresets());
                }}
              />
              <button
                type="button"
                disabled={project.viewMode === "view"}
                title="変形舞台・花道など（決定後に開くのが安全）"
                onClick={() => {
                  applyStageAreaSettingsDraft();
                  setStageAreaSettingsOpen(false);
                  setStageSettingsOpen(true);
                }}
                style={{
                  ...btnSecondary,
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                形状・花道・詳細設定…
              </button>
            </div>

            <div style={STAGE_AREA_SHEET_SECTION}>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: "0.05em",
                  marginBottom: "4px",
                }}
              >
                グリッド
              </div>
              {!stageAreaDraftHasMainFloor ? (
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: "10px",
                    color: "#64748b",
                    lineHeight: 1.35,
                  }}
                >
                  幅・奥行入力後、<strong style={{ color: "#cbd5e1" }}>縦／横 cm</strong>
                  で実寸の線間隔と表示を使えます。
                </p>
              ) : (
                <p
                  style={{
                    margin: "0 0 4px",
                    fontSize: "10px",
                    color: "#64748b",
                    lineHeight: 1.35,
                  }}
                >
                  <strong style={{ color: "#cbd5e1" }}>縦</strong>＝幅方向、
                  <strong style={{ color: "#cbd5e1" }}>横</strong>＝奥行。各 1〜100 cm（数字は直接入力可）。
                </p>
              )}
              {!stageAreaDraftHasMainFloor ? (
                <StageAreaGridStepControl
                  disabled={project.viewMode === "view"}
                  gridStep={stageAreaSettingsDraft.gridStep}
                  onChangeDraft={setStageAreaSettingsDraft}
                />
              ) : null}
              {stageAreaDraftHasMainFloor ? (
                <StageAreaGridSpacingControls
                  disabled={project.viewMode === "view"}
                  gridWidthCmInput={gridWidthCmInput}
                  gridDepthCmInput={gridDepthCmInput}
                  onStageGridCmInput={onStageGridCmInput}
                  commitStageGridCmInput={commitStageGridCmInput}
                  startGridNudgeRepeat={startGridNudgeRepeat}
                  stopGridNudgeRepeat={stopGridNudgeRepeat}
                  nudgeStageGridCm={nudgeStageGridCm}
                  gridNudgeDidRepeatRef={gridNudgeDidRepeatRef}
                />
              ) : null}
              <StageAreaGridVisibilityToggles
                disabled={project.viewMode === "view"}
                hasMainFloor={stageAreaDraftHasMainFloor}
                verticalEnabled={stageAreaSettingsDraft.stageGridLinesVerticalEnabled}
                horizontalEnabled={stageAreaSettingsDraft.stageGridLinesHorizontalEnabled}
                onChangeDraft={setStageAreaSettingsDraft}
              />
            </div>

            <div style={STAGE_AREA_SHEET_SECTION}>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#64748b",
                  letterSpacing: "0.05em",
                  marginBottom: "4px",
                }}
              >
                立ち位置の名前
              </div>
              <div
                style={{ display: "flex", gap: "6px" }}
                title="印の右クリックでも同様に選べます。"
              >
                <button
                  type="button"
                  disabled={project.viewMode === "view"}
                  onClick={() =>
                    setStageAreaSettingsDraft((d) => ({
                      ...d,
                      dancerLabelPosition: "inside",
                    }))
                  }
                  style={{
                    flex: 1,
                    padding: "5px 8px",
                    borderRadius: "6px",
                    border:
                      stageAreaSettingsDraft.dancerLabelPosition === "inside"
                        ? "1px solid rgba(99,102,241,0.9)"
                        : "1px solid #334155",
                    background:
                      stageAreaSettingsDraft.dancerLabelPosition === "inside"
                        ? "rgba(99,102,241,0.22)"
                        : "#020617",
                    color:
                      stageAreaSettingsDraft.dancerLabelPosition === "inside"
                        ? "#e0e7ff"
                        : "#94a3b8",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor:
                      project.viewMode === "view" ? "not-allowed" : "pointer",
                  }}
                >
                  ○の中
                </button>
                <button
                  type="button"
                  disabled={project.viewMode === "view"}
                  onClick={() =>
                    setStageAreaSettingsDraft((d) => ({
                      ...d,
                      dancerLabelPosition: "below",
                    }))
                  }
                  style={{
                    flex: 1,
                    padding: "5px 8px",
                    borderRadius: "6px",
                    border:
                      stageAreaSettingsDraft.dancerLabelPosition === "below"
                        ? "1px solid rgba(99,102,241,0.9)"
                        : "1px solid #334155",
                    background:
                      stageAreaSettingsDraft.dancerLabelPosition === "below"
                        ? "rgba(99,102,241,0.22)"
                        : "#020617",
                    color:
                      stageAreaSettingsDraft.dancerLabelPosition === "below"
                        ? "#e0e7ff"
                        : "#94a3b8",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor:
                      project.viewMode === "view" ? "not-allowed" : "pointer",
                  }}
                >
                  ○の外
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                marginBottom: "6px",
              }}
            >
              <button
                type="button"
                disabled={project.viewMode === "view"}
                onClick={() => {
                  applyStageAreaSettingsDraft();
                  setStageAreaSettingsOpen(false);
                }}
                style={{
                  ...btnAccent,
                  flex: 1,
                  padding: "7px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                決定
              </button>
              <button
                type="button"
                onClick={() => setStageAreaSettingsOpen(false)}
                style={{
                  ...btnSecondary,
                  flex: 1,
                  padding: "7px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                取り消し
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
              }}
            >
              <button
                type="button"
                onClick={() => void copyEditorShareLink()}
                style={{
                  ...btnSecondary,
                  flex: "1 1 160px",
                  padding: "6px 8px",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                {shareLinkCopiedFlash
                  ? "URL をコピーしました"
                  : "URL を共有（コピー）"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStageAreaSettingsOpen(false);
                  setShareLinksOpen(true);
                }}
                style={{
                  ...btnSecondary,
                  flex: "1 1 160px",
                  padding: "6px 8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  borderColor: "rgba(14, 165, 233, 0.5)",
                }}
                title="チーム用・生徒用のどちらかを選んで URL を発行"
              >
                共有 URL 発行
              </button>
              <button
                type="button"
                onClick={() => {
                  setStageAreaSettingsOpen(false);
                  setShortcutsHelpOpen(true);
                }}
                style={{
                  ...btnSecondary,
                  flex: "1 1 160px",
                  padding: "6px 8px",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                ショートカット・ヒント
              </button>
            </div>
          </div>
        </StageAreaSettingsSheet>
      ) : null}

      {stageSettingsOpen ? (
        <EditorSideSheet
          open
          zIndex={60}
          width="min(520px, 46vw)"
          onClose={() => setStageSettingsOpen(false)}
          ariaLabelledBy="stage-settings-dialog-title"
        >
          <div style={{ padding: "16px 18px 18px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "12px",
              }}
            >
              <h3
                id="stage-settings-dialog-title"
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#e2e8f0",
                }}
              >
                ステージ設定
              </h3>
              <button
                type="button"
                aria-label="閉じる"
                onClick={() => setStageSettingsOpen(false)}
                style={{
                  ...btnSecondary,
                  fontSize: "18px",
                  lineHeight: 1,
                  padding: "4px 12px",
                }}
              >
                ×
              </button>
            </div>
            <StageDimensionFields
              project={project}
              setProject={setProjectSafe}
              disabled={project.viewMode === "view"}
              compact={false}
              showHeading={false}
              embedded
              showAudienceEdge
              onCommit={() => setStageSettingsOpen(false)}
            />
          </div>
        </EditorSideSheet>
      ) : null}

      {shortcutsHelpOpen ? (
        <EditorSideSheet
          open
          zIndex={60}
          width="min(480px, 42vw)"
          onClose={() => setShortcutsHelpOpen(false)}
          ariaLabelledBy="shortcuts-dialog-title"
        >
          <div style={{ padding: "16px 18px 18px", maxHeight: "min(88vh, 560px)", overflow: "auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "14px",
              }}
            >
              <h3
                id="shortcuts-dialog-title"
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#e2e8f0",
                }}
              >
                ショートカット
              </h3>
              <button
                type="button"
                aria-label="閉じる"
                onClick={() => setShortcutsHelpOpen(false)}
                style={{
                  ...btnSecondary,
                  fontSize: "18px",
                  lineHeight: 1,
                  padding: "4px 12px",
                }}
              >
                ×
              </button>
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: "18px",
                color: "#cbd5e1",
                fontSize: "13px",
                lineHeight: 1.65,
              }}
            >
              <li>
                <strong style={{ color: "#e2e8f0" }}>Space</strong>{" "}
                再生／一時停止（タイムラインにフォーカス不要・入力欄以外）
              </li>
              <li>
                <strong style={{ color: "#e2e8f0" }}>⌘Z / Ctrl+Z</strong> 元に戻す ·{" "}
                <strong style={{ color: "#e2e8f0" }}>⌘⇧Z / Ctrl+⇧Z</strong> やり直し
              </li>
              <li>
                <strong style={{ color: "#e2e8f0" }}>Escape</strong>{" "}
                開いているダイアログを閉じる
              </li>
              <li>
                波形: 波形上でマウスホイール（またはトラックパッドの縦スクロール）で表示範囲を拡大・縮小
              </li>
              <li>
                ステージ微調整:{" "}
                <strong style={{ color: "#e2e8f0" }}>Shift+ドラッグ</strong>{" "}
                で細かいグリッドにスナップ（スナップON時。幅・奥行ありなら実寸グリッド）
              </li>
              <li>
                <strong style={{ color: "#e2e8f0" }}>⌘D / Ctrl+D</strong>{" "}
                ステージで選択中のメンバーを複製（名簿紐付けは外れます）
              </li>
              <li>
                ドラッグ移動中、<strong style={{ color: "#e2e8f0" }}>移動前の位置</strong>
                を薄い印で重ね表示します（指を離すと消えます）
              </li>
              <li>
                <strong style={{ color: "#e2e8f0" }}>Alt+矢印</strong>{" "}
                で選択ダンサーを微移動（<strong style={{ color: "#e2e8f0" }}>Shift+Alt</strong>{" "}
                でさらに細かく）
              </li>
              <li>
                <strong style={{ color: "#e2e8f0" }}>再生中にステージ</strong>{" "}
                のダンサー以外をクリック → 再生停止（先頭付近へ）
              </li>
              <li>
                大道具: ツールバー「大道具」から追加。モーダルで{" "}
                <strong style={{ color: "#e2e8f0" }}>編集画面全体に配置</strong>を選ぶとタイムライン周りにも置けます。
                選択中は青い丸ハンドルで回転（Shift で15°刻み）。右クリックで床／画面の切替や削除。
              </li>
              <li>
                タイムライン: 波形で <strong style={{ color: "#e2e8f0" }}>⌘／Ctrl+クリック</strong>{" "}
                でキュー複数選択、<strong style={{ color: "#e2e8f0" }}>Delete</strong>{" "}
                で一括削除（Undo 可）
              </li>
              <li>
                タイムライン: 波形上のキューを{" "}
                <strong style={{ color: "#e2e8f0" }}>右クリック</strong>
                →「複製する」「立ち位置リストに追加」は{" "}
                <strong style={{ color: "#e2e8f0" }}>はい</strong>／
                <strong style={{ color: "#e2e8f0" }}>いいえ</strong>で確定。「削除」はその場でキューを削除（Undo 可）
              </li>
              <li>
                タイムライン: 動画ファイルから <strong style={{ color: "#e2e8f0" }}>音声抽出</strong>（再生時間ぶんかかります）
                ・波形の <strong style={{ color: "#e2e8f0" }}>振幅 ±</strong> / 枠の下辺ドラッグで波形の高さ
              </li>
              <li>
                ステージ: <strong style={{ color: "#e2e8f0" }}>Alt+クリック</strong>（ダンサー印）で重なった印を手前から順に切替
              </li>
            </ul>
          </div>
        </EditorSideSheet>
      ) : null}

      <SetPiecePickerModal
        open={setPiecePickerOpen}
        onClose={() => setSetPiecePickerOpen(false)}
        onConfirm={confirmAddSetPiece}
        disabled={project.viewMode === "view"}
      />

      <StageShapePicker
        open={stageShapePickerOpen}
        currentShape={project.stageShape}
        legacyHanamichi={{
          enabled: project.hanamichiEnabled ?? false,
          depthPct: project.hanamichiDepthPct ?? 14,
        }}
        disabled={project.viewMode === "view"}
        onClose={() => setStageShapePickerOpen(false)}
        onConfirm={(shape) => {
          setProjectSafe((p) => ({
            ...p,
            /** 新しい形を選んだときは旧仕様の花道フラグはオフに統一 */
            hanamichiEnabled: false,
            stageShape: shape,
          }));
          setStageShapePickerOpen(false);
        }}
      />

      {cloudSaveDialogOpen && me && project ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 85,
            background: "rgba(2, 6, 23, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "max(16px, env(safe-area-inset-top))",
            boxSizing: "border-box",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCloudSaveDialogOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cloud-save-dialog-title"
            style={{
              ...panelCard,
              maxWidth: 440,
              width: "100%",
              padding: "20px 22px 22px",
              boxSizing: "border-box",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2
              id="cloud-save-dialog-title"
              style={{
                margin: "0 0 12px",
                fontSize: "17px",
                fontWeight: 700,
                color: "#f1f5f9",
              }}
            >
              {t("editor.cloudSaveTitle")}
            </h2>
            <p
              style={{
                margin: "0 0 20px",
                fontSize: "13px",
                lineHeight: 1.6,
                color: "#94a3b8",
              }}
            >
              {serverId != null
                ? t("editor.cloudSaveBodyOverwrite")
                : t("editor.cloudSaveBodyNew")}
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                style={{ ...btnSecondary, padding: "8px 16px", fontSize: "13px" }}
                disabled={saving}
                onClick={() => setCloudSaveDialogOpen(false)}
              >
                {t("editor.cloudSaveNo")}
              </button>
              <button
                type="button"
                style={{ ...btnAccent, padding: "8px 16px", fontSize: "13px" }}
                disabled={saving}
                onClick={() => void performCloudSave()}
              >
                {saving ? t("editor.saving") : t("editor.cloudSaveYes")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {exportDialogEl}
      {flowLibraryDialogEl}
      {addCueDialogEl}
      {formationBoxManagerDialogEl}

      {rosterImportSheetEl}

      {!choreoPublicView ? (
        <EditorSideSheet
          open={shareLinksOpen}
          onClose={() => setShareLinksOpen(false)}
          zIndex={75}
          width="min(440px, 92vw)"
          ariaLabelledBy="share-links-panel-title"
        >
          <div style={{ padding: "16px 18px 22px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 4,
              }}
            >
              <h3
                id="share-links-panel-title"
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#e2e8f0",
                }}
              >
                共有 URL
              </h3>
              <button
                type="button"
                aria-label="閉じる"
                onClick={() => setShareLinksOpen(false)}
                style={{
                  ...btnSecondary,
                  fontSize: 18,
                  lineHeight: 1,
                  padding: "4px 12px",
                }}
              >
                ×
              </button>
            </div>
            <ShareLinksSheetContent
              open={shareLinksOpen}
              collabUrl={shareLinksUrls.collab}
              viewUrl={shareLinksUrls.view}
              hasServerId={serverId != null}
              pieceTitle={
                project?.pieceTitle?.trim() ||
                projectName.trim() ||
                "無題の作品"
              }
              onClose={() => setShareLinksOpen(false)}
            />
          </div>
        </EditorSideSheet>
      ) : null}

      {choreoPublicView && project ? (
        <EditorSideSheet
          open={choreoMemberSheetOpen}
          onClose={() => setChoreoMemberSheetOpen(false)}
          zIndex={88}
          width="min(400px, 92vw)"
        >
          <div
            style={{
              padding: "8px 16px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#e2e8f0",
              }}
            >
              閲覧モード
            </h3>
            <button
              type="button"
              aria-label="閉じる"
              onClick={() => setChoreoMemberSheetOpen(false)}
              style={{
                ...btnSecondary,
                fontSize: 18,
                lineHeight: 1,
                padding: "4px 12px",
              }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: "0 16px 20px" }}>
            <ViewerModeSheetContent
              variant="public"
              pieceTitle={project.pieceTitle}
              entries={getViewRosterEntries(project)}
              canCapture2d={stageView === "2d"}
              onPick={(p) => {
                setChoreoStudentPick(p);
                if (viewerLocalStorageKey) {
                  try {
                    localStorage.setItem(
                      viewerLocalStorageKey,
                      JSON.stringify(p)
                    );
                  } catch {
                    /* ignore */
                  }
                }
                setChoreoMemberSheetOpen(false);
              }}
            />
          </div>
        </EditorSideSheet>
      ) : null}

      {!choreoPublicView && project ? (
        <EditorSideSheet
          open={editorViewerSheetOpen}
          onClose={() => setEditorViewerSheetOpen(false)}
          zIndex={88}
          width="min(400px, 92vw)"
        >
          <div
            style={{
              padding: "8px 16px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#e2e8f0",
              }}
            >
              閲覧プレビュー
            </h3>
            <button
              type="button"
              aria-label="閉じる"
              onClick={() => setEditorViewerSheetOpen(false)}
              style={{
                ...btnSecondary,
                fontSize: 18,
                lineHeight: 1,
                padding: "4px 12px",
              }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: "0 16px 20px" }}>
            <ViewerModeSheetContent
              variant="editor"
              pieceTitle={project.pieceTitle}
              entries={getViewRosterEntries(project)}
              canCapture2d={stageView === "2d"}
              onPick={(p) => {
                setEditorViewerPreviewPick(p);
                setEditorViewerSheetOpen(false);
              }}
              onClearEditorPreview={() => setEditorViewerPreviewPick(null)}
            />
          </div>
        </EditorSideSheet>
      ) : null}

      {choreoPublicView && choreoStudentPick ? (
        <div
          className="choreo-viewer-bottom-bar"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 90,
            display: "flex",
            flexDirection: "column",
            borderTop: `1px solid ${shell.border}`,
            background: "rgba(15, 23, 42, 0.98)",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.35)",
            paddingBottom: "max(4px, env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px 8px",
              minHeight: 48,
              borderBottom: `1px solid ${shell.border}`,
            }}
          >
            <span style={{ fontSize: 20 }} aria-hidden>
              🎵
            </span>
            <span
              style={{
                fontWeight: 700,
                color: "#e2e8f0",
                fontSize: 16,
                lineHeight: 1.25,
                flex: "1 1 120px",
                minWidth: 0,
              }}
            >
              {(project.pieceTitle || "無題の作品").trim()} - 閲覧
            </span>
            <Link
              to="/library"
              style={{
                ...btnSecondary,
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
                flexShrink: 0,
                minHeight: 44,
                minWidth: 72,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 16px",
              }}
            >
              閉じる
            </Link>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px 14px",
            }}
          >
            <span style={{ fontSize: 15, color: "#e2e8f0", lineHeight: 1.4, flex: "1 1 200px" }}>
              👤{" "}
              {choreoStudentPick.kind === "all"
                ? "全員"
                : `${choreoStudentPick.label} さん`}{" "}
              のパート表示中
            </span>
            <button
              type="button"
              onClick={() => setChoreoMemberSheetOpen(true)}
              style={{
                ...btnSecondary,
                marginLeft: "auto",
                fontSize: 15,
                fontWeight: 600,
                minHeight: 48,
                padding: "10px 16px",
                touchAction: "manipulation",
              }}
              title="誰の立ち位置を大きく表示するかを選び直す"
            >
              パートを選ぶ
            </button>
          </div>
        </div>
      ) : null}

      <style>{`
        @media (max-width: 1279px) {
          .editor-three-pane {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto auto auto !important;
            overscroll-behavior: contain;
          }
        }
        .editor-pane-resizer::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 1px;
          background: #334155;
          pointer-events: none;
          transition: background 120ms ease;
        }
        .editor-pane-resizer:hover::after {
          background: rgba(148, 163, 184, 0.75);
        }
      `}</style>
    </div>
  );
}
