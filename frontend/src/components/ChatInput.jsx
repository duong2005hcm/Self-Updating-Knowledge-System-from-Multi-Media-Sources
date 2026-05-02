import { useId, useState } from "react";
import { askRAG } from "../api/ragapi";

export default function ChatInput({ setMessages }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const rid = useId();

  const handleSend = async () => {
    const question = text.trim();
    if (!question || loading) return;

    const msgId = `${Date.now()}`;
    const pendingId = `${msgId}-pending`;

    // add user + pending assistant
    setMessages((prev) => [
      ...prev,
      { id: msgId, role: "user", content: question },
      {
        id: pendingId,
        role: "assistant",
        content: "Đang trả lời…",
        pending: true,
      },
    ]);

    setLoading(true);

    try {
      console.log("🚀 CALLING API /api/ask");

      const res = await askRAG(question);

      const answer = res?.answer || "Không có câu trả lời";
      const mode = res?.mode || "unknown";

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: `${answer}\n\n🧠 Mode: ${mode}`,
                pending: false,
              }
            : m
        )
      );
    } catch (err) {
      console.error("❌ API ERROR:", err);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: " Lỗi gọi RAG backend",
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
        disabled={loading}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !loading) {
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