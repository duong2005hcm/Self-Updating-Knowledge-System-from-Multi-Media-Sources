import { useId, useState } from "react";
import { askRAG } from "../api/ragapi";

export default function ChatInput({ setMessages }) {
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
      { id: pendingId, role: "assistant", content: "Đang trả lời…", pending: true },
    ]);

    setLoading(true);

    try {
      const res = await askRAG(question);
      const answer = res?.answer || "Không có câu trả lời";

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId ? { ...m, content: answer, pending: false } : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, content: "Lỗi gọi RAG backend", pending: false, error: true }
            : m
        )
      );
    } finally {
      setLoading(false);
      setText("");
    }
  };

  return (
    <div className="chat-input-inner">
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
      <button onClick={handleSend} disabled={loading}>
        {loading ? "..." : "➤"}
      </button>
    </div>
  );
}
