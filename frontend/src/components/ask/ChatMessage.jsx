import { Bot, UserRound } from "lucide-react";
import ChatAnswerFeedback from "./ChatAnswerFeedback";
import ContextSources from "./ContextSources";

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const hasContexts = (message.contexts || []).length > 0;

  if (isSystem) {
    return (
      <div className="mx-auto max-w-[92%] rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-center text-sm font-semibold text-sky-700">
        {message.content}
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser ? (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Bot className="h-4 w-4" />
        </div>
      ) : null}

      <div className={`max-w-[82%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
            isUser
              ? "bg-brand-600 text-white"
              : message.error
                ? "border border-rose-100 bg-rose-50 text-rose-700"
                : "border border-slate-100 bg-white text-slate-700"
          }`}
        >
          {message.pending ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-400" />
              {message.content}
            </span>
          ) : (
            <span className="whitespace-pre-wrap">{message.content}</span>
          )}
        </div>
        {!isUser ? (
          <>
            {!message.pending && !message.error && !hasContexts && message.mode !== "casual" ? (
              <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-medium leading-6 text-amber-800">
                Kho tri thức chưa có đủ dữ liệu phù hợp để trả lời chắc chắn câu hỏi này.
              </div>
            ) : null}
            <ContextSources contexts={message.contexts || []} />
            {!message.pending && !message.error ? (
              <ChatAnswerFeedback
                question={message.question}
                answer={message.content}
                conversationId={message.conversationId}
                contextsCount={(message.contexts || []).length}
              />
            ) : null}
          </>
        ) : null}
      </div>

      {isUser ? (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
          <UserRound className="h-4 w-4" />
        </div>
      ) : null}
    </div>
  );
}
