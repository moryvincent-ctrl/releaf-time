import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ConsultantView from "./pages/ConsultantView";
import ConsultantDashboard from "./pages/ConsultantDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import StaffingView from "./pages/StaffingView";
import Missions from "./pages/Missions";
import MissionDetail from "./pages/MissionDetail";
import Settings from "./pages/Settings";
import MyAccount from "./pages/MyAccount";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route
              path="/consultant"
              element={
                <ProtectedRoute allowedRoles={["consultant", "manager", "admin"]}>
                  <ConsultantView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/consultant/dashboard"
              element={
                <ProtectedRoute allowedRoles={["consultant", "manager", "admin"]}>
                  <ConsultantDashboard />
                </ProtectedRoute>
              }
            />
            {/* Le manager utilise désormais le même tableau de bord que consultant/admin */}
            <Route path="/manager" element={<Navigate to="/consultant/dashboard" replace />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            {/* Le staffing est ouvert à tous les rôles : le consultant n'y voit
                que sa propre colonne (cf. StaffingView). L'ancienne URL /admin/staffing
                reste valide pour les liens et favoris existants. */}
            <Route
              path="/staffing"
              element={
                <ProtectedRoute allowedRoles={["consultant", "manager", "admin"]}>
                  <StaffingView />
                </ProtectedRoute>
              }
            />
            <Route path="/admin/staffing" element={<Navigate to="/staffing" replace />} />
            <Route
              path="/missions"
              element={
                <ProtectedRoute>
                  <Missions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/missions/:id"
              element={
                <ProtectedRoute>
                  <MissionDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <MyAccount />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
