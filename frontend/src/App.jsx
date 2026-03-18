import React, { useState } from "react";
import ChatLayout from "./layouts/ChatLayout";
import AuthPage from "./components/AuthPage";
import { clearSession, getSession, setSession } from "./auth/session";

export default function App() {
  const [user, setUser] = useState(() => getSession());

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
    <ChatLayout
      user={user}
      onLogout={() => {
        clearSession();
        setUser(null);
      }}
    />
  );
}
