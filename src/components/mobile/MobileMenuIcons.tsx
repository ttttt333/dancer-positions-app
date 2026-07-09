import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, className, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true as const,
    className,
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export type MobileMenuIconId =
  | "cue"
  | "stage"
  | "list"
  | "library"
  | "image"
  | "save"
  | "text"
  | "shape"
  | "prop"
  | "audio"
  | "ai"
  | "roster"
  | "member"
  | "add"
  | "share"
  | "export"
  | "video"
  | "help";

export function MobileMenuIcon({
  id,
  size = 20,
  className,
}: {
  id: MobileMenuIconId;
  size?: number;
  className?: string;
}) {
  const p = base({ size, className });
  switch (id) {
    case "cue":
      return (
        <svg {...p}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="M8 6V4.5M16 6V4.5M4 11h16" />
        </svg>
      );
    case "stage":
      return (
        <svg {...p}>
          <path d="M4 18h16M6 18V9l6-4 6 4v9" />
          <path d="M10 18v-4h4v4" />
        </svg>
      );
    case "list":
      return (
        <svg {...p}>
          <rect x="5" y="3.5" width="14" height="17" rx="2" />
          <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5" />
        </svg>
      );
    case "library":
      return (
        <svg {...p}>
          <path d="M5 5.5h4v13H5zM10.5 5.5h4v13h-4zM16 7.5l3 1.2v10.3l-3-1.2V7.5z" />
        </svg>
      );
    case "image":
      return (
        <svg {...p}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none" />
          <path d="M4.5 16.5 9 12l3 2.5 3.5-4 4 6" />
        </svg>
      );
    case "save":
      return (
        <svg {...p}>
          <path d="M6 4.5h10.5L19.5 8v11.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" />
          <path d="M8 4.5v4.5h7V4.5M8 19.5v-5h8v5" />
        </svg>
      );
    case "text":
      return (
        <svg {...p}>
          <path d="M5 6.5h14M12 6.5v11M9 17.5h6" />
        </svg>
      );
    case "shape":
      return (
        <svg {...p}>
          <path d="M4 17.5 12 5.5l8 12H4Z" />
          <path d="M8.5 17.5 12 11l3.5 6.5" />
        </svg>
      );
    case "prop":
      return (
        <svg {...p}>
          <path d="M7 20v-8.5h10V20M6 11.5h12M9 11.5V8.5a3 3 0 0 1 6 0v3" />
        </svg>
      );
    case "audio":
      return (
        <svg {...p}>
          <path d="M10 16.5V7l8-2.5v9.5" />
          <circle cx="8" cy="16.5" r="2.2" />
          <circle cx="16" cy="14" r="2.2" />
        </svg>
      );
    case "ai":
      return (
        <svg {...p}>
          <path d="M12 3.5v2.5M12 18v2.5M4.8 6.5l1.8 1.8M17.4 15.7l1.8 1.8M3.5 12H6M18 12h2.5M4.8 17.5l1.8-1.8M17.4 8.3l1.8-1.8" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      );
    case "roster":
      return (
        <svg {...p}>
          <path d="M8 4.5h8a2 2 0 0 1 2 2v13l-3-1.5-3 1.5-3-1.5-3 1.5v-13a2 2 0 0 1 2-2Z" />
          <path d="M9 9h6M9 12.5h6M9 16h3.5" />
        </svg>
      );
    case "member":
      return (
        <svg {...p}>
          <circle cx="12" cy="8.5" r="3" />
          <path d="M5.5 19.5c1.2-3.4 3.5-5 6.5-5s5.3 1.6 6.5 5" />
        </svg>
      );
    case "add":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8.5v7M8.5 12h7" />
        </svg>
      );
    case "share":
      return (
        <svg {...p}>
          <circle cx="6.5" cy="12" r="2.2" />
          <circle cx="17" cy="7" r="2.2" />
          <circle cx="17" cy="17" r="2.2" />
          <path d="M8.5 11.2 14.8 8M8.5 12.8l6.3 3.2" />
        </svg>
      );
    case "export":
      return (
        <svg {...p}>
          <path d="M12 15.5V5M8.5 8.5 12 5l3.5 3.5" />
          <path d="M5 14.5v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
        </svg>
      );
    case "video":
      return (
        <svg {...p}>
          <rect x="3.5" y="6.5" width="12" height="11" rx="2" />
          <path d="M15.5 10.5 20.5 8v8l-5-2.5" />
        </svg>
      );
    case "help":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8" />
          <path d="M9.8 9.4a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.2.9-1.2 1.7V14" />
          <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return null;
  }
}
