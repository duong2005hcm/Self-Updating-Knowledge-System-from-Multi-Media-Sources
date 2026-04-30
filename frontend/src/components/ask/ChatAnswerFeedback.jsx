import { MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createChatFeedback } from "../../api/chatFeedbackApi";
import { useAuth } from "../../providers/AuthProvider";

export default function ChatAnswerFeedback({
  question,
  answer,
  conversationId,
  contextsCount = 0,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [helpful, setHelpful] = useState(null);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = String(question || "").trim() && String(answer || "").trim();

  const openLogin = () => {
    navigate("/login", { state: { from: location } });
  };

  const submitFeedback = async (nextHelpful = helpful, nextComment = comment) => {
    if (!user) {
      openLogin();
      return;
    }

    if (typeof nextHelpful !== "boolean") {
      setError("Vui lòng chọn hữu ích hoặc chưa hữu ích.");
      return;
    }

    if (!canSubmit || submitted || busy) return;

    setBusy(true);
    setError("");
    try {
      await createChatFeedback(
        {
          question,
          answer,
          helpful: nextHelpful,
          comment: nextComment,
          conversation_id: conversationId,
          contexts_count: contextsCount,
        },
        {
          ...user,
          displayName: user.displayName || profile?.displayName || user.email,
        }
      );
      setHelpful(nextHelpful);
      setSubmitted(true);
      setShowComment(false);
    } catch (nextError) {
      setError(nextError.message || "Không thể gửi feedback chatbox.");
    } finally {
      setBusy(false);
    }
  };

  if (!canSubmit) return null;

  return (
    <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
      {submitted ? (
        <div className="font-semibold text-emerald-700">Cảm ơn bạn đã phản hồi.</div>
      ) : (
        <>
          <div className="font-semibold text-slate-700">Câu trả lời này có hữu ích không?</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold transition ${
                helpful === true
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white hover:border-emerald-200 hover:text-emerald-700"
              }`}
              disabled={busy}
              onClick={() => submitFeedback(true, "")}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              Hữu ích
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold transition ${
                helpful === false
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-white hover:border-rose-200 hover:text-rose-700"
              }`}
              disabled={busy}
              onClick={() => submitFeedback(false, "")}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              Chưa hữu ích
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold transition hover:border-sky-200 hover:text-sky-700"
              disabled={busy}
              onClick={() => setShowComment((current) => !current)}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Góp ý thêm
            </button>
          </div>

          {showComment ? (
            <div className="mt-3 grid gap-2">
              <textarea
                className="input-base min-h-[84px] text-sm"
                maxLength={1000}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Bạn muốn góp ý gì để câu trả lời tốt hơn?"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">{comment.length}/1000</span>
                <button
                  type="button"
                  className="btn-secondary px-3 py-2 text-xs"
                  disabled={busy}
                  onClick={() => submitFeedback(helpful, comment)}
                >
                  {busy ? "Đang gửi..." : "Gửi góp ý"}
                </button>
              </div>
            </div>
          ) : null}

          {error ? <div className="mt-2 font-semibold text-rose-600">{error}</div> : null}
        </>
      )}
    </div>
  );
}
