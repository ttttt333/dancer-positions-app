import { useCallback, useMemo } from "react";
import type {
  ChoreographyProjectJson,
  DancerSpot,
  RosterStripSortMode,
} from "../types/choreography";
import {
  dancersForLayoutPreset,
  type LayoutPresetId,
} from "../lib/formationLayouts";
import { EditorSideSheet } from "./EditorSideSheet";

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

/** カテゴリー定義 */
const PRESET_CATEGORIES: { label: string; ids: LayoutPresetId[] }[] = [
  {
    label: "🔶 ピラミッド・V字系",
    ids: [
      "pyramid",
      "pyramid_inverse",
      "vee",
      "inverse_vee",
      "wedge",
      "fan_back",
      "hourglass",
      "bowtie",
      "arrow_back",
      "arrow_front",
    ],
  },
  {
    label: "🟦 複数列・千鳥",
    ids: [
      "two_rows",
      "rows_3",
      "rows_4",
      "rows_5",
      "rows_6",
      "rows_7",
      "rows_8",
      "stagger",
      "stagger_inverse",
      "stagger_3",
      "two_rows_dense_back",
      "offset_triple",
    ],
  },
  {
    label: "📐 段の列（客席側から増える）",
    ids: [
      "front_stair_from_2",
      "front_stair_from_3",
      "front_stair_from_4",
      "front_stair_from_5",
      "front_stair_from_6",
      "front_stair_from_7",
      "front_stair_from_8",
      "front_stair_from_9",
      "front_stair_from_10",
      "front_stair_from_11",
    ],
  },
  {
    label: "➖ 直線・対角線",
    ids: [
      "line",
      "line_front",
      "line_back",
      "line_vertical",
      "diagonal_se",
      "diagonal_ne",
      "stairs_diag",
      "zigzag",
    ],
  },
  {
    label: "⬜ グリッド・縦列",
    ids: ["grid", "columns_4", "columns_5", "columns_6"],
  },
  {
    label: "🌐 弧・円形",
    ids: [
      "arc",
      "arc_tight",
      "double_arc",
      "circle",
      "hollow_ring",
      "double_ring",
      "u_shape",
      "concentric",
    ],
  },
  {
    label: "🔀 グループ分け・3分割",
    ids: [
      "block_lr",
      "block_3",
      "block_3_depth",
      "three_clusters",
      "wing_spread",
      "cross_split",
    ],
  },
  {
    label: "✴️ 幾何形・枠形",
    ids: ["diamond", "square_outline", "cross", "x_shape"],
  },
  {
    label: "🎨 個性・アート系",
    ids: [
      "scatter",
      "spiral",
      "wave",
      "cluster_tight",
      "spread_loose",
      "asymmetric_l",
    ],
  },
];

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

  /** カテゴリーごとのサムネイルを事前生成 */
  const categoryPreviews = useMemo(
    () =>
      PRESET_CATEGORIES.map((cat) => ({
        ...cat,
        items: cat.ids.map((id) => ({ id, dancers: buildPreview(id) })),
      })),
    [buildPreview]
  );

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
    <EditorSideSheet
      open
      zIndex={85}
      width="min(600px, 92vw)"
      onClose={onClose}
      ariaLabelledBy="roster-preset-modal-title"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxHeight: "min(92vh, 780px)",
          overflow: "hidden",
        }}
      >
        {/* ヘッダー */}
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

        {/* スクロール本体 */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "12px 14px 20px",
          }}
        >
          {/* 並び順セレクト */}
          <div
            style={{
              marginBottom: "14px",
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

          {/* カテゴリー別プリセット一覧 */}
          <div
            style={{
              fontSize: "10px",
              fontWeight: 600,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "10px",
            }}
          >
            2. 立ち位置の雛形を選ぶ
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {categoryPreviews.map((cat) => (
              <div key={cat.label}>
                {/* カテゴリーヘッダー */}
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#cbd5e1",
                    marginBottom: "6px",
                    paddingBottom: "4px",
                    borderBottom: "1px solid #1e293b",
                  }}
                >
                  {cat.label}
                </div>
                {/* プリセットグリッド */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                  }}
                >
                  {cat.items.map((item) => (
                    <PresetButton
                      key={item.id}
                      id={item.id}
                      dancers={item.dancers}
                      disabled={disabled}
                      onPick={handlePick}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </EditorSideSheet>
  );
}

function PresetButton({
  id,
  dancers,
  disabled,
  onPick,
}: {
  id: LayoutPresetId;
  dancers: DancerSpot[];
  disabled: boolean;
  onPick: (id: LayoutPresetId) => void;
}) {
  /** LayoutPresetOptions の label を逆引き */
  const label = PRESET_LABEL_MAP[id] ?? id;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(id)}
      title={label}
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "3px",
        padding: "5px 6px 6px",
        borderRadius: "8px",
        border: "1px solid #1e293b",
        background: "#0f172a",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        minWidth: "52px",
        maxWidth: "76px",
        transition: "border-color 0.12s, background 0.12s",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#6366f1";
          (e.currentTarget as HTMLButtonElement).style.background = "#1e1b4b";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e293b";
        (e.currentTarget as HTMLButtonElement).style.background = "#0f172a";
      }}
    >
      <SpotThumb dancers={dancers} />
      <span
        style={{
          fontSize: "9.5px",
          color: "#cbd5e1",
          width: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.2,
          textAlign: "center",
        }}
      >
        {label}
      </span>
    </button>
  );
}

