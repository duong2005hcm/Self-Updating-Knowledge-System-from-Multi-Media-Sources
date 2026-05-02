import { Maximize2, MessageSquareText, Minimize2, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { askKnowledge, uploadChatPdf } from "../../api/askApi";
import { createNewConversationId, getOrCreateConversationId } from "../../lib/storage";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import QuickPrompts from "./QuickPrompts";

const MIN_WIDTH = 360;
const DEFAULT_WIDTH = 420;
const MAX_WIDTH = 720;

function clampWidth(value) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
}

function createMessage(role, content, extra = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    ...extra,
  };
}

function getDocumentContextFromLocation(location) {
  const match = location.pathname.match(/^\/documents\/([^/]+)/);
  if (!match) return null;

  const params = new URLSearchParams(location.search);
  return {
    documentId: decodeURIComponent(match[1]),
    contextQuery: String(params.get("q") || "").trim(),
  };
}

export default function AskAiPanel({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, user, getToken } = useAuth();
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [conversationId, setConversationId] = useState(() => getOrCreateConversationId());
  const messagesEndRef = useRef(null);
  const documentContext = useMemo(
    () => getDocumentContextFromLocation(location),
    [location]
  );

  useEffect(() => {
    const syncViewport = () => setIsMobile(window.innerWidth < 768);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  const startResize = useCallback((event) => {
    if (isMobile || isExpanded) return;
    event.preventDefault();

    const handleMouseMove = (moveEvent) => {
      setPanelWidth(clampWidth(window.innerWidth - moveEvent.clientX));
    };
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [isExpanded, isMobile]);

  const submitQuestion = async (overrideQuestion) => {
    const normalizedQuestion = String(overrideQuestion || question || "").trim();
    if (!normalizedQuestion || busy || !profile) return;

    const pendingId = `pending-${Date.now()}`;
    setMessages((current) => [
      ...current,
      createMessage("user", normalizedQuestion),
      createMessage("assistant", "Đang truy xuất tri thức...", {
        id: pendingId,
        pending: true,
        question: normalizedQuestion,
        conversationId,
      }),
    ]);
    setQuestion("");
    setBusy(true);

    try {
      const token = await getToken();
      const response = await askKnowledge(
        {
          question: normalizedQuestion,
          userId: profile.uid || profile.email,
          conversationId,
          documentId: documentContext?.documentId,
          contextQuery: documentContext?.contextQuery,
        },
        token
      );

      setMessages((current) =>
        current.map((message) =>
          message.id === pendingId
            ? {
                ...message,
                content: response.answer || "Không có câu trả lời.",
                contexts: response.contexts || [],
                pending: false,
                mode: response.mode,
                question: normalizedQuestion,
                conversationId,
              }
            : message
        )
      );
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingId
            ? {
                ...message,
                content: error.message || "Không thể gọi Ask AI.",
                pending: false,
                error: true,
              }
            : message
        )
      );
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    setUploadBusy(true);
    try {
      const token = await getToken();
      await uploadChatPdf(file, conversationId, token);
      setMessages((current) => [
        ...current,
        createMessage("system", "Đã upload PDF vào context chat hiện tại."),
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        createMessage("system", error.message || "Không thể upload PDF vào context chat."),
      ]);
    } finally {
      setUploadBusy(false);
      event.target.value = "";
    }
  };

  const newChat = () => {
    const nextConversationId = createNewConversationId();
    setConversationId(nextConversationId);
    setMessages([]);
    setQuestion("");
  };

  const openLogin = () => {
    onClose?.();
    navigate("/login", { state: { from: location } });
  };

  if (!open) return null;

  const computedWidth = isMobile ? "100vw" : isExpanded ? "min(760px, 100vw)" : `${panelWidth}px`;

  return (
    <aside
      className="fixed right-0 top-0 z-[70] flex h-screen max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl"
      style={{ width: computedWidth }}
      aria-label="Ask AI panel"
    >
      {!isMobile && !isExpanded ? (
        <div
          className="absolute left-0 top-0 h-full w-1 cursor-col-resize transition hover:bg-sky-300"
          onMouseDown={startResize}
          role="separator"
          aria-orientation="vertical"
        />
      ) : null}

      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            <span className="rounded-2xl bg-brand-50 p-2 text-brand-700">
              <MessageSquareText className="h-5 w-5" />
            </span>
            Ask AI
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Hỏi đáp trên kho tri thức sức khỏe
          </div>
          <div className="mt-1 truncate text-[11px] text-slate-400">
            {conversationId}
          </div>
          {documentContext?.documentId ? (
            <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
              <span className="truncate">
                Context: document {documentContext.documentId}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {profile ? (
            <button type="button" className="btn-ghost px-3 py-2" onClick={newChat}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </button>
          ) : null}
          {!isMobile ? (
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:bg-slate-100"
              onClick={() => setIsExpanded((current) => !current)}
              aria-label={isExpanded ? "Thu nhỏ Ask AI" : "Mở rộng Ask AI"}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:bg-slate-100"
            onClick={onClose}
            aria-label="Đóng Ask AI"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {!profile ? (
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-slate-50 p-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-soft">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <MessageSquareText className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-display text-xl font-bold text-ink">
              Bạn cần đăng nhập để hỏi AI trên kho tri thức.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Ask AI dùng Firebase ID token thật để gọi backend `POST /api/ask`.
            </p>
            <button type="button" className="btn-primary mt-5" onClick={openLogin}>
              Đăng nhập
            </button>
          </div>
        </main>
      ) : (
        <>
          <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-5">
            {messages.length === 0 ? (
              <QuickPrompts onSelect={(prompt) => submitQuestion(prompt)} />
            ) : (
              <div className="grid gap-4">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </main>
          <ChatInput
            value={question}
            disabled={busy}
            sending={busy}
            uploadBusy={uploadBusy}
            onChange={setQuestion}
            onSend={() => submitQuestion()}
            onUpload={handleUpload}
            autoFocus={open}
          />
        </>
      )}
    </aside>
  );
}
