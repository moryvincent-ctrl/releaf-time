import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LoginPage from "./pages/LoginPage";
import ConsultantView from "./pages/ConsultantView";
import ConsultantDashboard from "./pages/ConsultantDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Missions from "./pages/Missions";
import MissionDetail from "./pages/MissionDetail";
import Settings from "./pages/Settings";
import Forecast from "./pages/Forecast";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/consultant" element={<ConsultantView />} />
          <Route path="/consultant/dashboard" element={<ConsultantDashboard />} />
          <Route path="/manager" element={<ManagerDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/missions" element={<Missions />} />
          <Route path="/missions/:id" element={<MissionDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
