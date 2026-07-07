import { Component, Fragment, type ReactNode, type ErrorInfo, useState, useEffect, useCallback } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { AuthProvider } from "./context/AuthContext";
import { DashboardPage } from "./pages/DashboardPage";
import { EditorPage } from "./pages/EditorPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VideoPage } from "./pages/VideoPage";
import { BillingCanceledPage, BillingSuccessPage } from "./pages/BillingPages";
import { MobileFormationEditorDemoPage } from "./pages/MobileFormationEditorDemoPage";
import { MobileShell } from "./components/mobile/MobileShell";
import {
  shouldUseMobileEditorShell,
  subscribeWideEditorLayout,
} from "./pages/editor/editorViewport";
import { usePlaybackUiStore } from "./store/usePlaybackUiStore";
import { useMobileShellBridgeStore } from "./store/useMobileShellBridgeStore";
import { playbackEngine } from "./core/playbackEngine";
import {
  seekPlaybackClampedAndSyncStore,
  stopPlaybackAtTrimStart,
  togglePlaybackRespectingTrimStart,
} from "./lib/playbackTransport";

type EBState = { error: Error | null };

class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div
          style={{
            padding: "32px 24px",
            maxWidth: 640,
            margin: "0 auto",
            fontFamily: "system-ui, sans-serif",
            color: "#f1f5f9",
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 12, color: "#f87171" }}>
            表示エラーが発生しました
          </h2>
          <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
            ページを再読み込みしても解消しない場合は、下記のエラー内容をお知らせください。
          </p>
          <pre
            style={{
              fontSize: 11,
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
              padding: "12px 14px",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              color: "#fca5a5",
            }}
          >
            {error.message}
            {"\n\n"}
            {error.stack}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: "8px 20px",
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * モバイル幅 (≤768px) のとき MobileShell でラップし、
 * デスクトップではそのまま EditorPage を表示するルートコンポーネント。
 *
 * Zustand ストアのフィールド名対応:
 *   usePlaybackUiStore: currentTimeSec / isPlaying / durationSec
 *   useMobileShellBridgeStore: currentCueIndex / totalCues / audioUrl / activeTab / actions
 *   playbackEngine (singleton): play() / pause() / seek()
 */
function MobileEditorRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // EditorPage の mobileStack と同じ基準（短辺 < 768）。960px だと 1366×768 等の PC が MobileShell になる
  const checkMobile = () => shouldUseMobileEditorShell();
  const [isMobile, setIsMobile] = useState(checkMobile);
  useEffect(() => {
    const handler = () => {
      requestAnimationFrame(() => setIsMobile(checkMobile()));
    };
    const unsub = subscribeWideEditorLayout(handler);
    window.addEventListener("orientationchange", handler);
    return () => {
      unsub();
      window.removeEventListener("orientationchange", handler);
    };
  }, []);

  // 再生状態 (usePlaybackUiStore の実フィールド名に合わせる)
  const currentTimeSec = usePlaybackUiStore((s) => s.currentTimeSec);
  const isPlaying = usePlaybackUiStore((s) => s.isPlaying);
  const durationSec = usePlaybackUiStore((s) => s.durationSec);

  // audioUrl: playbackEngine から直接取得（BridgeStore の audioUrl は常に null のため）
  // onMetaChange で音源の差し替えを購読して最新の src を反映する
  const [audioUrl, setAudioUrl] = useState<string | null>(() => {
    const url = playbackEngine.getMediaSourceUrl();
    return url || null;
  });
  useEffect(() => {
    const syncUrl = () => {
      const url = playbackEngine.getMediaSourceUrl();
      setAudioUrl(url || null);
    };
    // 音源メタデータ変更（src 差し替え・duration 確定など）を購読
    const unsub = playbackEngine.onMetaChange(syncUrl);
    // マウント時にも一度同期
    syncUrl();
    return unsub;
  }, []);

  // キュー・アクション状態 (useMobileShellBridgeStore 経由)
  const currentCueIndex = useMobileShellBridgeStore((s) => s.currentCueIndex);
  const totalCues = useMobileShellBridgeStore((s) => s.totalCues);
  const activeTab = useMobileShellBridgeStore((s) => s.activeTab);
  const onCuePrev = useMobileShellBridgeStore((s) => s.onCuePrev);
  const onCueNext = useMobileShellBridgeStore((s) => s.onCueNext);
  const onAddCue = useMobileShellBridgeStore((s) => s.onAddCue);
  const onStageSettings = useMobileShellBridgeStore((s) => s.onStageSettings);
  const onTabChange = useMobileShellBridgeStore((s) => s.onTabChange);
  const trimStartSec = useMobileShellBridgeStore((s) => s.trimStartSec);
  const trimEndSec = useMobileShellBridgeStore((s) => s.trimEndSec);

  const onPlayPause = useCallback(() => {
    togglePlaybackRespectingTrimStart(trimStartSec);
  }, [trimStartSec]);

  const onStop = useCallback(() => {
    stopPlaybackAtTrimStart(trimStartSec);
  }, [trimStartSec]);

  const onSeek = useCallback(
    (sec: number) => {
      seekPlaybackClampedAndSyncStore({
        t: sec,
        durationSec,
        trimStartSec,
        trimEndSec,
        roundHeadForStore: true,
      });
    },
    [durationSec, trimStartSec, trimEndSec]
  );

  const onViewerList = useCallback(() => {
    if (projectId) navigate(`/view/${projectId}`);
  }, [projectId, navigate]);

  if (!isMobile) {
    return <EditorPage />;
  }

  return (
    <MobileShell
      audioUrl={audioUrl}
      isPlaying={isPlaying}
      currentTime={currentTimeSec}
      duration={durationSec}
      onPlayPause={onPlayPause}
      onStop={onStop}
      onSeek={onSeek}
      currentCueIndex={currentCueIndex}
      totalCues={totalCues}
      onCuePrev={onCuePrev}
      onCueNext={onCueNext}
      onAddCue={onAddCue}
      onStageSettings={onStageSettings}
      onViewerList={onViewerList}
      activeTab={activeTab}
      onTabChange={onTabChange}
    >
      <EditorPage />
    </MobileShell>
  );
}

function AppShell() {
  const location = useLocation();
  const hideFloatingLocale = location.pathname.startsWith("/view");

  return (
    <Fragment>
      {!hideFloatingLocale ? <LanguageSwitcher variant="floating" /> : null}
      <div className="app-shell">
        <AuthProvider>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/library" element={<Navigate to="/" replace />} />
            <Route path="/video" element={<VideoPage />} />
            <Route path="/billing/success" element={<BillingSuccessPage />} />
            <Route path="/billing/canceled" element={<BillingCanceledPage />} />
            <Route path="/editor/:projectId" element={<MobileEditorRoute />} />
            <Route
              path="/view/s/:shareToken"
              element={<EditorPage choreoPublicView />}
            />
            <Route
              path="/view/:projectId"
              element={<EditorPage choreoPublicView />}
            />
            <Route
              path="/demo/mobile-formation-editor"
              element={<MobileFormationEditorDemoPage />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </div>
    </Fragment>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AppErrorBoundary>
  );
}