/** LayoutPresetId → label の逆引きマップ */
const PRESET_LABEL_MAP: Record<string, string> = {
  line: "横一列",
  line_front: "横一列（手前）",
  line_back: "横一列（奥）",
  line_vertical: "縦一列",
  diagonal_se: "斜め（↘）",
  diagonal_ne: "斜め（↗）",
  stairs_diag: "階段状",
  zigzag: "ジグザグ",
  two_rows: "2列",
  two_rows_dense_back: "2列（前少奥多）",
  rows_3: "3列",
  rows_4: "4列",
  rows_5: "5列",
  rows_6: "6列",
  rows_7: "7列",
  rows_8: "8列",
  stagger: "千鳥",
  stagger_inverse: "逆千鳥",
  stagger_3: "3段千鳥",
  offset_triple: "3列オフセット",
  grid: "グリッド",
  columns_4: "4縦列",
  columns_5: "5縦列",
  columns_6: "6縦列",
  pyramid: "ピラミッド",
  pyramid_inverse: "逆ピラミッド",
  vee: "V字",
  inverse_vee: "逆V字",
  wedge: "楔（手前先端）",
  fan_back: "扇（奥頂点）",
  hourglass: "砂時計",
  bowtie: "蝶ネクタイ",
  arrow_back: "矢印（奥向き）",
  arrow_front: "矢印（手前）",
  arc: "円弧（客席向き）",
  arc_tight: "円弧（狭い）",
  double_arc: "二重弧",
  circle: "円周均等",
  hollow_ring: "周辺リング",
  double_ring: "二重リング",
  u_shape: "U字（客席向き）",
  concentric: "同心グループ",
  block_lr: "左右ブロック",
  block_3: "3ブロック横",
  block_3_depth: "3グループ（前中奥）",
  three_clusters: "3密集（三角）",
  wing_spread: "翼形",
  cross_split: "十字グループ",
  diamond: "ひし形周り",
  square_outline: "四角枠",
  cross: "十字形",
  x_shape: "X字形",
  scatter: "ランダム風",
  spiral: "螺旋",
  wave: "波型ライン",
  cluster_tight: "密集（センター）",
  spread_loose: "広く分散",
  asymmetric_l: "アシンメ L字",
  front_stair_from_2: "段の列（手前2人）",
  front_stair_from_3: "段の列（手前3人）",
  front_stair_from_4: "段の列（手前4人）",
  front_stair_from_5: "段の列（手前5人）",
  front_stair_from_6: "段の列（手前6人）",
  front_stair_from_7: "段の列（手前7人）",
  front_stair_from_8: "段の列（手前8人）",
  front_stair_from_9: "段の列（手前9人）",
  front_stair_from_10: "段の列（手前10人）",
  front_stair_from_11: "段の列（手前11人）",
};

function SpotThumb({ dancers }: { dancers: DancerSpot[] }) {
  const radius = dancers.length >= 12 ? 2.4 : dancers.length >= 6 ? 3.0 : 3.4;
  return (
    <svg
      viewBox="0 0 100 60"
      width={46}
      height={28}
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
