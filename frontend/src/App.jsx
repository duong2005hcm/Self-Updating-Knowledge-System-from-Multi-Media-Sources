import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import ChatPage from "./layouts/ChatPage";
import AuthPage from "./components/AuthPage";
import AdminDashboard from "./components/AdminDashboard";
import { clearSession, getSession, setSession } from "./auth/session";

/**
 * Dashboard tại "/" (ChatPage + sidebar/công cụ).
 * Admin tại "/admin" (chỉ role admin).
 */
function AppRoutes() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ragai_user"));
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const u = getSession();
    if (u) setUser(u);
  }, []);

  if (!user) {
    return (
      <AuthPage
        onAuthed={(u) => {
          setSession(u);
          setUser(u);
        }}
      />
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <ChatPage
            user={user}
            onLogout={() => {
              clearSession();
              setUser(null);
            }}
            onOpenAdmin={() => navigate("/admin")}
          />
        }
      />
      <Route
        path="/admin"
        element={
          user.role === "admin" ? (
            <AdminDashboard
              user={user}
              onExit={() => {
                try {
                  const updatedUser = JSON.parse(localStorage.getItem("ragai_user"));
                  if (updatedUser) setUser(updatedUser);
                } catch {
                  /* ignore */
                }
                navigate("/");
              }}
            />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
