import { useState } from "react";
import { sendMessage } from "../api/ragapi";
import "../styles/styles.css";

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
      const data = await sendMessage(text);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Lỗi gọi API" },
      ]);
      console.error(err);
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
        placeholder="Gõ để trò chuyện..."
      />
      <button onClick={handleSend} disabled={loading}>
        {loading ? "..." : "➤"}
      </button>
    </div>
  );
}
