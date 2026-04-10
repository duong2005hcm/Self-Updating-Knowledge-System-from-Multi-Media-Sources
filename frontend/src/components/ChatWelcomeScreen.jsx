import React from "react";
import {
  IconSparkle,
  IconPenLine,
  IconImage,
  IconFileEdit,
  IconCode,
} from "./icons/Icons";

/**
 * ChatWelcomeScreen — Premium welcome screen with suggestion cards
 * Shows when there are no messages in the current conversation
 */
const SUGGESTIONS = [
  {
    icon: <IconPenLine size={24} color="#6366f1" />,
    title: "Viết bài",
    desc: "Soạn thảo bài viết, email, báo cáo chuyên nghiệp",
    prompt: "Hãy giúp tôi viết một bài viết chuyên nghiệp về",
  },
  {
    icon: <IconImage size={24} color="#8b5cf6" />,
    title: "Tạo ảnh",
    desc: "Mô tả hình ảnh bạn muốn, AI sẽ tạo cho bạn",
    prompt: "Tạo cho tôi một hình ảnh về",
  },
  {
    icon: <IconFileEdit size={24} color="#a855f7" />,
    title: "Nghiêm cứu sâu",
    desc: "Nghiêm cứu sâu về chủ đề bạn muốn",
    prompt: "Hãy giúp tôi nghiêm cứu sâu về chủ đề bạn muốn",
  },
  {
    icon: <IconCode size={24} color="#7c3aed" />,
    title: "Hỗ trợ tìm kiếm web",
    desc: "Tìm kiếm thông tin trên web",
    prompt: "Hãy để tôi giúp bạnbạn tìm kiếm thông tin trên web cho",
  },
];

export default function ChatWelcomeScreen({ onSuggestionClick }) {
  return (
    <div className="chat-welcome">
      <div className="chat-welcome__inner">
        {/* Logo */}
        <div className="chat-welcome__logo">
          <IconSparkle size={36} color="#ffffff" />
        </div>

        {/* Title */}
        <h1 className="chat-welcome__title">
          Welcome to SIMLESI AI
        </h1>
        <p className="chat-welcome__subtitle">
          Trợ lý AI thông minh, sẵn sàng hỗ trợ bạn mọi lúc mọi nơi.
          <br />
          Hãy bắt đầu bằng một câu hỏi hoặc chọn gợi ý bên dưới.
        </p>

        {/* Suggestion Cards */}
        <div className="chat-welcome__suggestions">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              className="chat-welcome__suggestion"
              onClick={() => onSuggestionClick?.(s.prompt)}
              id={`suggestion-${i}`}
            >
              <span className="chat-welcome__suggestion-icon">{s.icon}</span>
              <div className="chat-welcome__suggestion-content">
                <div className="chat-welcome__suggestion-title">{s.title}</div>
                <div className="chat-welcome__suggestion-desc">{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
