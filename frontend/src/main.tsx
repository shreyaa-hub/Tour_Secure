// frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "leaflet/dist/leaflet.css";

import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";

// Providers
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider, useAuth } from "@/context/AuthContext";

// Route guards (single import, no duplicates)
import { RequireAuth, RequireAdmin } from "@/routes/guards";

// App shell
import AppLayout from "@/shell/AppLayout";

// Pages
import Home from "@/pages/Home";
import Heatmap from "@/pages/Heatmap";
import Reviews from "@/pages/Reviews";
import Itinerary from "@/pages/Itinerary";
import EFIR from "@/pages/EFIR";
import DigitalID from "@/pages/DigitalID";
import About from "@/pages/About";
import AuthPage from "@/pages/Auth";
import AdminDashboard from "@/pages/AdminDashboard";
import Verify from "@/pages/Verify";

// Gate the app until session hydration completes
function AuthReady({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-sm text-neutral-600">Loading…</div>
      </div>
    );
  }
  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      // Guest auth page
      { path: "/login", element: <AuthPage /> },

      // Public
      { index: true, element: <Home /> },
      { path: "/home", element: <Home /> },
      { path: "/heatmap", element: <Heatmap /> },
      { path: "/reviews", element: <Reviews /> },
      { path: "/about", element: <About /> },
      { path: "/verify/:token", element: <Verify /> },

      // Private (user)
      { path: "/itinerary", element: <RequireAuth><Itinerary /></RequireAuth> },
      { path: "/efir", element: <RequireAuth><EFIR /></RequireAuth> },
      { path: "/digital-id", element: <RequireAuth><DigitalID /></RequireAuth> },

      // Admin-only
      { path: "/admin", element: <RequireAdmin><AdminDashboard /></RequireAdmin> },

      // Fallback
      { path: "*", element: <Navigate to="/home" replace /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <AuthReady>
          <RouterProvider router={router} />
        </AuthReady>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);
