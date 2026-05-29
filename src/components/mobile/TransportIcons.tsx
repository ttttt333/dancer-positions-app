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
      <path d="M6 7v10l8.5-5L6 7Z" fill="currentColor" />
      <rect x="15.5" y="7" width="2.5" height="10" rx="1" fill="currentColor" />
    </svg>
  );
}

export function TransportIconSkipForward(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M18 7v10l-8.5-5L18 7Z" fill="currentColor" />
      <rect x="6" y="7" width="2.5" height="10" rx="1" fill="currentColor" />
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
        d="M8 7H5v3"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 10a7 7 0 1 1 2.05 4.95"
        stroke="currentColor"
        strokeWidth="2.2"
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
      <path
        d="M16 7h3v3"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 10a7 7 0 1 1-2.05 4.95"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
