import { useRef, useState } from "react";

/**
 * 🚀 ピンチズーム対応（余裕あれば実装）
 */
export function usePinchZoom() {
  const [scale, setScale] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const lastDistance = useRef(0);

  const getDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsPinching(true);
      lastDistance.current = getDistance(e.touches);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPinching || e.touches.length < 2) return;
    
    e.preventDefault();
    const currentDistance = getDistance(e.touches);
    const delta = currentDistance - lastDistance.current;
    
    const newScale = Math.max(0.5, Math.min(3, scale + delta * 0.01));
    setScale(newScale);
    lastDistance.current = currentDistance;
  };

  const handleTouchEnd = () => {
    setIsPinching(false);
  };

  return {
    scale,
    isPinching,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    transform: `scale(${scale})`,
  };
}
