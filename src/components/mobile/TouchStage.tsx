import { useRef, useEffect, useState, useCallback, ReactNode } from "react";
import styles from "./TouchStage.module.css";

export interface Dancer {
  id: string;
  x: number;
  y: number;
  name: string;
  color?: string;
}

export interface TouchStageProps {
  dancers: Dancer[];
  onDancerMove?: (dancerId: string, x: number, y: number) => void;
  onDancerSelect?: (dancerId: string | null) => void;
  onStageTap?: (x: number, y: number) => void;
  className?: string;
  width?: number;
  height?: number;
  children?: ReactNode;
}

export function TouchStage({
  dancers,
  onDancerMove,
  onDancerSelect,
  onStageTap,
  className,
  width = 800,
  height = 600,
  children
}: TouchStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [selectedDancer, setSelectedDancer] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [draggedDancer, setDraggedDancer] = useState<string | null>(null);
  
  const lastTouchRef = useRef<{ x: number; y: number; distance: number }>({ x: 0, y: 0, distance: 0 });
  const initialPinchDistance = useRef(0);
  const initialScale = useRef(1);

  const getTouchPosition = useCallback((touch: Touch) => {
    if (!stageRef.current) return { x: 0, y: 0 };
    const rect = stageRef.current.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left - translateX) / scale,
      y: (touch.clientY - rect.top - translateY) / scale
    };
  }, [scale, translateX, translateY]);

  const getDancerAtPosition = useCallback((x: number, y: number) => {
    const threshold = 30;
    return dancers.find(dancer => {
      const distance = Math.sqrt(Math.pow(dancer.x - x, 2) + Math.pow(dancer.y - y, 2));
      return distance < threshold;
    });
  }, [dancers]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    
    if (touches.length === 1) {
      const touch = touches[0];
      const pos = getTouchPosition(touch);
      const dancer = getDancerAtPosition(pos.x, pos.y);
      
      if (dancer) {
        setDraggedDancer(dancer.id);
        setSelectedDancer(dancer.id);
        onDancerSelect?.(dancer.id);
      } else {
        setSelectedDancer(null);
        onDancerSelect?.(null);
      }
      
      setIsDragging(true);
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY, distance: 0 };
      
    } else if (touches.length === 2) {
      setIsPinching(true);
      const distance = Math.sqrt(
        Math.pow(touches[0].clientX - touches[1].clientX, 2) +
        Math.pow(touches[0].clientY - touches[1].clientY, 2)
      );
      initialPinchDistance.current = distance;
      initialScale.current = scale;
    }
  }, [getTouchPosition, getDancerAtPosition, onDancerSelect, scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touches = e.touches;
    
    if (touches.length === 1 && isDragging) {
      const touch = touches[0];
      const deltaX = touch.clientX - lastTouchRef.current.x;
      const deltaY = touch.clientY - lastTouchRef.current.y;
      
      if (draggedDancer) {
        const pos = getTouchPosition(touch);
        onDancerMove?.(draggedDancer, pos.x, pos.y);
      } else {
        setTranslateX(prev => prev + deltaX);
        setTranslateY(prev => prev + deltaY);
      }
      
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY, distance: 0 };
      
    } else if (touches.length === 2 && isPinching) {
      const distance = Math.sqrt(
        Math.pow(touches[0].clientX - touches[1].clientX, 2) +
        Math.pow(touches[0].clientY - touches[1].clientY, 2)
      );
      
      const newScale = Math.max(0.5, Math.min(3, initialScale.current * (distance / initialPinchDistance.current)));
      setScale(newScale);
    }
  }, [isDragging, isPinching, draggedDancer, getTouchPosition, onDancerMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    
    if (touches.length === 0) {
      if (isDragging && !draggedDancer) {
        const touch = e.changedTouches[0];
        const pos = getTouchPosition(touch);
        onStageTap?.(pos.x, pos.y);
      }
      
      setIsDragging(false);
      setIsPinching(false);
      setDraggedDancer(null);
    }
  }, [isDragging, draggedDancer, getTouchPosition, onStageTap]);

  const handleDancerTap = useCallback((dancerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDancer(dancerId);
    onDancerSelect?.(dancerId);
  }, [onDancerSelect]);

  const resetView = useCallback(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, []);

  return (
    <div 
      ref={stageRef}
      className={`${styles.touchStage} ${className || ""}`}
      style={{ width: `${width}px`, height: `${height}px` }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className={styles.stageContent}
        style={{
          transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
          transformOrigin: 'center center'
        }}
      >
        {/* Grid Background */}
        <div className={styles.gridBackground} />
        
        {/* Dancers */}
        {dancers.map((dancer) => (
          <div
            key={dancer.id}
            className={`${styles.dancer} ${selectedDancer === dancer.id ? styles.selected : ""}`}
            style={{
              left: `${dancer.x}px`,
              top: `${dancer.y}px`,
              backgroundColor: dancer.color || '#3b82f6'
            }}
            onMouseDown={(e) => handleDancerTap(dancer.id, e)}
          >
            <span className={styles.dancerName}>{dancer.name}</span>
          </div>
        ))}
        
        {/* Children (additional stage elements) */}
        {children}
      </div>
      
      {/* Controls */}
      <div className={styles.controls}>
        <button 
          className={styles.resetButton}
          onClick={resetView}
          aria-label="Reset view"
        >
          🔄
        </button>
        <div className={styles.zoomIndicator}>
          {Math.round(scale * 100)}%
        </div>
      </div>
    </div>
  );
}
