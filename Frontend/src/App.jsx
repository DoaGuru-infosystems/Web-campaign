import React, { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CampaignsList from "./pages/CampaignsList";
import CampaignFormBuilder from "./pages/CampaignFormBuilder";
import CampaignDetails from "./pages/CampaignDetails";
import ParticipantSubmit from "./pages/ParticipantSubmit";
import RegistrationTracker from "./pages/RegistrationTracker";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

// ProtectedLayout now uses <Outlet> — mounts ONCE and stays alive across tab switches.
// Previously each route had its own <ProtectedLayout> causing full re-mount on every navigation.
const ProtectedLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <div className="flex h-screen bg-slate-50/60 overflow-hidden font-sans relative">
      {/* Decorative ambient gradient glowing blurs for Glassmorphism */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-200/40 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-200/30 blur-[120px] pointer-events-none z-0" />
      <div className="absolute top-[35%] right-[15%] w-[35%] h-[35%] rounded-full bg-purple-200/25 blur-[100px] pointer-events-none z-0" />

      {/* Mobile sidebar overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — stays mounted, handles open/close */}
      <Sidebar
        adminName={user?.email || "Administrator"}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden z-10">
        <Header onToggleSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto flex flex-col bg-transparent">
          {/* Outlet renders the active child route without re-mounting the layout */}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/campaign/:id" element={<ParticipantSubmit />} />
        <Route path="/track" element={<RegistrationTracker />} />

        {/* Single ProtectedLayout wraps all admin routes — layout mounts ONCE */}
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/campaigns" element={<CampaignsList />} />
          <Route path="/campaign/create" element={<CampaignFormBuilder />} />
          <Route path="/campaign/edit/:id" element={<CampaignFormBuilder />} />
          <Route path="/campaign/details/:id" element={<CampaignDetails />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
