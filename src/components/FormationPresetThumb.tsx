import type { LayoutPresetId } from "../lib/formationLayouts";

type Props = {
  preset: LayoutPresetId;
  /** 幅（px）。高さは viewBox 比で自動 */
  width?: number;
  className?: string;
};

/** ステージ俯瞰イメージ（上＝奥、下＝客席帯） */
const VB = "0 0 100 60";

/** `frontAudienceGrowingRowCounts` と同じ段の増分（サムネ用の人数サンプル） */
function growingStairRowCountsForThumb(n: number, firstRow: number): number[] {
  const rows: number[] = [];
  let rem = n;
  let w = Math.max(1, Math.floor(firstRow));
  while (rem > 0) {
    const take = Math.min(w, rem);
    rows.push(take);
    rem -= take;
    w += 1;
  }
  return rows;
}

function thumbPointsFrontStair(firstRow: number): readonly (readonly [number, number])[] {
  const nSample = Math.min(16, Math.max(6, firstRow * 3));
  const counts = growingStairRowCountsForThumb(nSample, firstRow);
  const nr = counts.length;
  const maxCnt = Math.max(1, ...counts);
  const pts: [number, number][] = [];
  const yFront = 50;
  const yBack = 16;
  for (let r = 0; r < nr; r++) {
    const cnt = counts[r]!;
    const y =
      nr <= 1 ? yFront : yBack + ((nr - 1 - r) / (nr - 1)) * (yFront - yBack);
    const step =
      cnt <= 1 ? 0 : Math.min(14, (maxCnt > 1 ? 56 / (maxCnt - 1) : 14));
    const span = cnt <= 1 ? 0 : step * (cnt - 1);
    for (let j = 0; j < cnt; j++) {
      const x = cnt === 1 ? 50 : 50 - span / 2 + j * step;
      pts.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    }
  }
  return pts;
}

function Dots({ pts }: { pts: readonly (readonly [number, number])[] }) {
  return (
    <>
      {pts.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={3.4} fill="currentColor" />
      ))}
    </>
  );
}

/**
 * フォーメーション案の参考図（ラベル横のミニサムネイル）。
 * 人数は固定の示意で、実配置の縮図ではない。
 */
