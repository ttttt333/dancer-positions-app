/** 回転ハンドル内の白い矢印アイコン（参照アプリの円形リフレッシュに近い形） */
export function RotateHandleGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ display: "block" }}
    >
      <path
        d="M12 4.5v3m0 9v3M4.5 12H2m20 0h-2.5"
        stroke="#ffffff"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <path
        d="M7 7.5c1.6-1.85 3.95-3 6.5-3a8 8 0 0 1 8 8"
        stroke="#ffffff"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <path
        d="M17 16.5c-1.6 1.85-3.95 3-6.5 3a8 8 0 0 1-8-8"
        stroke="#ffffff"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  );
}
