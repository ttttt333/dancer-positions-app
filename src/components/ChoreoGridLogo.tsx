import { useId } from "react";

export type ChoreoGridLogoProps = {
  /** 表示サイズ（正方形、px） */
  size?: number;
  /** スクリーンリーダー用。未指定時は "ChoreoGrid" */
  title?: string;
  className?: string;
};

/**
 * ChoreoGrid ブランドマーク — 俯瞰ステージ（台形）・センター赤軸・3 点フォーメーション。
 * favicon.svg と同系の幾何学で統一。
 */
export function ChoreoGridLogo({ size = 44, title = "ChoreoGrid", className }: ChoreoGridLogoProps) {
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={`cg-face-${uid}`} x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#27272a" />
          <stop offset="1" stopColor="#09090b" />
        </linearGradient>
        <linearGradient id={`cg-rim-${uid}`} x1="32" y1="2" x2="32" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgba(255,255,255,0.14)" />
          <stop offset="0.5" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.1)" />
        </linearGradient>
        <radialGradient id={`cg-hot-${uid}`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 30) rotate(90) scale(10)">
          <stop stopColor="#fecaca" stopOpacity="0.55" />
          <stop offset="1" stopColor="#dc2626" stopOpacity="0" />
        </radialGradient>
        <filter id={`cg-soft-${uid}`} x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="0.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="1.5" y="1.5" width="61" height="61" rx="17" fill={`url(#cg-face-${uid})`} stroke={`url(#cg-rim-${uid})`} strokeWidth="1" />

      <g opacity="0.11" stroke="#fafafa" strokeWidth="0.45">
        {Array.from({ length: 9 }, (_, i) => {
          const x = 8 + i * 6;
          return <line key={`gv-${i}`} x1={x} y1="10" x2={x} y2="54" />;
        })}
        {Array.from({ length: 9 }, (_, i) => {
          const y = 8 + i * 6;
          return <line key={`gh-${i}`} x1="10" y1={y} x2="54" y2={y} />;
        })}
      </g>

      <path
        d="M 21 19.5 L 43 19.5 L 51.5 47 L 12.5 47 Z"
        stroke="rgba(244,244,245,0.22)"
        strokeWidth="1.15"
        strokeLinejoin="round"
        fill="rgba(0,0,0,0.2)"
      />

      <line x1="32" y1="21" x2="32" y2="46.5" stroke="#dc2626" strokeWidth="1.35" strokeLinecap="round" opacity="0.92" />

      <path
        d="M 14 14 L 18 14 M 46 14 L 50 14 M 14 50 L 18 50 M 46 50 L 50 50"
        stroke="#dc2626"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.45"
      />

      <circle cx="32" cy="30" r="10" fill={`url(#cg-hot-${uid})`} opacity="0.85" />

      <circle cx="23.5" cy="37" r="3.6" fill="#52525b" stroke="rgba(0,0,0,0.35)" strokeWidth="0.35" />
      <circle
        cx="32"
        cy="28.5"
        r="4.25"
        fill="#dc2626"
        stroke="#450a0a"
        strokeWidth="0.4"
        filter={`url(#cg-soft-${uid})`}
      />
      <circle cx="40.5" cy="37" r="3.6" fill="#a1a1aa" stroke="rgba(0,0,0,0.35)" strokeWidth="0.35" />

      <path
        d="M 32 8.5 L 32 12.5 M 8.5 32 L 12.5 32 M 51.5 32 L 55.5 32 M 32 51.5 L 32 55.5"
        stroke="rgba(220,38,38,0.35)"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
