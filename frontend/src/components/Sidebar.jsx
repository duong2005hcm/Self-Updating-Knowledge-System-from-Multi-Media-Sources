import React from "react";
import Dialog from "./Dialog";

export default function Sidebar({
  onSelectTool,
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  formatPreview,
}) {
  const [dlg, setDlg] = React.useState(null);
  const [renameValue, setRenameValue] = React.useState("");

  const closeDlg = () => {
    setDlg(null);
    setRenameValue("");
  };

  const openRename = (c) => {
    setDlg({ type: "rename", id: c.id, title: c.title || "Chat mới" });
    setRenameValue(c.title || "Chat mới");
  };

  const openDelete = (c) => {
    setDlg({ type: "delete", id: c.id, title: c.title || "Chat mới" });
  };

  return (
    <aside className="sidebar">
      {/* ... giữ nguyên phần header */}

      <div className="sidebar-section">
        <button
          className="new-chat-btn"
          onClick={() => {
            onSelectTool?.("chat");
            onNewChat?.();
          }}
        >
          ＋ Chat mới
        </button>
      </div>

      <div className="sidebar-section">
        <p className="sidebar-title">LỊCH SỬ TRÒ CHUYỆN</p>
        {conversations.length === 0 ? (
          <p className="sidebar-empty">Chưa có cuộc trò chuyện</p>
        ) : (
          <div className="history-tiles" role="list" aria-label="Chat history">
            {conversations.map((c) => {
              const active = c.id === activeConversationId;
              const preview = formatPreview ? formatPreview(c) : "";
              return (
                <div
                  key={c.id}
                  className={`history-tile ${active ? "is-active" : ""}`}
                  role="listitem"
                  title={c.title}
                  onClick={() => {
                    onSelectTool?.("chat");
                    onSelectConversation?.(c.id);
                  }}
                >
                  <div className="history-tile-top">
                    <div className="history-tile-title">{c.title || "Chat mới"}</div>
                    <div className="history-tile-actions">
                      <button
                        type="button"
                        className="history-tile-action"
                        title="Đổi tên"
                        aria-label="Đổi tên cuộc trò chuyện"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRename(c);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="history-tile-action is-danger"
                        title="Xóa"
                        aria-label="Xóa cuộc trò chuyện"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDelete(c);
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  {preview ? (
                    <div className="history-tile-preview">{preview}</div>
                  ) : (
                    <div className="history-tile-preview is-muted">Chưa có tin nhắn</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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

      <Dialog
        open={Boolean(dlg)}
        title={dlg?.type === "delete" ? "Delete chat?" : "Đổi tên cuộc trò chuyện"}
        onClose={closeDlg}
        actions={
          <>
            <button type="button" className="dlg-btn" onClick={closeDlg}>
              Cancel
            </button>
            {dlg?.type === "delete" ? (
              <button
                type="button"
                className="dlg-btn is-danger"
                onClick={() => {
                  onDeleteConversation?.(dlg.id);
                  closeDlg();
                }}
              >
                Delete
              </button>
            ) : (
              <button
                type="button"
                className="dlg-btn is-primary"
                onClick={() => {
                  const trimmed = renameValue.trim();
                  if (trimmed) onRenameConversation?.(dlg.id, trimmed);
                  closeDlg();
                }}
              >
                Save
              </button>
            )}
          </>
        }
      >
        {dlg?.type === "delete" ? (
          <div className="dlg-text">
            This will delete <strong>{dlg.title}</strong>.
            <div className="dlg-sub">
              Bạn có thể tạo chat mới bất cứ lúc nào.
            </div>
          </div>
        ) : (
          <label className="dlg-field">
            <span>Tên cuộc trò chuyện</span>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
          </label>
        )}
      </Dialog>
    </aside>
  );
}
