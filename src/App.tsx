import { Component, Fragment, type ReactNode, type ErrorInfo } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { AuthProvider } from "./context/AuthContext";
import { DashboardPage } from "./pages/DashboardPage";
import { EditorPage } from "./pages/EditorPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VideoPage } from "./pages/VideoPage";
import { BillingCanceledPage, BillingSuccessPage } from "./pages/BillingPages";
import { MobileFormationEditorDemoPage } from "./pages/MobileFormationEditorDemoPage";
import { LibraryPage } from "./pages/LibraryPage";

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

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <Fragment>
          {/** fixed 配置は viewport 基準にするため app-shell（overflow あり）の外に置く */}
          <LanguageSwitcher variant="floating" />
          <div className="app-shell">
            <AuthProvider>
              <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/video" element={<VideoPage />} />
            <Route path="/billing/success" element={<BillingSuccessPage />} />
            <Route path="/billing/canceled" element={<BillingCanceledPage />} />
            <Route path="/editor/:projectId" element={<EditorPage />} />
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
      </BrowserRouter>
    </AppErrorBoundary>
  );
}
