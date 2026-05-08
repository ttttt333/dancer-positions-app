import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

/** ステージ枠のリサイズ: 四隅は両軸、辺（n/s/e/w）はその軸のみ。 */
export type StageResizeHandleId =
  | "nw"
  | "ne"
  | "se"
  | "sw"
  | "n"
  | "s"
  | "e"
  | "w";

const HANDLES: readonly StageResizeHandleId[] = [
  "nw",
  "ne",
  "se",
  "sw",
  "n",
  "s",
  "e",
  "w",
];

export type StageResizeHandlesProps = {
  hoveredHandle: StageResizeHandleId | null;
  resizeDraftActive: boolean;
  onResizePointerDown: (
    handle: StageResizeHandleId,
    e: ReactPointerEvent<HTMLDivElement>
  ) => void;
  onHandlePointerEnter: (handle: StageResizeHandleId) => void;
  onHandlePointerLeave: (handle: StageResizeHandleId) => void;
};

export function StageResizeHandles({
  hoveredHandle,
  resizeDraftActive,
  onResizePointerDown,
  onHandlePointerEnter,
  onHandlePointerLeave,
}: StageResizeHandlesProps) {
  return (
    <>
      {HANDLES.map((h) => {
        const isCorner =
          h === "nw" || h === "ne" || h === "se" || h === "sw";
        const cursor =
          h === "nw" || h === "se"
            ? "nwse-resize"
            : h === "ne" || h === "sw"
              ? "nesw-resize"
              : h === "n" || h === "s"
                ? "ns-resize"
                : "ew-resize";
        const isHover = hoveredHandle === h;
        const isActive = resizeDraftActive;
        const hitSize: CSSProperties = isCorner
          ? { width: 22, height: 22 }
          : h === "n" || h === "s"
            ? { width: 44, height: 18 }
            : { width: 18, height: 44 };
        const hitPos: CSSProperties = (() => {
          if (isCorner) {
            const isTop = h === "nw" || h === "ne";
            const isLeft = h === "nw" || h === "sw";
            return {
              ...(isTop ? { top: -11 } : { bottom: -11 }),
              ...(isLeft ? { left: -11 } : { right: -11 }),
            };
          }
          if (h === "n")
            return {
              top: -9,
              left: "50%",
              transform: "translateX(-50%)",
            };
          if (h === "s")
            return {
              bottom: -9,
              left: "50%",
              transform: "translateX(-50%)",
            };
          if (h === "w")
            return {
              left: -9,
              top: "50%",
              transform: "translateY(-50%)",
            };
          return {
            right: -9,
            top: "50%",
            transform: "translateY(-50%)",
          };
        })();
        const dotSize: CSSProperties = isCorner
          ? {
              width: isHover || isActive ? 12 : 8,
              height: isHover || isActive ? 12 : 8,
            }
          : h === "n" || h === "s"
            ? {
                width: isHover || isActive ? 24 : 16,
                height: isHover || isActive ? 8 : 5,
              }
            : {
                width: isHover || isActive ? 8 : 5,
                height: isHover || isActive ? 24 : 16,
              };
        const label = isCorner
          ? "ステージサイズ変更（Shift で広範囲まで伸ばしやすく）"
          : h === "n" || h === "s"
            ? "ステージ奥行きを変更（Shift で感度アップ）"
            : "ステージ横幅を変更（Shift で感度アップ）";
        const bg = isActive
          ? "#94a3b8"
          : isHover
            ? "#64748b"
            : "#475569";
        return (
          <div
            key={`stage-resize-${h}`}
            role="presentation"
            aria-label={`${label}（${h}）`}
            title={
              isCorner
                ? "ドラッグでステージ全体のサイズを変更。Shift を押しながらドラッグすると、同じ動きでより大きく伸ばせます（画面外までドラッグ可）"
                : h === "n" || h === "s"
                  ? "ドラッグで奥行き（前後）だけを変更。Shift で感度アップ"
                  : "ドラッグで横幅（左右）だけを変更。Shift で感度アップ"
            }
            onPointerDown={(e) => onResizePointerDown(h, e)}
            onPointerUp={(e) => {
              try {
                (e.currentTarget as HTMLDivElement).releasePointerCapture?.(
                  e.pointerId
                );
              } catch {
                /* noop */
              }
            }}
            onPointerEnter={() => onHandlePointerEnter(h)}
            onPointerLeave={() => onHandlePointerLeave(h)}
            style={{
              position: "absolute",
              zIndex: 20,
              ...hitSize,
              background: "transparent",
              cursor,
              touchAction: "none",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...hitPos,
            }}
          >
            <div
              aria-hidden
              style={{
                ...dotSize,
                borderRadius: 3,
                background: bg,
                border: "1px solid #1e293b",
                boxShadow:
                  isHover || isActive
                    ? "0 1px 4px rgba(0,0,0,0.45)"
                    : "none",
                opacity: isActive ? 0.95 : isHover ? 0.9 : 0.6,
                transition:
                  "width 120ms ease, height 120ms ease, background 120ms ease, opacity 120ms ease",
                pointerEvents: "none",
              }}
            />
          </div>
        );
      })}
    </>
  );
}
