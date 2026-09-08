import type { CSSProperties } from "react";
import type { DancerFaceStampId } from "../lib/dancerFaceStamp";

type Props = {
  id: DancerFaceStampId;
  /** 描画一辺（px）。○直径の約 80–85% を渡す想定 */
  size: number;
  style?: CSSProperties;
  className?: string;
};

/**
 * LINE スタンプ風の表情。色付き○の上に載せるシンプルな顔パーツ。
 * 線色は濃色固定で、どのパレット色でも読めるようにする。
 */
export function DancerFaceStampGlyph({ id, size, style, className }: Props) {
  const s = Math.max(10, Math.round(size));
  const common = {
    width: s,
    height: s,
    display: "block",
    flexShrink: 0,
    pointerEvents: "none" as const,
    ...style,
  };

  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      width={s}
      height={s}
      aria-hidden
      style={common}
    >
      {stampContent(id)}
    </svg>
  );
}

function stampContent(id: DancerFaceStampId) {
  const ink = "#1e293b";
  const accent = "#f8fafc";
  switch (id) {
    case "smile":
      return (
        <g fill="none" stroke={ink} strokeWidth="3.2" strokeLinecap="round">
          <circle cx="22" cy="26" r="3.2" fill={ink} stroke="none" />
          <circle cx="42" cy="26" r="3.2" fill={ink} stroke="none" />
          <path d="M20 38c4 7 20 7 24 0" />
          <path d="M14 22c2-3 5-4 8-3" strokeWidth="2.4" />
          <path d="M42 19c3-1 6 0 8 3" strokeWidth="2.4" />
        </g>
      );
    case "laugh":
      return (
        <g fill="none" stroke={ink} strokeWidth="3.2" strokeLinecap="round">
          <path d="M16 28c3-5 8-5 11 0" />
          <path d="M37 28c3-5 8-5 11 0" />
          <path d="M18 36c3 12 25 12 28 0" fill={ink} stroke="none" />
          <path d="M22 36c2 7 18 7 20 0" fill="#fda4af" stroke="none" />
          <circle cx="12" cy="34" r="3.5" fill="#fb7185" stroke="none" opacity="0.85" />
          <circle cx="52" cy="34" r="3.5" fill="#fb7185" stroke="none" opacity="0.85" />
        </g>
      );
    case "cry":
      return (
        <g fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round">
          <circle cx="22" cy="24" r="3" fill={ink} stroke="none" />
          <circle cx="42" cy="24" r="3" fill={ink} stroke="none" />
          <path d="M22 28v10" stroke="#38bdf8" strokeWidth="3.5" />
          <path d="M42 28v12" stroke="#38bdf8" strokeWidth="3.5" />
          <path d="M22 40c2 3 4 4 6 4" stroke="#38bdf8" strokeWidth="2.5" />
          <path d="M42 42c-2 3-4 4-6 4" stroke="#38bdf8" strokeWidth="2.5" />
          <path d="M24 48c4-5 12-5 16 0" />
        </g>
      );
    case "moved":
      return (
        <g fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round">
          <path d="M16 26c3-4 8-4 11 1" />
          <path d="M37 27c3-4 8-4 11 1" />
          <path d="M22 30v8" stroke="#7dd3fc" strokeWidth="3" />
          <path d="M42 31v7" stroke="#7dd3fc" strokeWidth="3" />
          <path d="M22 42c5 8 15 8 20 0" />
          <path d="M30 14l2 4 4 .5-3 2.5.8 4-3.8-2.2-3.8 2.2.8-4-3-2.5 4-.5z" fill="#fde68a" stroke="none" />
          <path d="M46 12l1.4 2.8 3 .4-2.2 1.8.6 2.8-2.8-1.6-2.8 1.6.6-2.8-2.2-1.8 3-.4z" fill="#fde68a" stroke="none" />
        </g>
      );
    case "surprise":
      return (
        <g fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round">
          <circle cx="22" cy="24" r="5" fill={accent} stroke={ink} strokeWidth="2.8" />
          <circle cx="42" cy="24" r="5" fill={accent} stroke={ink} strokeWidth="2.8" />
          <circle cx="22" cy="24" r="2.2" fill={ink} stroke="none" />
          <circle cx="42" cy="24" r="2.2" fill={ink} stroke="none" />
          <ellipse cx="32" cy="44" rx="7" ry="9" fill={accent} stroke={ink} strokeWidth="2.8" />
          <path d="M18 14l-2-6" strokeWidth="2.6" />
          <path d="M32 12v-6" strokeWidth="2.6" />
          <path d="M46 14l2-6" strokeWidth="2.6" />
        </g>
      );
    case "love":
      return (
        <g>
          <path
            d="M18 24c0-3.2 2.4-5.5 5-5.5 1.6 0 3 .8 4 2.1 1-1.3 2.4-2.1 4-2.1 2.6 0 5 2.3 5 5.5 0 6-9 11-9 11s-9-5-9-11z"
            fill="#e11d48"
            transform="translate(-6 0) scale(0.72)"
          />
          <path
            d="M18 24c0-3.2 2.4-5.5 5-5.5 1.6 0 3 .8 4 2.1 1-1.3 2.4-2.1 4-2.1 2.6 0 5 2.3 5 5.5 0 6-9 11-9 11s-9-5-9-11z"
            fill="#e11d48"
            transform="translate(16 0) scale(0.72)"
          />
          <path
            d="M20 44c5 7 19 7 24 0"
            fill="none"
            stroke={ink}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      );
    case "angry":
      return (
        <g fill="none" stroke={ink} strokeWidth="3.2" strokeLinecap="round">
          <path d="M14 20l12 5" />
          <path d="M50 20l-12 5" />
          <circle cx="22" cy="28" r="3.2" fill={ink} stroke="none" />
          <circle cx="42" cy="28" r="3.2" fill={ink} stroke="none" />
          <path d="M22 46c5-6 15-6 20 0" />
          <path d="M48 14c4-1 7 1 8 5" stroke="#ef4444" strokeWidth="2.4" />
        </g>
      );
    case "sweat":
      return (
        <g fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round">
          <circle cx="22" cy="26" r="3.2" fill={ink} stroke="none" />
          <circle cx="42" cy="26" r="3.2" fill={ink} stroke="none" />
          <path d="M22 40c4 5 16 5 20 0" />
          <path d="M50 14c0 6 6 10 6 14 0 3.5-2.8 6-6 6s-6-2.5-6-6c0-4 6-8 6-14z" fill="#38bdf8" stroke="none" />
        </g>
      );
    case "wink":
      return (
        <g fill="none" stroke={ink} strokeWidth="3.2" strokeLinecap="round">
          <circle cx="22" cy="26" r="3.2" fill={ink} stroke="none" />
          <path d="M36 26c3-4 9-4 12 0" />
          <path d="M20 40c5 7 19 7 24 0" />
        </g>
      );
    case "cool":
      return (
        <g fill="none" stroke={ink} strokeWidth="2.8" strokeLinecap="round">
          <rect x="12" y="20" width="18" height="12" rx="3" fill={ink} stroke="none" />
          <rect x="34" y="20" width="18" height="12" rx="3" fill={ink} stroke="none" />
          <path d="M30 26h4" strokeWidth="3.5" />
          <path d="M14 20c4-6 32-6 36 0" strokeWidth="2.4" />
          <path d="M22 42c4 4 16 4 20 0" />
        </g>
      );
    case "sparkle":
      return (
        <g fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round">
          <path d="M16 26c3-5 9-5 12 0" />
          <path d="M36 26c3-5 9-5 12 0" />
          <path d="M20 40c4 8 20 8 24 0" />
          <path d="M10 14l1.6 3.2 3.4.4-2.6 2.2.7 3.2L10 21.4 6.9 23l.7-3.2-2.6-2.2 3.4-.4z" fill="#fbbf24" stroke="none" />
          <path d="M50 12l1.8 3.6 3.8.5-2.9 2.5.8 3.6-3.5-2-3.5 2 .8-3.6-2.9-2.5 3.8-.5z" fill="#fbbf24" stroke="none" />
          <path d="M46 44l1.2 2.4 2.6.3-2 1.7.5 2.4-2.3-1.3-2.3 1.3.5-2.4-2-1.7 2.6-.3z" fill="#fde68a" stroke="none" />
        </g>
      );
    case "sleepy":
      return (
        <g fill="none" stroke={ink} strokeWidth="3.2" strokeLinecap="round">
          <path d="M16 28c3-4 9-4 12 0" />
          <path d="M36 28c3-4 9-4 12 0" />
          <path d="M24 42c3 3 13 3 16 0" />
          <text
            x="48"
            y="18"
            fill={ink}
            stroke="none"
            fontSize="11"
            fontWeight="700"
            fontFamily="system-ui,sans-serif"
          >
            z
          </text>
          <text
            x="52"
            y="10"
            fill={ink}
            stroke="none"
            fontSize="8"
            fontWeight="700"
            fontFamily="system-ui,sans-serif"
            opacity="0.75"
          >
            z
          </text>
        </g>
      );
    default:
      return null;
  }
}
