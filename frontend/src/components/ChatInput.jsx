import { useId, useState } from "react";
import { askAI, friendlyApiError, logQuestionAsked, logTokens } from "../api/ragapi";

export default function ChatInput({ setMessages, conversationId = "default" }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const rid = useId();

  const handleSend = async () => {
    const question = text.trim();
    if (!question) return;

    const userId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const pendingId = `${userId}-pending`;

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: question },
      {
        id: pendingId,
        role: "assistant",
        content: "AI đang suy nghĩ…",
        pending: true,
      },
    ]);

    setLoading(true);

    try {
      const res = await askAI(question, conversationId);
      const answer = res?.answer || "Không có câu trả lời";

      void logQuestionAsked();
      let tok = 0;
      const u = res?.usage;
      if (u && typeof u.total_tokens === "number") tok = u.total_tokens;
      else if (typeof res?.total_tokens === "number") tok = res.total_tokens;
      else tok = Math.ceil((question.length + (answer?.length || 0)) / 4);
      void logTokens(tok);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, content: answer, pending: false }
            : m
        )
      );
    } catch (err) {
      console.error("API ERROR:", err);
      const msg = friendlyApiError(err);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: msg,
                pending: false,
                error: true,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
      setText("");
    }
  };

  return (
    <div
      className="chat-input-inner"
      onSubmit={(e) => e.preventDefault()}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Gõ câu hỏi cho tớ nào..."
        aria-label="Chat message"
        id={`chat-input-${rid}`}
      />

      <button
        type="button"
        onClick={handleSend}
        disabled={loading}
      >
        {loading ? "..." : "➤"}
      </button>
    </div>
  );
}