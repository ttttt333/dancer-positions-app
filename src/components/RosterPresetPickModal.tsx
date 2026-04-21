import { useCallback, useMemo } from "react";
import type {
  ChoreographyProjectJson,
  DancerSpot,
  RosterStripSortMode,
} from "../types/choreography";
import {
  COMMON_QUICK_LAYOUT_PRESETS,
  dancersForLayoutPreset,
  type LayoutPresetId,
} from "../lib/formationLayouts";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** サムネイル用の人数（未配置追加後 or 再配置時のステージ人数） */
  previewCount: number;
  disabled: boolean;
  project: ChoreographyProjectJson;
  onPickPreset: (presetId: LayoutPresetId) => void;
  /** 配置前に並び順を選ぶ（名簿ストリップと同じ基準） */
  rosterSortMode: RosterStripSortMode;
  onRosterSortModeChange: (mode: RosterStripSortMode) => void;
};

/**
 * 名簿の「未配置を一括」「名簿の並びで再配置」から開く雛形選択。
 * ステージ右のクイックバーと同じプリセット一覧をサムネイル付きで表示する。
 */
export function RosterPresetPickModal({
  open,
  onClose,
  title,
  description,
  previewCount,
  disabled,
  project,
  onPickPreset,
  rosterSortMode,
  onRosterSortModeChange,
}: Props) {
  const n = Math.max(1, Math.min(80, previewCount));

  const buildPreview = useCallback(
    (presetId: LayoutPresetId): DancerSpot[] => {
      return dancersForLayoutPreset(n, presetId, {
        dancerSpacingMm: project.dancerSpacingMm,
        stageWidthMm: project.stageWidthMm,
      });
    },
    [n, project.dancerSpacingMm, project.stageWidthMm]
  );

  const handlePick = useCallback(
    (presetId: LayoutPresetId) => {
      if (disabled) return;
      onPickPreset(presetId);
      onClose();
    },
    [disabled, onPickPreset, onClose]
  );

  const presets = useMemo(() => COMMON_QUICK_LAYOUT_PRESETS, []);

  const sortSelectValue =
    rosterSortMode === "import" ||
    rosterSortMode === "height_desc" ||
    rosterSortMode === "height_asc" ||
    rosterSortMode === "grade" ||
    rosterSortMode === "skill"
      ? rosterSortMode
      : "import";

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 85,
        background: "rgba(15, 23, 42, 0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="roster-preset-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          maxHeight: "min(85vh, 640px)",
          display: "flex",
          flexDirection: "column",
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: "12px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            padding: "12px 14px",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <div>
            <h2
              id="roster-preset-modal-title"
              style={{
                margin: 0,
                fontSize: "15px",
                fontWeight: 700,
                color: "#e2e8f0",
              }}
            >
              {title}
            </h2>
            {description ? (
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "11px",
                  color: "#94a3b8",
                  lineHeight: 1.45,
                }}
              >
                {description}
              </p>
            ) : null}
            <p style={{ margin: "6px 0 0", fontSize: "10px", color: "#64748b" }}>
              対象人数: {n} 人（プレビュー図は示意です）
            </p>
          </div>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            style={{
              width: "28px",
              height: "28px",
              padding: 0,
              borderRadius: "8px",
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#cbd5e1",
              fontSize: "18px",
              lineHeight: 1,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "12px 14px 16px",
          }}
        >
          <div
            style={{
              marginBottom: "12px",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #334155",
              background: "#020617",
            }}
          >
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                fontSize: "11px",
                fontWeight: 600,
                color: "#e2e8f0",
              }}
            >
              1. 名簿の並び順（この順で配置・再配置されます）
              <select
                value={sortSelectValue}
                disabled={disabled}
                onChange={(e) =>
                  onRosterSortModeChange(e.target.value as RosterStripSortMode)
                }
                style={{
                  fontSize: "12px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #475569",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  maxWidth: "100%",
                }}
              >
                <option value="import">取り込み順</option>
                <option value="height_desc">身長 高い順</option>
                <option value="height_asc">身長 低い順</option>
                <option value="grade">学年順</option>
                <option value="skill">スキル順</option>
              </select>
            </label>
            <p style={{ margin: "8px 0 0", fontSize: "10px", color: "#64748b", lineHeight: 1.4 }}>
              名簿パネルで身長・学年・スキルを直してから、下で雛形を選ぶとその並びが反映されます。
            </p>
          </div>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 600,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "8px",
            }}
          >
            2. 立ち位置の雛形
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                onClick={() => handlePick(p.id)}
                title={`${p.label}（${n} 人）`}
                style={{
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                  padding: "4px 8px 6px",
                  borderRadius: "8px",
                  border: "1px solid #1e293b",
                  background: "#0f172a",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.45 : 1,
                  minWidth: "48px",
                }}
              >
                <SpotThumb dancers={buildPreview(p.id)} />
                <span
                  style={{
                    fontSize: "10px",
                    color: "#cbd5e1",
                    maxWidth: "88px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: 1.15,
                  }}
                >
                  {p.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpotThumb({ dancers }: { dancers: DancerSpot[] }) {
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
