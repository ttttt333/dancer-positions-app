import { useLocation, useNavigate } from "react-router-dom";
import { useMemo, useEffect } from "react";
import styles from "./BottomNav.module.css";

export interface BottomNavProps {
  className?: string;
}

export function BottomNav({ className }: BottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Add body class to prevent content overlap (mobile-safe)
  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof document !== 'undefined') {
      document.body.classList.add('has-bottom-nav');
      return () => {
        document.body.classList.remove('has-bottom-nav');
      };
    }
  }, []);

  const navItems = useMemo(() => [
    { id: "stage", label: "ステージ", path: "/", icon: "🎭" },
    { id: "dancers", label: "ダンサー", path: "/library", icon: "👯" },
    { id: "scenes", label: "シーン", path: "/video", icon: "🎬" },
    { id: "settings", label: "設定", path: "/editor/new", icon: "⚙️" },
  ], []);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  return (
    <nav className={`${styles.bottomNav} ${className || ""}`} data-bottom-nav>
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`${styles.navItem} ${isActive(item.path) ? styles.active : ""}`}
          onClick={() => handleNavClick(item.path)}
          aria-label={item.label}
        >
          <span className={styles.navIcon}>{item.icon}</span>
          <span className={styles.navLabel}>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
