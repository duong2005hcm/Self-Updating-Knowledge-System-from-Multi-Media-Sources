/* eslint-disable no-unused-vars */
import React, { useState } from "react";

export default function Sidebar({
  onSelectTool,
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  user,
  onLogout,
  onNewImageChat,           // ← Prop mới được thêm từ ChatLayout
}) {
  const [dlg, setDlg] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  // Xử lý khi click "Tạo ảnh AI"
  const handleCreateImageClick = () => {
    if (onNewImageChat) {
      onNewImageChat();                    // Ưu tiên tạo chat chuyên biệt về tạo ảnh
    } else {
      onSelectTool?.("image-gen");         // Fallback nếu chưa có hàm
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          <img src="/smilesi_ai.png" alt="Logo" style={{ width: "32px", height: "32px" }} />
          <span className="brand-name">SIMLESI AI</span>
        </div>
      </div>

      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <button className="new-chat-btn" onClick={onNewChat}>
            ＋ Chat mới
          </button>
        </div>

        {/* CÔNG CỤ AI CHUYÊN SÂU */}
        <div className="sidebar-section">
          <p className="sidebar-title">⚡ CÔNG CỤ CHUYÊN SÂU</p>
          
          <button 
            className="sidebar-action" 
            onClick={handleCreateImageClick}     // ← Đã sửa ở đây
          >
            🎨 Tạo ảnh AI
          </button>

          <button 
            className="sidebar-action" 
            onClick={() => onSelectTool?.("deep-research")}
          >
            🔍 Nghiên cứu sâu
          </button>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-title">LỊCH SỬ TRÒ CHUYỆN</p>
          <div className="history-tiles">
            {conversations.length === 0 ? (
              <p className="sidebar-empty">Chưa có dữ liệu</p>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className={`history-tile ${c.id === activeConversationId ? "is-active" : ""}`}
                  onClick={() => onSelectConversation?.(c.id)}
                >
                  <span className="history-tile-title">{c.title || "Chat mới"}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer - User Info */}
      <div className="sidebar-footer">
        <div className="user-profile-card">
          <div className="user-avatar">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="AVT" />
            ) : (
              <div className="avatar-placeholder">{user?.displayName?.charAt(0) || "U"}</div>
            )}
          </div>
          <div className="user-info">
            <span className="user-name">{user?.displayName || "Người dùng"}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button className="logout-btn" onClick={onLogout} title="Đăng xuất">
            🚪
          </button>
        </div>
      </div>
    </aside>
  );
}