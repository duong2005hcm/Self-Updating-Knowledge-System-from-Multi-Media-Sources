import React from "react";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand">
          <div className="logo">🐟</div>
          <div className="brand-name">SMILESI</div>
        </div>

        <button className="new-chat">+ Chat mới</button>

        <div className="history">
          <div className="history-title">LỊCH SỬ TRÒ CHUYỆN</div>
          <div className="history-empty">
            Không có cuộc trò chuyện nào
            <br />
            <span className="muted">Bắt đầu cuộc trò chuyện mới!</span>
          </div>
        </div>
      </div>

      <div className="sidebar-bottom">
        <div className="user-preview">
          <div className="avatar">🐟</div>
          <div className="user-info">
            <div className="user-name">admin</div>
            <div className="user-email">admin@example.com</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
