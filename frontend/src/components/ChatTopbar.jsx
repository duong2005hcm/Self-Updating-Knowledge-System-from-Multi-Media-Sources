import React from "react";
import {
  IconMessageSquare,
  IconFileText,
  IconGlobe,
  IconShield,
} from "./icons/Icons";

/**
 * ChatTopbar — Minimal top bar with status, tabs, user badge
 */
function initials(nameOrEmail) {
  const s = String(nameOrEmail || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ChatTopbar({
  user,
  onLogout,
  tool,
  onSelectTool,
  onOpenAdmin,
}) {
  const badge = initials(user?.displayName || user?.name || user?.email);

  return (
    <div className="chat-topbar">
      {/* Left: Status + Tabs */}
      <div className="chat-topbar__left">
        <div className="chat-topbar__status">
          <div className="chat-topbar__dot" />
          <span className="chat-topbar__model">SIMLESI AI v2.0</span>
        </div>

        <div className="chat-topbar__divider" />

        <nav className="chat-topbar__tabs" aria-label="Tools">
          <button
            type="button"
            className={`chat-topbar__tab ${tool === "chat" ? "is-active" : ""}`}
            onClick={() => onSelectTool?.("chat")}
          >
            <IconMessageSquare size={15} style={{ marginRight: 6, verticalAlign: "text-bottom" }} />
            Chat
          </button>
          <button
            type="button"
            className={`chat-topbar__tab ${tool === "ingest-doc" ? "is-active" : ""}`}
            onClick={() => onSelectTool?.("ingest-doc")}
          >
            <IconFileText size={15} style={{ marginRight: 6, verticalAlign: "text-bottom" }} />
            Upload
          </button>
          <button
            type="button"
            className={`chat-topbar__tab ${tool === "ingest-web" ? "is-active" : ""}`}
            onClick={() => onSelectTool?.("ingest-web")}
          >
            <IconGlobe size={15} style={{ marginRight: 6, verticalAlign: "text-bottom" }} />
            URL
          </button>
          {user?.role === "admin" && (
            <button
              type="button"
              className="chat-topbar__tab chat-topbar__tab--admin"
              onClick={onOpenAdmin}
            >
              <IconShield size={15} color="#d97706" style={{ marginRight: 6, verticalAlign: "text-bottom" }} />
              Quản trị
            </button>
          )}
        </nav>
      </div>

      {/* Right: User + Logout */}
      <div className="chat-topbar__right">
        <div className="chat-topbar__user-badge">
          <div className="chat-topbar__user-badge-avatar">{badge}</div>
          <div className="chat-topbar__user-badge-info">
            <span className="chat-topbar__user-badge-name">
              {user?.displayName || user?.name || "User"}
            </span>
            <span className="chat-topbar__user-badge-email">
              {user?.email}
              {user?.role === "admin" && (
                <span style={{ color: "#d97706", marginLeft: 4, fontSize: 10 }}>
                  (Admin)
                </span>
              )}
            </span>
          </div>
        </div>
        <button className="chat-topbar__logout-btn" onClick={onLogout}>
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
