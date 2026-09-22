import {
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { DANCER_COLOR_PALETTE_HEX as DANCER_PALETTE } from "../lib/dancerColorPalette";
import {
  NAME_BELOW_FONT_PX_MAX,
  NAME_BELOW_FONT_PX_MIN,
} from "../lib/stageNameBelowFontSizing";
import {
  MARKER_DIAMETER_PX_MAX,
  MARKER_DIAMETER_PX_MIN,
} from "../lib/projectDefaults";
import { btnSecondary } from "./stageButtonStyles";
import {
  dockActionBtn,
  dockCard,
  dockSectionHint,
  dockSectionTitle,
} from "./stageDockPanelStyles";
import { DancerFaceStampPicker } from "./DancerFaceStampPicker";
import { DancerFigure3dPicker } from "./DancerFigure3dPicker";
import { DancerFigure3dApplyScopeToggle } from "./DancerFigure3dApplyScopeToggle";
import { DancerGenderPicker } from "./DancerGenderPicker";
import type { DancerFaceStampId } from "../lib/dancerFaceStamp";
import type { DancerFigure3dApplyScope } from "../lib/applyDancerFigure3d";
import { withDancerLabelPosition } from "../lib/withDancerLabelPosition";

const PRIMARY_COLOR_COUNT = 8;

const markerActionBtn: CSSProperties = {
  ...dockActionBtn,
  minWidth: 0,
  padding: "8px 8px",
  fontSize: 12,
  lineHeight: 1.35,
  whiteSpace: "normal",
  overflow: "visible",
  textOverflow: "clip",
  wordBreak: "keep-all",
  overflowWrap: "normal",
};

type DisclosureId = "name" | "color" | "face" | "figure3d" | "gender";

function DockDisclosure({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: DisclosureId;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: (id: DisclosureId) => void;
  children: ReactNode;
}) {
  return (
    <div style={{ ...dockCard, padding: 0, marginBottom: 8, overflow: "hidden" }}>
      <button
        type="button"
        data-dock-disclosure={id}
        aria-expanded={open}
        onClick={() => onToggle(id)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 12px",
          border: "none",
          background: open ? "rgba(251,191,36,0.08)" : "transparent",
          color: "#e2e8f0",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
            color: "#94a3b8",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {!open && summary ? (
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 88,
              }}
            >
              {summary}
            </span>
          ) : null}
          <span aria-hidden style={{ color: open ? "#fbbf24" : "#64748b" }}>
            {open ? "▾" : "▸"}
          </span>
        </span>
      </button>
      {open ? (
        <div style={{ padding: "0 10px 10px" }}>{children}</div>
      ) : null}
    </div>
  );
}

