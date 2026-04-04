import React from "react";
import { IconBot } from "./icons/Icons";

/**
 * ChatMessage — Single message bubble with avatar
 * Handles user, assistant, pending, and error states
 */
export default function ChatMessage({ message, user }) {
  const { role, content, pending, error } = message;
  const isUser = role === "user";

  // Build bubble class name
  const bubbleClasses = [
    "chat-msg__bubble",
    pending ? "chat-msg__bubble--pending" : "",
    error ? "chat-msg__bubble--error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Avatar content
  const userInitial = user?.displayName?.charAt(0) || "U";

  return (
    <div
      className={`chat-msg-row ${isUser ? "chat-msg-row--user" : "chat-msg-row--ai"}`}
      role="row"
    >
      {/* Avatar */}
      <div className="chat-msg__avatar">
        {isUser ? (
          user?.photoURL ? (
            <img src={user.photoURL} alt="You" />
          ) : (
            userInitial
          )
        ) : (
          <IconBot size={20} color="currentColor" />
        )}
      </div>

      {/* Bubble */}
      <div className={bubbleClasses}>
        {content}
      </div>
    </div>
  );
}
