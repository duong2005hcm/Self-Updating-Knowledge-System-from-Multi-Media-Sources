import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import ChatPage from "./layouts/ChatPage";
import AuthPage from "./components/AuthPage";
import LandingPage from "./components/LandingPage";
import AdminDashboard from "./components/AdminDashboard";
import { signOut } from "firebase/auth";
import { auth } from "./auth/firebase";
import { clearSession, getStoredUser, setSession } from "./auth/session";

/**
 * Dashboard tại "/" (ChatPage + sidebar/công cụ).
 * Admin tại "/admin" (chỉ role admin).
 */
function AppRoutes() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <AuthPage
              key="route-login"
              initialMode="login"
              onAuthed={(u) => {
                setSession(u);
                setUser(u);
              }}
            />
          }
        />
        <Route
          path="/register"
          element={
            <AuthPage
              key="route-register"
              initialMode="register"
              onAuthed={(u) => {
                setSession(u);
                setUser(u);
              }}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
              signOut(auth).catch(() => {});
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
