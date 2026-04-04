import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  PlusOutlined,
  MessageOutlined,
  UploadOutlined,
  GlobalOutlined,
  SafetyCertificateOutlined,
  PictureOutlined,
  SearchOutlined,
  DeleteOutlined,
  LogoutOutlined,
  StarFilled,
  MoreOutlined,
  PushpinOutlined,
  PushpinFilled,
  EditOutlined,
  InboxOutlined,
  CheckOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { Tooltip } from "antd";
import "./ChatSidebar.css";

/* ── Time grouping helpers ── */
function getDateGroup(timestampOrDate) {
  if (!timestampOrDate) return "previous";
  const d = new Date(timestampOrDate);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (itemDay >= today) return "today";
  if (itemDay >= yesterday) return "yesterday";
  return "previous";
}

function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

const GROUP_LABELS = {
  today: "Hôm nay",
  yesterday: "Hôm qua",
  previous: "Trước đó",
};

/**
 * ChatSidebar — Premium dark sidebar for SIMLESI AI
 * With grouped chat history, context menu, inline rename
 */
export default function ChatSidebar({
  user,
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onLogout,
  tool,
  onSelectTool,
  onOpenAdmin,
}) {
  const userName =
  user?.displayName ||
  user?.name ||
  user?.email?.split("@")[0] ||
  "Người dùng";

const userEmail = user?.email || "";

const userPhotoURL = user?.photoURL || null;

const userInitial =
  userName?.charAt(0)?.toUpperCase() || "U";

  /* ── Local state for history features ── */
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [pinnedIds, setPinnedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sb_pinned") || "[]");
    } catch { return []; }
  });
  const [archivedIds, setArchivedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sb_archived") || "[]");
    } catch { return []; }
  });

  const menuRef = useRef(null);
  const renameInputRef = useRef(null);

  // Persist pins & archives
  useEffect(() => {
    localStorage.setItem("sb_pinned", JSON.stringify(pinnedIds));
  }, [pinnedIds]);
  useEffect(() => {
    localStorage.setItem("sb_archived", JSON.stringify(archivedIds));
  }, [archivedIds]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  /* ── Group & sort conversations ── */
  const { pinned, grouped } = useMemo(() => {
    const visible = conversations.filter((c) => !archivedIds.includes(c.id));
    const pins = visible.filter((c) => pinnedIds.includes(c.id));
    const unpinned = visible.filter((c) => !pinnedIds.includes(c.id));

    const groups = { today: [], yesterday: [], previous: [] };
    unpinned.forEach((c) => {
      const g = getDateGroup(c.updatedAt || c.createdAt);
      groups[g].push(c);
    });

    return { pinned: pins, grouped: groups };
  }, [conversations, pinnedIds, archivedIds]);

  /* ── Handlers ── */
  const handlePin = (id) => {
    setPinnedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setMenuOpenId(null);
  };

  const handleStartRename = (c) => {
    setRenamingId(c.id);
    setRenameValue(c.title || "");
    setMenuOpenId(null);
  };

  const handleConfirmRename = (id) => {
    // In a real app, call onRenameConversation(id, renameValue)
    // For now, just close rename mode
    setRenamingId(null);
    setRenameValue("");
  };

  const handleCancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const handleArchive = (id) => {
    setArchivedIds((prev) => [...prev, id]);
    setMenuOpenId(null);
  };

  const handleDelete = (id) => {
    onDeleteConversation?.(id);
    setMenuOpenId(null);
  };

  /* ── Menu chính ── */
  const mainMenuItems = [
    { key: "chat",       icon: <MessageOutlined />,            label: "Chat AI" },
    { key: "ingest-doc", icon: <UploadOutlined />,             label: "Upload tài liệu" },
    { key: "ingest-web", icon: <GlobalOutlined />,             label: "Tìm kiếm web" },
  ];

  const advancedItems = [
    { key: "image-gen",     icon: <PictureOutlined />,  label: "Tạo ảnh AI" },
    { key: "deep-research", icon: <SearchOutlined />,   label: "Nghiên cứu sâu" },
  ];

  /* ── Render a single history item ── */
  const renderItem = (c, showPin = false) => {
    const isActive = c.id === activeConversationId;
    const isPinned = pinnedIds.includes(c.id);
    const isRenaming = renamingId === c.id;
    const isMenuOpen = menuOpenId === c.id;

    return (
      <div
        key={c.id}
        className={`sb-history-item ${isActive ? "is-active" : ""} ${isPinned ? "is-pinned" : ""}`}
        onClick={() => {
          if (!isRenaming) {
            onSelectConversation?.(c.id);
            onSelectTool?.("chat");
          }
        }}
      >
        <MessageOutlined className="sb-history-icon" />

        {/* Title or Rename Input */}
        {isRenaming ? (
          <div className="sb-rename-wrap" onClick={(e) => e.stopPropagation()}>
            <input
              ref={renameInputRef}
              className="sb-rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmRename(c.id);
                if (e.key === "Escape") handleCancelRename();
              }}
            />
            <button className="sb-rename-ok" onClick={() => handleConfirmRename(c.id)}>
              <CheckOutlined />
            </button>
            <button className="sb-rename-cancel" onClick={handleCancelRename}>
              <CloseOutlined />
            </button>
          </div>
        ) : (
          <span className="sb-history-title">{c.title || "Chat mới"}</span>
        )}

        {/* Pin badge */}
        {isPinned && !isRenaming && (
          <PushpinFilled className="sb-pin-badge" />
        )}

        {/* "..." Menu button */}
        {!isRenaming && (
          <div className="sb-history-more-wrap" ref={isMenuOpen ? menuRef : null}>
            <button
              className={`sb-history-more ${isMenuOpen ? "is-visible" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(isMenuOpen ? null : c.id);
              }}
              aria-label="Tuỳ chọn"
            >
              <MoreOutlined />
            </button>

            {/* Context Menu */}
            {isMenuOpen && (
              <div className="sb-ctx-menu" onClick={(e) => e.stopPropagation()}>
                <button className="sb-ctx-item" onClick={() => handlePin(c.id)}>
                  {isPinned ? <PushpinFilled className="sb-ctx-icon" /> : <PushpinOutlined className="sb-ctx-icon" />}
                  <span>{isPinned ? "Bỏ ghim" : "Ghim"}</span>
                </button>
                <button className="sb-ctx-item" onClick={() => handleStartRename(c)}>
                  <EditOutlined className="sb-ctx-icon" />
                  <span>Đổi tên</span>
                </button>
                <button className="sb-ctx-item" onClick={() => handleArchive(c.id)}>
                  <InboxOutlined className="sb-ctx-icon" />
                  <span>Lưu trữ</span>
                </button>
                <div className="sb-ctx-divider" />
                <button className="sb-ctx-item sb-ctx-item--danger" onClick={() => handleDelete(c.id)}>
                  <DeleteOutlined className="sb-ctx-icon" />
                  <span>Xoá</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="sb" id="chat-sidebar">
      {/* ━━━ 1. TOP: Logo + New Chat ━━━ */}
      <div className="sb-header">
        <div className="sb-brand">
          <div className="sb-logo">
            <StarFilled style={{ fontSize: 18, color: "#fff" }} />
          </div>
          <div className="sb-brand-text">
            <span className="sb-brand-name">SIMLESI AI</span>
            <span className="sb-brand-sub">Trợ lý thông minh</span>
          </div>
        </div>

        <button className="sb-new-chat" onClick={onNewChat} id="new-chat-btn">
          <PlusOutlined style={{ fontSize: 14 }} />
          <span>Chat mới</span>
        </button>
      </div>

      {/* ━━━ SCROLLABLE AREA ━━━ */}
      <div className="sb-scroll">

        {/* ━━━ 2. MENU CHÍNH ━━━ */}
        <div className="sb-section">
          <div className="sb-label">CÔNG CỤ</div>
          <nav className="sb-menu">
            {mainMenuItems.map((item) => (
              <button
                key={item.key}
                className={`sb-menu-item ${tool === item.key ? "is-active" : ""}`}
                onClick={() => onSelectTool?.(item.key)}
              >
                <span className="sb-menu-icon">{item.icon}</span>
                <span className="sb-menu-text">{item.label}</span>
              </button>
            ))}
            {user?.role === "admin" && (
              <button className="sb-menu-item sb-menu-item--admin" onClick={onOpenAdmin}>
                <span className="sb-menu-icon"><SafetyCertificateOutlined /></span>
                <span className="sb-menu-text">Quản trị</span>
              </button>
            )}
          </nav>
        </div>

        {/* ━━━ 3. NÂNG CAO ━━━ */}
        <div className="sb-section">
          <div className="sb-label">NÂNG CAO</div>
          <nav className="sb-menu">
            {advancedItems.map((item) => (
              <button
                key={item.key}
                className={`sb-menu-item ${tool === item.key ? "is-active" : ""}`}
                onClick={() => onSelectTool?.(item.key)}
              >
                <span className="sb-menu-icon">{item.icon}</span>
                <span className="sb-menu-text">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* ━━━ 4. LỊCH SỬ CHAT (Grouped) ━━━ */}
        <div className="sb-section sb-section--grow">
          <div className="sb-label">LỊCH SỬ</div>
          <div className="sb-history">
            {conversations.length === 0 ? (
              <div className="sb-empty">Chưa có cuộc trò chuyện</div>
            ) : (
              <>
                {/* Pinned */}
                {pinned.length > 0 && (
                  <div className="sb-group">
                    <div className="sb-group-label">
                      <PushpinFilled className="sb-group-label-icon" />
                      <span>Đã ghim</span>
                    </div>
                    {pinned.map((c) => renderItem(c, true))}
                  </div>
                )}

                {/* Today */}
                {grouped.today.length > 0 && (
                  <div className="sb-group">
                    <div className="sb-group-label">{GROUP_LABELS.today}</div>
                    {grouped.today.map((c) => renderItem(c))}
                  </div>
                )}

                {/* Yesterday */}
                {grouped.yesterday.length > 0 && (
                  <div className="sb-group">
                    <div className="sb-group-label">{GROUP_LABELS.yesterday}</div>
                    {grouped.yesterday.map((c) => renderItem(c))}
                  </div>
                )}

                {/* Previous */}
                {grouped.previous.length > 0 && (
                  <div className="sb-group">
                    <div className="sb-group-label">{GROUP_LABELS.previous}</div>
                    {grouped.previous.map((c) => renderItem(c))}
                  </div>
                )}

                {/* All archived — nothing shown */}
                {pinned.length === 0 &&
                  grouped.today.length === 0 &&
                  grouped.yesterday.length === 0 &&
                  grouped.previous.length === 0 && (
                    <div className="sb-empty">Tất cả đã được lưu trữ</div>
                  )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ━━━ 5. BOTTOM: User Profile ━━━ */}
      <div className="sb-footer">
        <div className="sb-user">
          <div className="sb-user-avatar">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" />
            ) : (
              <div className="sb-avatar-fallback">{userInitial}</div>
            )}
          </div>
          <div className="sb-user-info">
          <span className="sb-user-name">{userName}</span>
          <span className="sb-user-email">{userEmail}</span>
          </div>
          <Tooltip title="Đăng xuất" placement="right">
            <button className="sb-logout" onClick={onLogout} aria-label="Đăng xuất">
              <LogoutOutlined />
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
