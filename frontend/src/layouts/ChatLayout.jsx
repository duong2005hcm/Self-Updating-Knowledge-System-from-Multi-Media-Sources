import React from "react";
import Sidebar from "../components/Sidebar";
import ChatHeader from "../components/ChatHeader";
import ChatWelcome from "../components/ChatWelcome";
import ChatInput from "../components/ChatInput";

export default function ChatLayout() {
  return (
    <div className="app-root">
      <Sidebar />
      <div className="main-area">
        <ChatHeader />
        <div className="chat-body">
          <ChatWelcome />
        </div>
        <ChatInput />
      </div>
    </div>
  );
}
