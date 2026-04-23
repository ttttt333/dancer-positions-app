import { Fragment } from "react";
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

export default function App() {
  return (
    <BrowserRouter>
      <Fragment>
        <LanguageSwitcher variant="floating" />
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
            path="/demo/mobile-formation-editor"
            element={<MobileFormationEditorDemoPage />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </AuthProvider>
      </Fragment>
    </BrowserRouter>
  );
}
