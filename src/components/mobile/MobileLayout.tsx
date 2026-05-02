import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import styles from './MobileLayout.module.css';

export interface MobileLayoutProps {
  children: ReactNode;
  showBottomNav?: boolean;
  className?: string;
}

export function MobileLayout({ 
  children, 
  showBottomNav = true,
  className 
}: MobileLayoutProps) {
  return (
    <div className={`${styles.mobileLayout} ${className || ''}`}>
      <div className={styles.mainContent}>
        {children}
      </div>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
