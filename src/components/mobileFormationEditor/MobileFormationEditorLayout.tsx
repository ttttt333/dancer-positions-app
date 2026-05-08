import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo, type CSSProperties } from "react";

/** モバイル向け編集 UI（タイムラインをヘッダー直下に配置したレイアウト）— 見た目のみのデモ */

const c = {
  pageBg: "#050506",
  headerBg: "#2a2a2e",
  headerBorder: "#3f3f46",
  text: "#f4f4f5",
  textMuted: "#a1a1aa",
  timelineBg: "#36363a",
  waveBar: "rgba(180, 180, 190, 0.45)",
  waveBarHi: "rgba(220, 220, 230, 0.65)",
  stageBg: "#1a2436",
  gridLine: "rgba(186, 210, 255, 0.38)",
  redFrame: "#c62828",
  redMenu: "#b71c1c",
  timeBadge: "#d32f2f",
  playhead: "#fafafa",
};

const styles: Record<string, CSSProperties> = {
  root: {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    background: c.pageBg,
    color: c.text,
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif',
    WebkitFontSmoothing: "antialiased",
    overflow: "hidden",
  },
  header: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 12px",
    background: c.headerBg,
    borderBottom: `1px solid ${c.headerBorder}`,
  },
  headerBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    border: "none",
    borderRadius: 10,
    background: "transparent",
    color: c.text,
    cursor: "pointer",
    padding: 0,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 2,
  },
  timelineWrap: {
    flexShrink: 0,
    padding: "8px 10px 10px",
    background: c.pageBg,
  },
  timelineBar: {
    position: "relative",
    height: 56,
    borderRadius: 10,
    background: c.timelineBg,
    overflow: "hidden",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    padding: "6px 36px 8px",
    boxSizing: "border-box",
  },
  timelineSkip: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: c.textMuted,
    background: "linear-gradient(90deg, rgba(0,0,0,0.35), transparent)",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  timelineSkipRight: {
    right: 0,
    background: "linear-gradient(270deg, rgba(0,0,0,0.35), transparent)",
  },
  playhead: {
    position: "absolute",
    top: 4,
    bottom: 4,
    width: 2,
    marginLeft: -1,
    background: c.playhead,
    borderRadius: 1,
    boxShadow: "0 0 6px rgba(255,255,255,0.5)",
    pointerEvents: "none",
    zIndex: 2,
  },
  timeBadge: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 3,
    padding: "4px 12px",
    borderRadius: 999,
    background: c.timeBadge,
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.02em",
    boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
  },
  stageColumn: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    padding: "0 10px 8px",
    gap: 4,
  },
  stageLabel: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.12em",
    color: c.textMuted,
    margin: "2px 0",
  },
  stageFrame: {
    position: "relative",
    flex: 1,
    minHeight: 220,
    borderRadius: 12,
    border: `4px solid ${c.redFrame}`,
    boxSizing: "border-box",
    overflow: "hidden",
    background: c.stageBg,
  },
  canvasHost: {
    position: "absolute",
    inset: 0,
    zIndex: 0,
  },
  stageOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    pointerEvents: "none",
    backgroundImage: `
      linear-gradient(0deg, ${c.gridLine} 1px, transparent 1px),
      linear-gradient(90deg, ${c.gridLine} 1px, transparent 1px)
    `,
    backgroundSize: "28px 28px",
    backgroundPosition: "center center",
  },
  stageRow: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch",
  },
  sideline: {
    width: 36,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sidelineDot: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "#f8fafc",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 800,
    boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.12)",
  },
  stageMain: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },
  axisRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 4px 0",
    marginTop: 2,
  },
  axisTick: {
    fontSize: 9,
    fontWeight: 600,
    color: "#94a3b8",
    fontVariantNumeric: "tabular-nums",
    flex: "1 1 0",
    textAlign: "center",
    minWidth: 0,
  },
  dancerWrap: {
    position: "absolute",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    pointerEvents: "none",
    zIndex: 2,
  },
  dancerName: {
    fontSize: 9,
    fontWeight: 700,
    color: "#e2e8f0",
    marginBottom: 2,
    textShadow: "0 1px 2px rgba(0,0,0,0.85)",
    maxWidth: 56,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dancerCircle: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
    border: "2px solid rgba(0,0,0,0.15)",
  },
  formationBar: {
    flexShrink: 0,
    margin: "8px 10px 6px",
    padding: "8px 20px",
    borderRadius: 999,
    background: c.redMenu,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
  },
  formationBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "none",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  footer: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px 20px",
    gap: 12,
    background: c.pageBg,
    borderTop: `1px solid ${c.headerBorder}`,
  },
  footerSide: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 88,
  },
  footerPlay: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    border: "none",
    background: "#f4f4f5",
    color: "#0a0a0a",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
  },
};

