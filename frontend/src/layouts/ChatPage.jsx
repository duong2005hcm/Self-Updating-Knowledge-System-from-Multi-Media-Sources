import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

// Components
import ChatSidebar from "../components/ChatSidebar";
import ContextBar from "../components/ContextBar";
import ChatWelcomeScreen from "../components/ChatWelcomeScreen";
import ChatMessage from "../components/ChatMessage";
import ChatInputBar from "../components/ChatInputBar";
import IngestDoc from "../components/Ingest_doc";
import IngestWeb from "../components/Ingest_web";
import ImageGeneratorPage from "../components/ImageGeneratorPage";
import DeepResearchPage from "../components/DeepResearchPage";

// Utils
import {
  computeTitle,
  loadConversations,
  newConversation,
  saveConversations,
} from "../chat/conversations";

// Styles
import "../styles/chat-modern.css";

/**
 * ChatPage — Main chat layout (replaces old ChatLayout)
 * Combines sidebar + topbar + message area + input
 */
export default function ChatPage({ user, onLogout, onOpenAdmin }) {
  // ── Conversation State ──
  const [{ conversations, activeConversationId }, setChatState] = useState(() => {
    const loaded = loadConversations();
    const initialConversations = loaded?.conversations?.length
      ? loaded.conversations
      : [newConversation()];
    const initialActiveId =
      loaded?.activeId &&
      initialConversations.some((c) => c.id === loaded.activeId)
        ? loaded.activeId
        : initialConversations[0]?.id ?? null;
    return {
      conversations: initialConversations,
      activeConversationId: initialActiveId,
    };
  });

  const [tool, setTool] = useState("chat");
  const [suggestionText, setSuggestionText] = useState(null);
  const bottomRef = useRef(null);

  // ── Derived State ──
  const activeConversation = useMemo(
    () =>
      conversations.find((c) => c.id === activeConversationId) ??
      conversations[0] ??
      null,
    [conversations, activeConversationId]
  );

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

  // ── Persist Conversations ──
  useEffect(() => {
    saveConversations({ conversations, activeId: activeConversationId });
  }, [conversations, activeConversationId]);

  // ── Auto-scroll to bottom on new messages ──
  useEffect(() => {
    if (tool !== "chat") return;
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [tool, normalizedMessages.length]);

  // ── Handlers ──
  const setActiveMessages = useCallback((updater) => {
    setChatState((prev) => {
      const idx = prev.conversations.findIndex(
        (c) => c.id === prev.activeConversationId
      );
      if (idx < 0) return prev;
      const current = prev.conversations[idx];
      const nextMessages =
        typeof updater === "function"
          ? updater(current.messages ?? [])
          : updater;

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
  }, []);

  const handleNewChat = useCallback(() => {
    const c = newConversation();
    setChatState((prev) => ({
      ...prev,
      conversations: [c, ...prev.conversations],
      activeConversationId: c.id,
    }));
    setTool("chat");
    setSuggestionText(null);
  }, []);

  const handleSelectConversation = useCallback((id) => {
    setChatState((prev) => ({ ...prev, activeConversationId: id }));
    setTool("chat");
    setSuggestionText(null);
  }, []);

  const handleDeleteConversation = useCallback((id) => {
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
      return {
        ...prev,
        conversations: nextConversations,
        activeConversationId: nextActiveId,
      };
    });
  }, []);

  const handleSuggestionClick = useCallback((prompt) => {
    setSuggestionText(prompt);
  }, []);

  return (
    <div className="chat-app-root">
      {/* ═══ SIDEBAR ═══ */}
      <ChatSidebar
        user={user}
        conversations={conversations}
        activeConversationId={activeConversation?.id}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onLogout={onLogout}
        tool={tool}
        onSelectTool={setTool}
        onOpenAdmin={onOpenAdmin}
      />

      {/* ═══ MAIN AREA ═══ */}
      <div className="chat-main">
        {/* Context Bar */}
        <ContextBar
          tool={tool}
          status="ready"
          sources="hybrid"
          model="SIMLESI v2.0"
          latency={null}
          step={null}
        />

        {/* Content Area */}
        <div className="chat-body-area">
          {/* Chat Mode */}
          {tool === "chat" && (
            !hasMessages ? (
              <ChatWelcomeScreen onSuggestionClick={handleSuggestionClick} />
            ) : (
              <div className="chat-thread-area" role="log" aria-label="Chat messages">
                {normalizedMessages.map((m) => (
                  <ChatMessage key={m.id} message={m} user={user} />
                ))}
                <div ref={bottomRef} />
              </div>
            )
          )}

          {/* Ingest Doc Mode */}
          {tool === "ingest-doc" && <IngestDoc />}

          {/* Ingest Web Mode */}
          {tool === "ingest-web" && <IngestWeb />}

          {/* Image Generator Mode */}
          {tool === "image-gen" && <ImageGeneratorPage />}

          {/* Deep Research Mode */}
          {tool === "deep-research" && <DeepResearchPage />}
        </div>

        {/* Input Area (only in chat mode) */}
        {tool === "chat" && (
          <ChatInputBar
            setMessages={setActiveMessages}
            onSuggestion={suggestionText}
          />
        )}
      </div>
    </div>
  );
}
