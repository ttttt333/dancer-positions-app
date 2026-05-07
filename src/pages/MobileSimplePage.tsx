import React, { useState, useEffect, useRef } from 'react';

export const MobileSimplePage: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(180); // 3分
  const [dancers, setDancers] = useState([
    { id: '1', name: 'A', x: 0, y: 0, color: '#ff6b6b' },
    { id: '2', name: 'B', x: 0.5, y: 0, color: '#4ecdc4' },
    { id: '3', name: 'C', x: -0.5, y: 0, color: '#45b7d1' },
    { id: '4', name: 'D', x: 0, y: 0.5, color: '#f9ca24' },
  ]);
  const [draggedDancer, setDraggedDancer] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // 再生機能
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, duration]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDancerDrag = (dancerId: string, newX: number, newY: number) => {
    setDancers(prev => prev.map(d => 
      d.id === dancerId ? { ...d, x: newX, y: newY } : d
    ));
    console.log(`Dancer ${dancerId} moved to:`, newX, newY);
  };

  const handleCircleFormation = () => {
    const radius = 0.6;
    const newPositions = dancers.map((dancer, index) => {
      const angle = (index / dancers.length) * Math.PI * 2;
      return {
        ...dancer,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    });
    setDancers(newPositions);
    console.log('Circle formation applied');
    if (navigator.vibrate) navigator.vibrate(100);
  };

  const handleLineFormation = () => {
    const spacing = 0.3;
    const newPositions = dancers.map((dancer, index) => {
      return {
        ...dancer,
        x: (index - (dancers.length - 1) / 2) * spacing,
        y: 0,
      };
    });
    setDancers(newPositions);
    console.log('Line formation applied');
    if (navigator.vibrate) navigator.vibrate(100);
  };

  const handleGridFormation = () => {
    const cols = Math.ceil(Math.sqrt(dancers.length));
    const spacing = 0.4;
    const newPositions = dancers.map((dancer, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      return {
        ...dancer,
        x: (col - (cols - 1) / 2) * spacing,
        y: (row - (Math.floor(dancers.length / cols) - 1) / 2) * spacing,
      };
    });
    setDancers(newPositions);
    console.log('Grid formation applied');
    if (navigator.vibrate) navigator.vibrate(100);
  };

  const handleTouchStart = (e: React.TouchEvent, dancerId: string) => {
    e.preventDefault();
    setDraggedDancer(dancerId);
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggedDancer) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const stage = e.currentTarget as HTMLElement;
    const rect = stage.getBoundingClientRect();
    
    const x = ((touch.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((touch.clientY - rect.top) / rect.height - 0.5) * 2;
    
    const clampedX = Math.max(-1, Math.min(1, x));
    const clampedY = Math.max(-1, Math.min(1, y));
    
    handleDancerDrag(draggedDancer, clampedX, clampedY);
  };

  const handleTouchEnd = () => {
    if (draggedDancer) {
      setDraggedDancer(null);
      if (navigator.vibrate) navigator.vibrate(20);
    }
  };

  return (
    <>
      <style>{`
        * {
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
        }
        
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: 100% !important;
          overflow: hidden !important;
          background: #0a0c10 !important;
          -webkit-font-smoothing: antialiased;
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        }
        
        #root {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: 100% !important;
          overflow: hidden !important;
        }
        
        /* iOS Safari セーフエリア対応 */
        @supports (padding: max(0px)) {
          html, body {
            padding-left: env(safe-area-inset-left) !important;
            padding-right: env(safe-area-inset-right) !important;
            padding-top: env(safe-area-inset-top) !important;
            padding-bottom: env(safe-area-inset-bottom) !important;
          }
        }
        
        /* Safari特有のスタイルリセット */
        body {
          position: fixed !important;
          width: 100% !important;
          height: 100% !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
        }
        
        .language-selector,
        .language-bar,
        .language-switcher,
        [class*="language"],
        [class*="lang"],
        [id*="language"] {
          display: none !important;
          visibility: hidden !important;
        }
      `}</style>
      <div style={{
        width: '100vw',
        height: '100dvh',
        background: '#0a0c10',
        color: '#f0f2f8',
        display: 'flex',
        flexDirection: window.innerWidth > window.innerHeight ? 'row' : 'column',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        margin: 0,
        padding: 0,
        /* セーフエリア対応 */
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        /* ネガティブマージンでセーフエリアを相殺 */
        marginTop: 'calc(env(safe-area-inset-top, 0px) * -1)',
        marginBottom: 'calc(env(safe-area-inset-bottom, 0px) * -1)',
        marginLeft: 'calc(env(safe-area-inset-left, 0px) * -1)',
        marginRight: 'calc(env(safe-area-inset-right, 0px) * -1)',
      }}>
      {/* ステージエリア */}
      <div style={{
        flex: window.innerWidth > window.innerHeight ? '1' : '0 0 75%',
        position: 'relative',
        background: '#080a0d',
        border: '1px solid rgba(255,255,255,0.1)',
        minHeight: window.innerWidth > window.innerHeight ? 'auto' : '0',
      }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      >
        {/* グリッド */}
        <svg style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
        }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="rgba(108,99,255,0.2)" strokeWidth="1" strokeDasharray="4 4"/>
          <line x1="5%" y1="90%" x2="95%" y2="90%" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
        </svg>

        {/* ダンサーマーカー */}
        {dancers.map(dancer => (
          <div
            key={dancer.id}
            onTouchStart={(e) => handleTouchStart(e, dancer.id)}
            style={{
              position: 'absolute',
              left: `${dancer.x * 50 + 50}%`,
              top: `${dancer.y * 50 + 50}%`,
              transform: 'translate(-50%, -50%)',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: dancer.color,
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: draggedDancer === dancer.id ? 'grabbing' : 'grab',
              boxShadow: draggedDancer === dancer.id ? '0 0 0 6px rgba(255,255,255,0.2)' : '0 0 0 4px rgba(255,255,255,0.1)',
              transition: draggedDancer === dancer.id ? 'none' : 'transform 0.15s ease',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            {dancer.name}
          </div>
        ))}

        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.5)',
        }}>
          客席
        </div>
      </div>

      {/* 波形エリア */}
      <div style={{
        flex: window.innerWidth > window.innerHeight ? '0.3' : '0 0 25%',
        width: window.innerWidth > window.innerHeight ? '280px' : 'auto',
        background: '#0f1114',
        borderTop: window.innerWidth > window.innerHeight ? 'none' : '1px solid rgba(255,255,255,0.1)',
        borderLeft: window.innerWidth > window.innerHeight ? '1px solid rgba(255,255,255,0.1)' : 'none',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: window.innerWidth > window.innerHeight ? '250px' : 'auto',
        maxWidth: window.innerWidth > window.innerHeight ? '320px' : 'auto',
        position: 'relative',
      }}>
        {/* 波形表示 */}
        <div style={{
          flex: '1',
          position: 'relative',
          minHeight: '60px',
        }}>
          <svg viewBox="0 0 1000 100" style={{ width: '100%', height: '100%' }}>
            <path
              d="M0,50 Q50,30 100,50 T200,50 T300,50 T400,50 T500,50 T600,50 T700,50 T800,50 T900,50 T1000,50"
              fill="none"
              stroke="rgba(108,99,255,0.6)"
              strokeWidth="2"
            />
            <line 
              x1={`${(currentTime / duration) * 100}%`} 
              y1="0" 
              x2={`${(currentTime / duration) * 100}%`} 
              y2="100%" 
              stroke="#ff6b6b" 
              strokeWidth="2" 
            />
          </svg>
        </div>

        {/* 再生コントロール */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <button
            onClick={() => {
              setIsPlaying(!isPlaying);
              console.log('Play button clicked:', !isPlaying);
            }}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: isPlaying ? '#6c63ff' : 'rgba(108,99,255,0.2)',
              border: '1px solid rgba(108,99,255,0.4)',
              color: isPlaying ? 'white' : '#6c63ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.8)',
          }}>
            {formatTime(currentTime)}
          </div>
        </div>
      </div>

      {/* FABメニュー - 縦画面のみ表示 */}
      {window.innerWidth <= window.innerHeight && (
        <div style={{
          position: 'fixed',
          bottom: '16px',
          left: '16px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <button
            onClick={() => {
              setIsMenuOpen(!isMenuOpen);
              console.log('FAB button clicked:', !isMenuOpen);
            }}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: isMenuOpen ? 'linear-gradient(135deg, #ff6b6b, #e74c3c)' : 'linear-gradient(135deg, #6c63ff, #4a47e0)',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(108, 99, 255, 0.4)',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: isMenuOpen ? 'rotate(45deg)' : 'rotate(0deg)',
            }}
          >
            {isMenuOpen ? '✕' : '☰'}
          </button>

          {isMenuOpen && (
            <div style={{
              display: 'flex',
              gap: '8px',
              marginLeft: '8px',
            }}>
              <button
                onClick={handleCircleFormation}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontSize: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ⭕
              </button>
              <button
                onClick={handleLineFormation}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontSize: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ➖
              </button>
              <button
                onClick={handleGridFormation}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontSize: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ⊞
              </button>
            </div>
          )}
        </div>
      )}
      </div>
    </>
  );
};
