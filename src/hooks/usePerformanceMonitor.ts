import { useEffect, useRef } from "react";

/**
 * 🚀 パフォーマンス監視Hook
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current++;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    
    console.log(`🔍 ${componentName} render #${renderCount.current} (${timeSinceLastRender}ms ago)`);
    
    // 警告：頻繁な再レンダリング
    if (timeSinceLastRender < 100) {
      console.warn(`⚠️ ${componentName} rendering too frequently!`);
    }
    
    lastRenderTime.current = now;
  });
}

/**
 * 🚀 Zustand selectorパフォーマンスチェック
 */
export function useZustandPerformance<T>(
  selector: (state: any) => T,
  componentName: string,
  selectorName: string
) {
  const lastValue = useRef<T>();
  const callCount = useRef(0);

  return (state: any): T => {
    callCount.current++;
    const value = selector(state);
    
    if (JSON.stringify(value) !== JSON.stringify(lastValue.current)) {
      console.log(`🎯 ${componentName}.${selectorName} changed (call #${callCount.current})`);
      lastValue.current = value;
    }
    
    return value;
  };
}