export function FormationPresetThumb({ preset, width = 36, className }: Props) {
  const h = Math.round((width * 60) / 100);
  let pts: readonly (readonly [number, number])[] = [];

  switch (preset) {
    case "line":
      pts = [
        [16, 28],
        [32, 28],
        [50, 28],
        [68, 28],
        [84, 28],
      ];
      break;
    case "line_front":
      pts = [
        [18, 42],
        [36, 42],
        [54, 42],
        [72, 42],
      ];
      break;
    case "line_back":
      pts = [
        [18, 16],
        [36, 16],
        [54, 16],
        [72, 16],
      ];
      break;
    case "arc":
      pts = [
        [16, 36],
        [30, 20],
        [50, 14],
        [70, 20],
        [84, 36],
      ];
      break;
    case "arc_tight":
      pts = [
        [28, 32],
        [38, 22],
        [50, 18],
        [62, 22],
        [72, 32],
      ];
      break;
    case "vee":
      pts = [
        [50, 16],
        [34, 30],
        [26, 44],
        [74, 44],
        [66, 30],
      ];
      break;
    case "grid":
      pts = [
        [28, 18],
        [50, 18],
        [72, 18],
        [28, 32],
        [50, 32],
        [72, 32],
        [28, 46],
        [50, 46],
        [72, 46],
      ];
      break;
    case "diamond":
      pts = [
        [50, 14],
        [74, 30],
        [50, 46],
        [26, 30],
      ];
      break;
    case "pyramid":
      pts = [
        [50, 12],
        [34, 24],
        [50, 24],
        [66, 24],
        [42, 36],
        [58, 36],
        [50, 50],
      ];
      break;
    case "pyramid_inverse":
      pts = [
        [50, 18],
        [38, 30],
        [62, 30],
        [30, 42],
        [50, 42],
        [70, 42],
        [22, 50],
        [38, 50],
        [54, 50],
        [70, 50],
        [82, 50],
      ];
      break;
    case "front_stair_from_2":
    case "front_stair_from_3":
    case "front_stair_from_4":
    case "front_stair_from_5":
    case "front_stair_from_6":
    case "front_stair_from_7":
    case "front_stair_from_8":
    case "front_stair_from_9":
    case "front_stair_from_10":
    case "front_stair_from_11": {
      const k = parseInt(preset.slice("front_stair_from_".length), 10);
      pts = thumbPointsFrontStair(Math.max(2, Math.min(11, Number.isFinite(k) ? k : 2)));
      break;
    }
    case "rows_3":
      pts = [
        [30, 46],
        [50, 46],
        [70, 46],
        [30, 30],
        [50, 30],
        [70, 30],
        [30, 14],
        [50, 14],
        [70, 14],
      ];
      break;
    case "rows_4":
      pts = [
        [34, 48],
        [50, 48],
        [66, 48],
        [34, 36],
        [50, 36],
        [66, 36],
        [34, 24],
        [50, 24],
        [66, 24],
        [34, 12],
        [50, 12],
        [66, 12],
      ];
      break;
    case "rows_5":
      pts = [
        [30, 50],
        [50, 50],
        [70, 50],
        [30, 40],
        [50, 40],
        [70, 40],
        [30, 30],
        [50, 30],
        [70, 30],
        [30, 20],
        [50, 20],
        [70, 20],
        [30, 10],
        [50, 10],
        [70, 10],
      ];
      break;
    case "rows_6":
      pts = [
        [34, 52],
        [50, 52],
        [66, 52],
        [34, 44],
        [50, 44],
        [66, 44],
        [34, 36],
        [50, 36],
        [66, 36],
        [34, 28],
        [50, 28],
        [66, 28],
        [34, 20],
        [50, 20],
        [66, 20],
        [34, 12],
        [50, 12],
        [66, 12],
      ];
      break;
    case "stagger":
      pts = [
        [22, 22],
        [50, 22],
        [78, 22],
        [36, 38],
        [64, 38],
      ];
      break;
    case "stagger_inverse":
      /** 奥 4 + 手前 3（隙間）の示意 */
      pts = [
        [18, 16],
        [40, 16],
        [62, 16],
        [84, 16],
        [29, 30],
        [51, 30],
        [73, 30],
      ];
      break;
    case "two_rows":
      pts = [
        [22, 20],
        [50, 20],
        [78, 20],
        [22, 38],
        [50, 38],
        [78, 38],
      ];
      break;
    case "circle":
      pts = [
        [50, 12],
        [72, 22],
        [78, 36],
        [66, 48],
        [34, 48],
        [22, 36],
        [28, 22],
      ];
      break;
    case "u_shape":
      pts = [
        [18, 18],
        [18, 32],
        [18, 46],
        [36, 52],
        [64, 52],
        [82, 46],
        [82, 32],
        [82, 18],
      ];
      break;
    case "diagonal_se":
      pts = [
        [22, 16],
        [36, 24],
        [50, 32],
        [64, 40],
        [78, 48],
      ];
      break;
    case "diagonal_ne":
      pts = [
        [22, 48],
        [36, 40],
        [50, 32],
        [64, 24],
        [78, 16],
      ];
      break;
    case "columns_4":
      pts = [
        [22, 18],
        [22, 32],
        [22, 46],
        [40, 18],
        [40, 32],
        [40, 46],
        [60, 18],
        [60, 32],
        [60, 46],
        [78, 18],
        [78, 32],
        [78, 46],
      ];
      break;
    case "wedge":
      pts = [
        [50, 48],
        [32, 26],
        [44, 32],
        [56, 32],
        [68, 26],
      ];
      break;
    case "scatter":
      pts = [
        [26, 20],
        [58, 18],
        [44, 34],
        [72, 38],
        [34, 48],
        [66, 26],
      ];
      break;
    case "spiral":
      pts = [
        [50, 28],
        [62, 26],
        [68, 34],
        [64, 44],
        [50, 48],
        [36, 42],
        [32, 30],
        [40, 22],
      ];
      break;
    case "wave":
      pts = [
        [14, 26],
        [28, 18],
        [42, 26],
        [56, 18],
        [70, 26],
        [86, 18],
      ];
      break;
    case "block_lr":
      pts = [
        [24, 22],
        [30, 32],
        [22, 42],
        [76, 22],
        [70, 32],
        [78, 42],
      ];
      break;
    case "two_rows_dense_back":
      pts = [
        [30, 38],
        [70, 38],
        [22, 18],
        [50, 18],
        [78, 18],
      ];
      break;
    case "inverse_vee":
      pts = [
        [50, 14],
        [32, 32],
        [24, 46],
        [68, 32],
        [76, 46],
      ];
      break;
    case "cluster_tight":
      pts = [
        [46, 28],
        [54, 28],
        [48, 34],
        [52, 40],
        [50, 32],
      ];
      break;
    case "spread_loose":
      pts = [
        [16, 14],
        [84, 14],
        [12, 46],
        [88, 46],
        [50, 30],
      ];
      break;
    case "asymmetric_l":
      pts = [
        [18, 16],
        [18, 28],
        [18, 40],
        [32, 48],
        [50, 48],
      ];
      break;
    case "hollow_ring":
      pts = [
        [50, 12],
        [76, 24],
        [82, 44],
        [50, 52],
        [18, 44],
      ];
      break;
    case "stairs_diag":
      pts = [
        [18, 20],
        [32, 28],
        [46, 36],
        [60, 44],
        [74, 52],
      ];
      break;
    case "offset_triple":
      pts = [
        [26, 22],
        [50, 32],
        [74, 22],
        [26, 42],
        [50, 52],
      ];
      break;
    case "line_vertical":
      pts = [
        [50, 14],
        [50, 26],
        [50, 38],
        [50, 50],
      ];
      break;
    case "fan_back":
      pts = [
        [50, 12],
        [28, 28],
        [40, 34],
        [60, 34],
        [72, 28],
      ];
      break;
    case "square_outline":
      pts = [
        [22, 18],
        [50, 18],
        [78, 18],
        [78, 36],
        [78, 52],
        [50, 52],
        [22, 52],
        [22, 36],
      ];
      break;
    default:
      pts = [
        [16, 28],
        [32, 28],
        [50, 28],
        [68, 28],
        [84, 28],
      ];
  }

  return (
    <svg
      className={className}
      viewBox={VB}
      width={width}
      height={h}
      aria-hidden
      style={{
        flexShrink: 0,
        color: "inherit",
        display: "block",
      }}
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
      <Dots pts={pts} />
    </svg>
  );
}
