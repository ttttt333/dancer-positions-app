import type { FormationBoxItem } from "../lib/formationBox";

type Props = {
  item: FormationBoxItem;
  /** 幅（px）。高さは viewBox 比で自動 */
  width?: number;
  className?: string;
};

/** ステージ俯瞰イメージ（上＝奥、下＝客席帯）。viewBox = 100×60。 */
const VB = "0 0 100 60";

/**
 * ユーザが保存した立ち位置のサムネイル。
 * 現在は単色の点（色番号は箱のメタでは保持）。
 */
export function FormationBoxItemThumb({ item, width = 40, className }: Props) {
  const h = Math.round((width * 60) / 100);
  const radius = item.dancers.length >= 12 ? 2.4 : item.dancers.length >= 6 ? 3.0 : 3.4;

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
      {item.dancers.map((d, i) => {
        /** xPct は 0..100、yPct は 0..100 を 2..58 に再スケール（客席帯の上まで） */
        const cx = Math.max(4, Math.min(96, d.xPct));
        const cy = 2 + (Math.max(0, Math.min(100, d.yPct)) / 100) * 56;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="currentColor"
            fillOpacity={0.92}
          />
        );
      })}
    </svg>
  );
}
