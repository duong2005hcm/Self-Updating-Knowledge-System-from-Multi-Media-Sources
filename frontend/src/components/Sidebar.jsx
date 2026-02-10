export default function Sidebar({ onSelectTool }) {
  return (
    <aside className="sidebar">
      {/* ... giữ nguyên phần header */}

      <div className="sidebar-section">
        <button
          className="new-chat-btn"
          onClick={() => onSelectTool("chat")}
        >
          ＋ Chat mới
        </button>
      </div>

      <div className="sidebar-section">
        <p className="sidebar-title">LỊCH SỬ TRÒ CHUYỆN</p>
        <p className="sidebar-empty">Chưa có cuộc trò chuyện</p>
      </div>
      
      <div className="sidebar-section">
        <p className="sidebar-title">📄 TÀI LIỆU RAG</p>

        <button
          className="sidebar-action"
          onClick={() => onSelectTool("ingest-doc")}
        >
          Upload tài liệu (PDF/DOC)
        </button>

        <button
          className="sidebar-action"
          onClick={() => onSelectTool("ingest-web")}
        >
          Nhập URL trang web
        </button>
      </div>

      {/* ... giữ nguyên footer */}
    </aside>
  );
}
