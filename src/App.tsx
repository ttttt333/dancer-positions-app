import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { DashboardPage } from "./pages/DashboardPage";
import { EditorPage } from "./pages/EditorPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { AdminMembershipPage } from "./pages/AdminMembershipPage";
import { ApproveMembershipPage } from "./pages/ApproveMembershipPage";
import { VideoPage } from "./pages/VideoPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/admin/membership" element={<AdminMembershipPage />} />
          <Route path="/approve-membership" element={<ApproveMembershipPage />} />
          <Route path="/video" element={<VideoPage />} />
          <Route path="/editor/:projectId" element={<EditorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