const AXIS = Array.from({ length: 19 }, (_, i) => i - 9);

function IconBack() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function IconUndo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a4 4 0 1 1 0 8h-4" />
    </svg>
  );
}

function IconRedo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9a4 4 0 1 0 0 8h4" />
    </svg>
  );
}

function IconMusic() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IconCopyDoc() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function IconFullscreen() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

function IconCube3d() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l9 5v10l-9 5-9-5V8l9-5z" />
      <path d="M3 8l9 5 9-5M12 13v9" />
    </svg>
  );
}

function IconDuplicate() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 16V6a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function IconPersonPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 11h-4M20 9v4" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconSkipPrev() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h2v12H6V6zm11 0l-8 6 8 6V6z" />
    </svg>
  );
}

function IconSkipNext() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 6h2v12h-2V6zM6 6l8 6-8 6V6z" />
    </svg>
  );
}

function PlaceholderStage3D() {
  return (
    <>
      <color attach="background" args={["#1a2436"]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 6, 5]} intensity={0.85} />
      <mesh rotation={[0.45, 0.65, 0]} position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[1.35, 0.42, 0.95]} />
        <meshStandardMaterial color="#3d5a80" metalness={0.15} roughness={0.55} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.42, 0]} receiveShadow>
        <planeGeometry args={[5, 4]} />
        <meshStandardMaterial color="#152238" wireframe />
      </mesh>
    </>
  );
}

function WaveformBars() {
  const heights = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < 96; i += 1) {
      const wave = Math.sin(i * 0.21) * 0.35 + Math.sin(i * 0.07) * 0.45;
      const h = 18 + wave * 14 + ((i * 13) % 7);
      out.push(Math.max(10, Math.min(44, h)));
    }
    return out;
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        left: 32,
        right: 32,
        bottom: 6,
        top: 8,
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 1,
        opacity: 0.92,
        pointerEvents: "none",
      }}
    >
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            flex: "1 1 0",
            minWidth: 0,
            height: h,
            borderRadius: 2,
            background: i % 17 === 0 ? c.waveBarHi : c.waveBar,
          }}
        />
      ))}
    </div>
  );
}

type DancerSpec = {
  name: string;
  num: number;
  color: string;
  textColor?: string;
  leftPct: number;
  bottomPct: number;
};

const DANCERS: DancerSpec[] = [
  { name: "ツグミ", num: 8, color: "#22c55e", leftPct: 22, bottomPct: 28 },
  { name: "チナ", num: 7, color: "#ec4899", textColor: "#fff", leftPct: 38, bottomPct: 42 },
  { name: "リコ", num: 9, color: "#eab308", leftPct: 52, bottomPct: 30 },
  { name: "ケイスケ", num: 1, color: "#f8fafc", leftPct: 66, bottomPct: 38 },
  { name: "武", num: 10, color: "#ea580c", textColor: "#fff", leftPct: 78, bottomPct: 22 },
];

