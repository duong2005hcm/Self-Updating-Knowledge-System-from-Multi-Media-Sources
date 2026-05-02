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

export default function ChatLayout({ user, onLogout, onGoHome }) {
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
  const [tool, setTool] = useState("chat");
  const bottomRef = useRef(null);

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

  useEffect(() => {
    saveConversations({ conversations, activeId: activeConversationId });
  }, [conversations, activeConversationId]);

  useEffect(() => {
    if (tool !== "chat") return;
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [tool, normalizedMessages.length]);

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
  };

  return (
    <div className="app-root">
      {/* 🔑 Sidebar điều khiển tool */}
      <Sidebar
        onSelectTool={setTool}
        conversations={conversations}
        activeConversationId={activeConversation?.id}
        onSelectConversation={(id) =>
          setChatState((prev) => ({ ...prev, activeConversationId: id }))
        }
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

      <div className="main-area">
        <Taskbar
          user={user}
          onLogout={onLogout}
          onGoHome={onGoHome}
          tool={tool}
          onSelectTool={setTool}
        >
          <ChatHeader />
        </Taskbar>

        <div className="chat-body">
          {/* ===== CHAT MODE ===== */}
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

          {/* ===== INGEST DOC MODE ===== */}
          {tool === "ingest-doc" && <IngestDoc />}

          {/* ===== INGEST WEB MODE ===== */}
          {tool === "ingest-web" && <IngestWeb />}
        </div>

        {/* ❗ Chỉ hiện input khi đang chat */}
        {tool === "chat" && (
          <ChatInput setMessages={setActiveMessages} />
        )}
      </div>
    </div>
  );
}
