import React from "react";

export default function ChatInput() {
  return (
    <div className="chat-input-root">
      <div className="chat-input-inner">
        <textarea placeholder="Gõ để trò chuyện..." rows={1} />
        <button className="send-circle" title="Gửi">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22l-4-9-9-4L22 2z" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
