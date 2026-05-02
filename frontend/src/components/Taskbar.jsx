import React, { useMemo } from "react";

function initials(nameOrEmail) {
  const s = String(nameOrEmail || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Taskbar({
  user,
  onLogout,
  onGoHome,
  tool,
  onSelectTool,
  children,
}) {
  const badge = useMemo(() => initials(user?.name || user?.email), [user]);

  return (
    <div className="taskbar">
      <div className="taskbar-left">
        <div className="taskbar-brand" title="RAG AI">
          <div className="taskbar-dot" aria-hidden="true" />
          <span className="taskbar-title">RAG AI</span>
        </div>
        <div className="taskbar-divider" aria-hidden="true" />
        <div className="taskbar-slot">{children}</div>

        <nav className="taskbar-tabs" aria-label="Tools">
          <button
            type="button"
            className={`taskbar-tab ${tool === "chat" ? "is-active" : ""}`}
            onClick={() => onSelectTool?.("chat")}
          >
            Chat
          </button>
          <button
            type="button"
            className={`taskbar-tab ${tool === "ingest-doc" ? "is-active" : ""}`}
            onClick={() => onSelectTool?.("ingest-doc")}
          >
            Upload tài liệu
          </button>
          <button
            type="button"
            className={`taskbar-tab ${tool === "ingest-web" ? "is-active" : ""}`}
            onClick={() => onSelectTool?.("ingest-web")}
          >
            Nhập URL
          </button>
        </nav>
      </div>

      <div className="taskbar-right">
        {onGoHome ? (
          <button className="taskbar-btn" onClick={onGoHome}>
            Trang chủ
          </button>
        ) : null}
        <div className="taskbar-user">
          <div className="taskbar-avatar" aria-hidden="true">
            {badge}
          </div>
          <div className="taskbar-usertext">
            <div className="taskbar-username">{user?.name || "User"}</div>
            <div className="taskbar-email">{user?.email}</div>
          </div>
        </div>
        <button className="taskbar-btn" onClick={onLogout}>
          Đăng xuất
        </button>
      </div>
    </div>
  );
}

