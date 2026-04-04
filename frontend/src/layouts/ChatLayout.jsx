import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import ChatHeader from "../components/ChatHeader";
import ChatWelcome from "../components/ChatWelcome";
import ChatInput from "../components/ChatInput";
import IngestDoc from "../components/Ingest_doc";
import IngestWeb from "../components/Ingest_web";
import Taskbar from "../components/Taskbar";
import {
  computeTitle,
  lastPreview,
  loadConversations,
  newConversation,
  saveConversations,
} from "../chat/conversations";

export default function ChatLayout({ user, onLogout, onOpenAdmin }) {
  // --- Quản lý Trạng thái Hội thoại ---
  const [{ conversations, activeConversationId }, setChatState] = useState(() => {
    const loaded = loadConversations();
    const initialConversations = loaded?.conversations?.length
      ? loaded.conversations
      : [newConversation()];
    const initialActiveId =
      loaded?.activeId && initialConversations.some((c) => c.id === loaded.activeId)
        ? loaded.activeId
        : initialConversations[0]?.id ?? null;
    return { conversations: initialConversations, activeConversationId: initialActiveId };
  });

  // Quản lý Tab công cụ hiện tại (chat, ingest-doc, ingest-web)
  const [tool, setTool] = useState("chat");
  const bottomRef = useRef(null);

  // --- Logic tính toán Hội thoại đang hoạt động ---
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === activeConversationId) ?? conversations[0] ?? null;
  }, [conversations, activeConversationId]);

  const messages = useMemo(
    () => activeConversation?.messages ?? [],
    [activeConversation?.messages]
  );

  const hasMessages = messages.length > 0;

  const normalizedMessages = useMemo(
    () =>
      messages.map((m, i) => ({
        id: m.id ?? `${i}`,
        role: m.role,
        content: m.content,
        pending: Boolean(m.pending),
        error: Boolean(m.error),
      })),
    [messages]
  );

  // --- Effects ---
  // Lưu hội thoại vào LocalStorage mỗi khi có thay đổi
  useEffect(() => {
    saveConversations({ conversations, activeId: activeConversationId });
  }, [conversations, activeConversationId]);

  // Cuộn xuống đáy khi có tin nhắn mới (chỉ ở chế độ chat)
  useEffect(() => {
    if (tool !== "chat") return;
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [tool, normalizedMessages.length]);

  // --- Các hàm Handler ---
  const setActiveMessages = (updater) => {
    setChatState((prev) => {
      const idx = prev.conversations.findIndex((c) => c.id === prev.activeConversationId);
      if (idx < 0) return prev;
      const current = prev.conversations[idx];
      const nextMessages =
        typeof updater === "function" ? updater(current.messages ?? []) : updater;

      const nextConv = {
        ...current,
        messages: nextMessages,
        title: computeTitle(nextMessages),
        updatedAt: Date.now(),
      };

      const nextConversations = prev.conversations.slice();
      nextConversations[idx] = nextConv;
      return { ...prev, conversations: nextConversations };
    });
  };

  const handleNewChat = () => {
    const c = newConversation();
    setChatState((prev) => ({
      ...prev,
      conversations: [c, ...prev.conversations],
      activeConversationId: c.id,
    }));
    setTool("chat"); // Chuyển về tab chat khi tạo mới
  };

  return (
    <div className="app-root">
      {/* 1. SIDEBAR: Quản lý danh sách hội thoại */}
      <Sidebar
        user={user}
        conversations={conversations}
        activeConversationId={activeConversation?.id}
        onSelectConversation={(id) => {
          setChatState((prev) => ({ ...prev, activeConversationId: id }));
          setTool("chat");
        }}
        onNewChat={handleNewChat}
        onRenameConversation={(id, title) => {
          setChatState((prev) => ({
            ...prev,
            conversations: prev.conversations.map((c) =>
              c.id === id ? { ...c, title, updatedAt: Date.now() } : c
            ),
          }));
        }}
        onDeleteConversation={(id) => {
          setChatState((prev) => {
            const nextConversations = prev.conversations.filter((c) => c.id !== id);
            if (nextConversations.length === 0) {
              const fresh = newConversation();
              return { conversations: [fresh], activeConversationId: fresh.id };
            }
            const nextActiveId =
              prev.activeConversationId === id
                ? nextConversations[0].id
                : prev.activeConversationId;
            return { ...prev, conversations: nextConversations, activeConversationId: nextActiveId };
          });
        }}
        formatPreview={(c) => lastPreview(c.messages || [])}
      />

      {/* 2. MAIN AREA: Header + Body + Input */}
      <div className="main-area">
        {/* Taskbar chứa các nút Tab và nút Quản trị */}
        <Taskbar
          user={user}
          onLogout={onLogout}
          tool={tool}
          onSelectTool={setTool}
          onOpenAdmin={onOpenAdmin} // Truyền function mở trang Admin
        >
          <ChatHeader />
        </Taskbar>

        <div className="chat-body">
          {/* NỘI DUNG CHAT */}
          {tool === "chat" && (
            !hasMessages ? (
              <ChatWelcome />
            ) : (
              <div className="chat-thread" role="log" aria-label="Chat messages">
                {normalizedMessages.map((m) => (
                  <div key={m.id} className={`chat-row ${m.role}`}>
                    <div
                      className={[
                        "chat-bubble",
                        m.pending ? "is-pending" : "",
                        m.error ? "is-error" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )
          )}

          {/* CHẾ ĐỘ UPLOAD TÀI LIỆU */}
          {tool === "ingest-doc" && <IngestDoc />}

          {/* CHẾ ĐỘ NHẬP URL WEB */}
          {tool === "ingest-web" && <IngestWeb />}
        </div>

        {/* INPUT CHAT: Chỉ hiện khi ở tab chat */}
        {tool === "chat" && (
          <ChatInput setMessages={setActiveMessages} />
        )}
      </div>
    </div>
  );
}