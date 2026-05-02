import { FileUp, MessageSquareText, SendHorizonal } from "lucide-react";
import { useState } from "react";
import { askKnowledge, uploadChatPdf } from "../api/askApi";
import ChatAnswerFeedback from "../components/ask/ChatAnswerFeedback";
import ContextSources from "../components/ask/ContextSources";
import EmptyState from "../components/common/EmptyState";
import { getOrCreateConversationId } from "../lib/storage";
import { useAuth } from "../providers/AuthProvider";

export default function AskPage() {
  const { profile, getToken } = useAuth();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [result, setResult] = useState(null);
  const [lastQuestion, setLastQuestion] = useState("");
  const conversationId = getOrCreateConversationId();

  const submit = async (event) => {
    event.preventDefault();
    const normalizedQuestion = String(question || "").trim();
    if (!normalizedQuestion || !profile) return;

    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      const response = await askKnowledge(
        {
          question: normalizedQuestion,
          userId: profile.uid || profile.email,
          conversationId,
        },
        token
      );
      setResult(response);
      setLastQuestion(normalizedQuestion);
    } catch (nextError) {
      setError(nextError.message || "Không thể gửi câu hỏi.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadBusy(true);
    setUploadMessage("");
    try {
      const token = await getToken();
      const response = await uploadChatPdf(file, conversationId, token);
      setUploadMessage(response.message || "PDF đã được lưu tạm cho conversation.");
    } catch (nextError) {
      setUploadMessage(nextError.message || "Không thể upload PDF.");
    } finally {
      setUploadBusy(false);
      event.target.value = "";
    }
  };

  return (
    <div className="page-shell py-10 pb-16">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-panel p-8">
          <div className="inline-flex rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            Ask AI
          </div>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-ink">
            Hỏi đáp trên kho tri thức sức khỏe
          </h1>
          <p className="mt-4 text-sm leading-8 text-slate-500">
            Trang fallback này vẫn gọi `POST /api/ask` với Firebase ID token thật. Backend chỉ trả
            lời khi truy xuất được context phù hợp từ kho tri thức.
          </p>

          <div className="mt-8 rounded-[24px] border border-slate-100 bg-slate-50 p-6">
            <div className="text-sm font-semibold text-slate-700">Conversation ID</div>
            <div className="mt-2 break-all text-sm text-slate-500">{conversationId}</div>
          </div>

          <div className="mt-6 rounded-[24px] border border-brand-100 bg-brand-50/60 p-6">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-700">
              <FileUp className="h-4 w-4" />
              Upload PDF tạm cho context chat
            </div>
            <p className="text-sm leading-7 text-slate-500">
              Nếu cần, bạn có thể upload một PDF tạm để backend lưu nội dung theo `conversation_id`
              hiện tại.
            </p>
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700">
              Chọn PDF
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleUpload}
                disabled={uploadBusy}
              />
            </label>
            {uploadMessage ? (
              <div className="mt-4 text-sm text-slate-600">{uploadMessage}</div>
            ) : null}
          </div>
        </div>

        <div className="glass-panel p-8">
          <form className="grid gap-4" onSubmit={submit}>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-slate-700">Câu hỏi</span>
              <textarea
                className="input-base min-h-[180px] resize-y"
                placeholder="Ví dụ: Hãy tóm tắt tài liệu về sốt xuất huyết và các điểm cần lưu ý khi đọc nguồn."
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
            </label>
            {error ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
            <button type="submit" className="btn-primary" disabled={busy}>
              <SendHorizonal className="h-4 w-4" />
              {busy ? "Đang hỏi..." : "Gửi câu hỏi"}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-100 pt-8">
            {!result ? (
              <EmptyState
                title="Chưa có câu trả lời"
                message="Gửi câu hỏi để nhận câu trả lời và các nguồn tham khảo đã được truy xuất."
              />
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-brand-700">
                    <MessageSquareText className="h-4 w-4" />
                    {result.mode}
                  </div>
                  <div className="mt-4 rounded-[24px] border border-slate-100 bg-slate-50 p-6 text-sm leading-8 text-slate-700">
                    {result.answer}
                  </div>
                  <div className="mt-3">
                    <ChatAnswerFeedback
                      question={lastQuestion}
                      answer={result.answer}
                      conversationId={conversationId}
                      contextsCount={(result.contexts || []).length}
                    />
                  </div>
                </div>

                <div>
                  <div className="font-display text-xl font-semibold text-ink">
                    Nguồn tham khảo
                  </div>
                  {(result.contexts || []).length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-800">
                      Kho tri thức chưa có đủ dữ liệu phù hợp cho câu hỏi này, nên hệ thống không
                      hiển thị nguồn tham khảo.
                    </div>
                  ) : (
                    <div className="mt-4">
                      <ContextSources contexts={result.contexts || []} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