function TimelineSection({
  currentTimeLabel,
  playheadPct,
}: {
  currentTimeLabel: string;
  playheadPct: number;
}) {
  return (
    <div style={styles.timelineWrap}>
      <div style={styles.timelineBar} className="mobile-formation-editor-timeline">
        <button type="button" style={{ ...styles.timelineSkip, left: 0 }} aria-label="前へ">
          <IconSkipPrev />
        </button>
        <button
          type="button"
          style={{ ...styles.timelineSkip, ...styles.timelineSkipRight }}
          aria-label="次へ"
        >
          <IconSkipNext />
        </button>
        <WaveformBars />
        {/* 波形上の選択区間（イメージ） */}
        <div
          style={{
            position: "absolute",
            left: "28%",
            width: "24%",
            top: 6,
            bottom: 6,
            borderRadius: 8,
            border: "2px solid #ef4444",
            boxShadow: "inset 0 0 0 1px rgba(239,68,68,0.25)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
        <div style={{ ...styles.playhead, left: `${playheadPct}%` }} />
        <div style={styles.timeBadge}>{currentTimeLabel}</div>
      </div>
    </div>
  );
}

function Stage3DCanvas() {
  return (
    <div style={styles.canvasHost}>
      <Canvas
        camera={{ position: [2.2, 1.9, 2.6], fov: 42 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <PlaceholderStage3D />
        </Suspense>
      </Canvas>
    </div>
  );
}

export type MobileFormationEditorLayoutProps = {
  /** 例: "0:40" */
  currentTimeLabel?: string;
  /** 再生ヘッド位置 0〜100 */
  playheadPct?: number;
  className?: string;
};

/**
 * 添付デザインをベースに、タイムラインをヘッダー直下へ移したモバイル向けレイアウト。
 * Three.js（react-three-fiber）はステージ内のプレースホルダーのみ。
 */
export function MobileFormationEditorLayout({
  currentTimeLabel = "0:40",
  playheadPct = 42,
  className,
}: MobileFormationEditorLayoutProps) {
  return (
    <div className={`mobile-formation-editor-root${className ? ` ${className}` : ""}`} style={styles.root}>
      {/* 1. ヘッダー */}
      <header style={styles.header}>
        <button type="button" style={styles.headerBtn} aria-label="戻る">
          <IconBack />
        </button>
        <div style={styles.headerRight}>
          <button type="button" style={styles.headerBtn} aria-label="元に戻す">
            <IconUndo />
          </button>
          <button type="button" style={styles.headerBtn} aria-label="やり直す">
            <IconRedo />
          </button>
          <button type="button" style={styles.headerBtn} aria-label="音楽">
            <IconMusic />
          </button>
          <button type="button" style={styles.headerBtn} aria-label="レイヤー">
            <IconLayers />
          </button>
          <button type="button" style={styles.headerBtn} aria-label="設定">
            <IconGear />
          </button>
        </div>
      </header>

      {/* 2. タイムライン（ヘッダー直下） */}
      <TimelineSection currentTimeLabel={currentTimeLabel} playheadPct={playheadPct} />

      {/* 3. ステージ（R3F + 2Dオーバーレイ） */}
      <div style={styles.stageColumn}>
        <div style={styles.stageLabel}>舞台裏</div>
        <div style={styles.stageRow}>
          <div style={styles.sideline} aria-hidden>
            {[2, 3, 4].map((n) => (
              <div key={n} style={styles.sidelineDot}>
                {n}
              </div>
            ))}
          </div>
          <div style={styles.stageMain}>
            <div style={styles.stageFrame}>
              <Stage3DCanvas />
              <div style={styles.stageOverlay} />
              {DANCERS.map((d) => (
                <div
                  key={d.name}
                  style={{
                    ...styles.dancerWrap,
                    left: `${d.leftPct}%`,
                    bottom: `${d.bottomPct}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  <span style={styles.dancerName}>{d.name}</span>
                  <div
                    style={{
                      ...styles.dancerCircle,
                      background: d.color,
                      color: d.textColor ?? "#0f172a",
                    }}
                  >
                    {d.num}
                  </div>
                </div>
              ))}
            </div>
            <div style={styles.stageLabel}>客席</div>
            <div style={styles.axisRow}>
              {AXIS.map((n) => (
                <span key={n} style={styles.axisTick}>
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. フォーメーション編集メニュー（フッターの上） */}
      <div style={styles.formationBar}>
        <button type="button" style={styles.formationBtn} aria-label="コピー">
          <IconCopyDoc />
        </button>
        <button type="button" style={styles.formationBtn} aria-label="削除">
          <IconTrash />
        </button>
        <button type="button" style={styles.formationBtn} aria-label="編集">
          <IconPencil />
        </button>
      </div>

      {/* 4. フッター */}
      <footer style={styles.footer}>
        <div style={{ ...styles.footerSide, justifyContent: "flex-start" }}>
          <button type="button" style={styles.headerBtn} aria-label="全画面">
            <IconFullscreen />
          </button>
          <button type="button" style={styles.headerBtn} aria-label="3D表示">
            <IconCube3d />
          </button>
        </div>
        <button type="button" style={styles.footerPlay} aria-label="再生">
          <IconPlay />
        </button>
        <div style={{ ...styles.footerSide, justifyContent: "flex-end" }}>
          <button type="button" style={styles.headerBtn} aria-label="コピー">
            <IconDuplicate />
          </button>
          <button type="button" style={styles.headerBtn} aria-label="メンバー追加">
            <IconPersonPlus />
          </button>
        </div>
      </footer>
    </div>
  );
}
