import { useLayoutEffect, useState, type RefObject } from "react";

export type FillStageSize = {
  widthPx: number;
  heightPx: number;
};

/**
 * コンテナ実寸からステージの contain フィットサイズを px で算出する。
 * Galaxy 等で container query (cqi/cqb) が潰れてステージが極小になるのを避ける。
 * （生徒共有横画面・モバイル編集の縦/横で使用）
 */
export function useFillStageFrameSize(params: {
  enabled: boolean;
  containerRef: RefObject<HTMLElement | null>;
  /** ステージ幅 / 奥行き（mm 比） */
  aspectWidth: number;
  aspectDepth: number;
  /** 左レールなど、測った幅から引く余白 */
  leftInsetPx?: number;
  rightInsetPx?: number;
  topInsetPx?: number;
  bottomInsetPx?: number;
}): FillStageSize | null {
  const {
    enabled,
    containerRef,
    aspectWidth,
    aspectDepth,
    leftInsetPx = 0,
    rightInsetPx = 0,
    topInsetPx = 0,
    bottomInsetPx = 0,
  } = params;
  const [size, setSize] = useState<FillStageSize | null>(null);

  useLayoutEffect(() => {
    if (!enabled) {
      setSize(null);
      return;
    }
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const aspect =
      aspectWidth > 0 && aspectDepth > 0 ? aspectWidth / aspectDepth : 4 / 3;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const availW = Math.max(0, rect.width - leftInsetPx - rightInsetPx);
      const availH = Math.max(0, rect.height - topInsetPx - bottomInsetPx);
      if (availW < 8 || availH < 8) return;

      let widthPx = availW;
      let heightPx = widthPx / aspect;
      if (heightPx > availH) {
        heightPx = availH;
        widthPx = heightPx * aspect;
      }
      widthPx = Math.floor(widthPx);
      heightPx = Math.floor(heightPx);
      setSize((prev) => {
        if (
          prev &&
          Math.abs(prev.widthPx - widthPx) < 1 &&
          Math.abs(prev.heightPx - heightPx) < 1
        ) {
          return prev;
        }
        return { widthPx, heightPx };
      });
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      vv?.removeEventListener("resize", measure);
    };
  }, [
    enabled,
    containerRef,
    aspectWidth,
    aspectDepth,
    leftInsetPx,
    rightInsetPx,
    topInsetPx,
    bottomInsetPx,
  ]);

  return enabled ? size : null;
}
