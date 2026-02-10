import { useState } from "react";
import { askRAG } from "../api/ragapi";

export default function ChatInput({ setMessages }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!text.trim()) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
    ]);

    setLoading(true);

    try {
      const res = await askRAG(text);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.answer || "Không có câu trả lời",
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Lỗi gọi RAG backend" },
      ]);
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
        placeholder="Gõ câu hỏi cho tớ nào..."
      />
      <button onClick={handleSend} disabled={loading}>
        {loading ? "..." : "➤"}
      </button>
    </div>
  );
}
