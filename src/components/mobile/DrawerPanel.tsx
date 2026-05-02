import { useRef, useEffect, useState, useCallback, ReactNode } from "react";
import styles from "./DrawerPanel.module.css";

export interface DrawerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  width?: number;
  edgeWidth?: number;
}

export function DrawerPanel({ 
  isOpen, 
  onClose, 
  children, 
  className,
  width = 280,
  edgeWidth = 20
}: DrawerPanelProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [startX, setStartX] = useState(0);
  const animationRef = useRef<number>();

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    const target = e.target as HTMLElement;
    
    // Only allow swipe from edge when drawer is closed
    if (!isOpen && touch.clientX > edgeWidth) {
      return;
    }
    
    // Allow swipe from anywhere when drawer is open
    if (isOpen || touch.clientX <= edgeWidth) {
      setIsDragging(true);
      setStartX(touch.clientX);
      setDragX(0);
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
  }, [isOpen, edgeWidth]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    
    // Limit drag distance
    if (isOpen) {
      // When open, allow dragging left to close
      setDragX(Math.min(0, Math.max(-width, deltaX)));
    } else {
      // When closed, allow dragging right to open
      setDragX(Math.min(width, Math.max(0, deltaX)));
    }
  }, [isDragging, startX, isOpen, width]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    // Determine if we should open or close based on drag distance
    const threshold = width * 0.3;
    if (isOpen) {
      // If dragged left more than threshold, close
      if (Math.abs(dragX) > threshold) {
        onClose();
      }
    } else {
      // If dragged right more than threshold, open
      if (dragX > threshold) {
        onClose(); // This will toggle isOpen in parent
      }
    }
    
    setDragX(0);
  }, [isDragging, dragX, isOpen, width, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      handleTouchMove(e);
    };

    const handleGlobalTouchEnd = () => {
      handleTouchEnd();
    };

    if (isDragging) {
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      document.addEventListener('touchend', handleGlobalTouchEnd);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      document.body.style.overflow = '';
    };
  }, [isDragging, handleTouchMove, handleTouchEnd]);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;

    drawer.addEventListener('touchstart', handleTouchStart, { passive: true });
    
    return () => {
      drawer.removeEventListener('touchstart', handleTouchStart);
    };
  }, [handleTouchStart]);

  const drawerStyle = {
    transform: isOpen 
      ? `translateX(0)` 
      : isDragging 
        ? `translateX(${dragX}px)` 
        : `translateX(-100%)`,
    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  const overlayStyle = {
    opacity: isOpen ? 1 : 0,
    pointerEvents: isOpen ? 'auto' : 'none' as const,
    transition: 'opacity 0.3s ease',
  };

  return (
    <>
      <div 
        ref={overlayRef}
        className={styles.overlay}
        style={overlayStyle}
        onClick={handleOverlayClick}
      />
      <div
        ref={drawerRef}
        className={`${styles.drawer} ${className || ""}`}
        style={{ ...drawerStyle, width: `${width}px` }}
      >
        <div className={styles.drawerContent}>
          {children}
        </div>
      </div>
    </>
  );
}
