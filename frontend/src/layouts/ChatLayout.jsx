import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import ChatHeader from "../components/ChatHeader";
import ChatWelcome from "../components/ChatWelcome";
import ChatInput from "../components/ChatInput";
import IngestDoc from "../components/Ingest_doc";
import IngestWeb from "../components/Ingest_web";

export default function ChatLayout() {
  const [messages, setMessages] = useState([]);
  const [tool, setTool] = useState("chat");

  return (
    <div className="app-root">
      {/* 🔑 Sidebar điều khiển tool */}
      <Sidebar onSelectTool={setTool} />

      <div className="main-area">
        <ChatHeader />

        <div className="chat-body">
          {/* ===== CHAT MODE ===== */}
          {tool === "chat" && (
            messages.length === 0 ? (
              <ChatWelcome />
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`chat-row ${m.role}`}>
                  <div className="chat-bubble">{m.content}</div>
                </div>
              ))
            )
          )}

          {/* ===== INGEST DOC MODE ===== */}
          {tool === "ingest-doc" && <IngestDoc />}

          {/* ===== INGEST WEB MODE ===== */}
          {tool === "ingest-web" && <IngestWeb />}
        </div>

        {/* ❗ Chỉ hiện input khi đang chat */}
        {tool === "chat" && (
          <ChatInput setMessages={setMessages} />
        )}
      </div>
    </div>
  );
}