function SizeSlider({
  label,
  value,
  min,
  max,
  unit,
  disabled,
  onChange,
  onGestureBegin,
  onGestureEnd,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  disabled?: boolean;
  onChange: (px: number) => void;
  onGestureBegin?: () => void;
  onGestureEnd?: () => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          ...dockSectionTitle,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <span>{label}</span>
        <span style={{ color: "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={label}
        onPointerDown={() => onGestureBegin?.()}
        onPointerUp={() => onGestureEnd?.()}
        onPointerCancel={() => onGestureEnd?.()}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          margin: 0,
          opacity: disabled ? 0.45 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
    </div>
  );
}

export type StageSelectionDisplayPanelProps = {
  selectedCount: number;
  disabled?: boolean;
  rawDancerLabelPosition?: "inside" | "below";
  dancerLabelBelow: boolean;
  setProject: Dispatch<SetStateAction<ChoreographyProjectJson>>;
  applyBulkColorToDancerIds: (ids: string[], colorIndex: number) => void;
  applyBulkMarkerClear: (ids: string[]) => void;
  applyBulkMarkerSequence: (ids: string[], start: number) => void;
  applyBulkMarkerSame: (ids: string[], badgeRaw: string) => void;
  applyBulkMarkerCenterDistance: (ids: string[]) => void;
  applyBulkFaceStamp?: (
    ids: string[],
    stamp: import("../lib/dancerFaceStamp").DancerFaceStampId | null
  ) => void;
  applyBulkGenderToDancerIds?: (
    ids: string[],
    genderLabel: string | null
  ) => void;
  applyBulkFigure3dToDancerIds?: (
    ids: string[],
    figure3d: import("../lib/dancerFigure3d").DancerFigure3dId,
    scope?: DancerFigure3dApplyScope
  ) => void;
  selectedDancerIds: readonly string[];
  markerPx: number;
  nameFontPx: number;
  onMarkerSizeChange: (px: number) => void;
  onNameFontChange?: (px: number) => void;
  onSizeGestureBegin?: () => void;
  onSizeGestureEnd?: () => void;
};

export function StageSelectionDisplayPanel({
  selectedCount,
  disabled,
  rawDancerLabelPosition,
  dancerLabelBelow,
  setProject,
  applyBulkColorToDancerIds,
  applyBulkMarkerClear,
  applyBulkMarkerSequence,
  applyBulkMarkerSame,
  applyBulkMarkerCenterDistance,
  applyBulkFaceStamp,
  applyBulkGenderToDancerIds,
  applyBulkFigure3dToDancerIds,
  selectedDancerIds,
  markerPx,
  nameFontPx,
  onMarkerSizeChange,
  onNameFontChange,
  onSizeGestureBegin,
  onSizeGestureEnd,
}: StageSelectionDisplayPanelProps) {
  const [showAllColors, setShowAllColors] = useState(false);
  const [figure3dScope, setFigure3dScope] =
    useState<DancerFigure3dApplyScope>("all");
  const [openSection, setOpenSection] = useState<DisclosureId | null>(null);
  const colors = showAllColors
    ? DANCER_PALETTE
    : DANCER_PALETTE.slice(0, PRIMARY_COLOR_COUNT);
  const ids = [...selectedDancerIds];
  const busy = Boolean(disabled) || selectedCount === 0;
  const labelPos = rawDancerLabelPosition ?? "inside";
  const nameSummary = labelPos === "inside" ? "丸の内" : "丸の下";

  const toggleSection = (id: DisclosureId) => {
    setOpenSection((cur) => (cur === id ? null : id));
  };

  return (
    <div data-selection-display-panel>
      <DockDisclosure
        id="name"
        title="名前の表示"
        summary={nameSummary}
        open={openSection === "name"}
        onToggle={toggleSection}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: dancerLabelBelow ? 8 : 0,
          }}
        >
          {(["inside", "below"] as const).map((pos) => {
            const on = labelPos === pos;
            return (
              <button
                key={pos}
                type="button"
                disabled={busy}
                onClick={() =>
                  setProject((p) => withDancerLabelPosition(p, pos))
                }
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: on
                    ? "1px solid rgba(251,191,36,0.9)"
                    : "1px solid #334155",
                  background: on ? "rgba(251,191,36,0.16)" : "#020617",
                  color: on ? "#fde68a" : "#94a3b8",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {pos === "inside" ? "丸の内" : "丸の下"}
              </button>
            );
          })}
        </div>
        {dancerLabelBelow ? (
          <>
            <div style={{ ...dockSectionTitle, marginTop: 8 }}>丸の内</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <button
                type="button"
                disabled={busy}
                style={markerActionBtn}
                onClick={() => applyBulkMarkerClear(ids)}
              >
                空白
              </button>
              <button
                type="button"
                disabled={busy}
                style={markerActionBtn}
                onClick={() => {
                  const raw = window.prompt(
                    "連番の開始番号（整数）。フォーメーション順で丸の内に入れます。",
                    "1"
                  );
                  if (raw == null || raw.trim() === "") return;
                  const v = Number.parseInt(raw.trim(), 10);
                  if (!Number.isFinite(v)) {
                    window.alert("整数として読めませんでした。");
                    return;
                  }
                  applyBulkMarkerSequence(ids, v);
                }}
              >
                連番
              </button>
              <button
                type="button"
                disabled={busy}
                style={markerActionBtn}
                onClick={() => {
                  const raw = window.prompt(
                    "全員の丸の内を同じ内容に（最大3文字）。",
                    "1"
                  );
                  if (raw == null || raw.trim() === "") return;
                  applyBulkMarkerSame(ids, raw);
                }}
              >
                同じ
              </button>
              <button
                type="button"
                disabled={busy}
                style={{ ...markerActionBtn, gridColumn: "1 / -1" }}
                onClick={() => applyBulkMarkerCenterDistance(ids)}
              >
                センターからの距離
              </button>
            </div>
          </>
        ) : (
          <p style={{ ...dockSectionHint, margin: "8px 0 0" }}>
            「丸の下」にすると、丸の内に連番などを入れられます。
          </p>
        )}
      </DockDisclosure>

      <div style={{ ...dockCard, padding: "8px 8px 10px", marginBottom: 8 }}>
        <div style={{ ...dockSectionTitle, marginBottom: 8 }}>大きさ</div>
        <SizeSlider
          label="丸の大きさ"
          value={markerPx}
          min={MARKER_DIAMETER_PX_MIN}
          max={MARKER_DIAMETER_PX_MAX}
          unit="px"
          disabled={busy}
          onChange={onMarkerSizeChange}
          onGestureBegin={onSizeGestureBegin}
          onGestureEnd={onSizeGestureEnd}
        />
        <SizeSlider
          label="丸の下の名前"
          value={nameFontPx}
          min={NAME_BELOW_FONT_PX_MIN}
          max={NAME_BELOW_FONT_PX_MAX}
          unit="px"
          disabled={busy || !onNameFontChange}
          onChange={(px) => onNameFontChange?.(px)}
          onGestureBegin={onSizeGestureBegin}
          onGestureEnd={onSizeGestureEnd}
        />
      </div>

      <DockDisclosure
        id="color"
        title="印の色"
        summary="選択に一括"
        open={openSection === "color"}
        onToggle={toggleSection}
      >
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}
        >
          {colors.map((hex, i) => (
            <button
              key={`dock-color-${i}`}
              type="button"
              disabled={busy}
              title={`色 ${i + 1}`}
              onClick={() => applyBulkColorToDancerIds(ids, i)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                border: "1px solid #1e293b",
                background: hex,
                cursor: busy ? "not-allowed" : "pointer",
                padding: 0,
              }}
            />
          ))}
        </div>
        {DANCER_PALETTE.length > PRIMARY_COLOR_COUNT ? (
          <button
            type="button"
            onClick={() => setShowAllColors((v) => !v)}
            style={{
              ...btnSecondary,
              width: "100%",
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {showAllColors ? "色を減らす" : "もっと見る"}
          </button>
        ) : null}
      </DockDisclosure>

      <DockDisclosure
        id="face"
        title="表情スタンプ"
        summary="選ぶ"
        open={openSection === "face"}
        onToggle={toggleSection}
      >
        <p style={{ ...dockSectionHint, margin: "0 0 8px" }}>
          選択中の丸に LINE 風の表情を付けます（名前は丸の下に出ます）。
        </p>
        <DancerFaceStampPicker
          value={null}
          compact
          disabled={busy || !applyBulkFaceStamp}
          onChange={(stamp: DancerFaceStampId | null) =>
            applyBulkFaceStamp?.(ids, stamp)
          }
        />
      </DockDisclosure>

      <DockDisclosure
        id="figure3d"
        title="3Dの見た目"
        summary="キャラを選ぶ"
        open={openSection === "figure3d"}
        onToggle={toggleSection}
      >
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 11,
            color: "#94a3b8",
            lineHeight: 1.4,
          }}
        >
          選択中の立ち位置を人型・動物にします。適用範囲を選べます。
        </p>
        <DancerFigure3dApplyScopeToggle
          value={figure3dScope}
          onChange={setFigure3dScope}
          disabled={busy || !applyBulkFigure3dToDancerIds}
        />
        <DancerFigure3dPicker
          value="human"
          compact
          disabled={busy || !applyBulkFigure3dToDancerIds}
          onChange={(fig) =>
            applyBulkFigure3dToDancerIds?.(ids, fig, figure3dScope)
          }
        />
      </DockDisclosure>

      <DockDisclosure
        id="gender"
        title="性別"
        summary="男子／女子"
        open={openSection === "gender"}
        onToggle={toggleSection}
      >
        <p style={{ ...dockSectionHint, margin: "0 0 8px" }}>
          男子＝青・女子＝ピンク。選択中に一括で付けます。
        </p>
        <DancerGenderPicker
          value=""
          disabled={busy || !applyBulkGenderToDancerIds}
          onChange={(next) => applyBulkGenderToDancerIds?.(ids, next || null)}
        />
        <button
          type="button"
          disabled={busy || !applyBulkGenderToDancerIds}
          style={{ ...markerActionBtn, marginTop: 8, width: "100%" }}
          onClick={() => applyBulkGenderToDancerIds?.(ids, null)}
        >
          性別をクリア
        </button>
      </DockDisclosure>
    </div>
  );
}
