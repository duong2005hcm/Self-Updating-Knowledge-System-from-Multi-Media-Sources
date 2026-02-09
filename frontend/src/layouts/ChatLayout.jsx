import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import ChatHeader from "../components/ChatHeader";
import ChatWelcome from "../components/ChatWelcome";
import ChatInput from "../components/ChatInput";

export default function ChatLayout() {
  const [messages, setMessages] = useState([]);  
  return (
    <div className="app-root">
      <Sidebar />

      <div className="main-area">
        <ChatHeader />

        <div className="chat-body">
          {messages.length === 0 ? (
            <ChatWelcome />
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`chat-row ${m.role}`}>
                <div className="chat-bubble">{m.content}</div>
              </div>
            ))
          )}
        </div>

        <ChatInput setMessages={setMessages} />
      </div>
    </div>
  );
}
