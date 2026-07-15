import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function iconProps({ size = 20, className, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true as const,
    className,
    ...rest,
  };
}

export function TransportIconPlay(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path
        d="M8 5.2v13.6c0 .9 1 .4 1.5-.2l8.2-6.6c.5-.4.5-1.2 0-1.6L9.5 5.4C9 .8 8 1.3 8 5.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function TransportIconPause(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <rect x="5" y="4" width="5" height="16" rx="1.5" fill="currentColor" />
      <rect x="14" y="4" width="5" height="16" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function TransportIconStop(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <rect x="5" y="5" width="14" height="14" rx="2.5" fill="currentColor" />
    </svg>
  );
}

export function TransportIconSkipBack(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M18 7v10l-8.5-5L18 7Z" fill="currentColor" />
      <rect x="6" y="7" width="2.5" height="10" rx="1" fill="currentColor" />
    </svg>
  );
}

export function TransportIconSkipForward(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M6 7v10l8.5-5L6 7Z" fill="currentColor" />
      <rect x="15.5" y="7" width="2.5" height="10" rx="1" fill="currentColor" />
    </svg>
  );
}

export function TransportIconZoomIn(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path
        d="M11 5h2v14h-2V5ZM5 11h14v2H5v-2Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function TransportIconZoomOut(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M5 11h14v2H5v-2Z" fill="currentColor" />
    </svg>
  );
}

/** ステージを編集しやすい倍率へ一気に拡大 */
export function TransportIconStageZoomEdit(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path
        d="M4.5 9.5V5.5A1 1 0 0 1 5.5 4.5h4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14.5 4.5h4A1 1 0 0 1 19.5 5.5v4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M19.5 14.5v4a1 1 0 0 1-1 1h-4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M9.5 19.5h-4a1 1 0 0 1-1-1v-4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M10 8h1.2v6H10V8Zm-2 3.4h6v1.2H8v-1.2Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

/** ステージ全体が見える倍率へ縮小 */
export function TransportIconStageZoomFit(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <rect
        x="4.5"
        y="4.5"
        width="15"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function TransportIconChevronLeft(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path
        d="M14 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TransportIconChevronRight(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path
        d="M10 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TransportIconUndo(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path
        d="m9 14-5-5 5-5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function TransportIconRedo(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <g transform="translate(24 0) scale(-1 1)">
        <path
          d="m9 14-5-5 5-5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
