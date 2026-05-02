import { MessageSquareText, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getArticleFeedbacks,
  getMyArticleFeedback,
  upsertArticleFeedback,
} from "../../api/articleFeedbackApi";
import { formatDateTime } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";
import StarRating from "./StarRating";

function getFriendlyError(error) {
  const message = error?.message || "";
  const code = error?.code || "";
  if (message.includes("Firestore feedback")) return message;
  if (code === "permission-denied" || message.toLowerCase().includes("permission")) {
    return "Không thể lưu phản hồi. Vui lòng kiểm tra quyền Firestore.";
  }
  return message || "Không thể tải hoặc lưu phản hồi.";
}

function getInitial(name = "") {
  return String(name || "U").trim().slice(0, 1).toUpperCase() || "U";
}

export default function ArticleFeedback({ articleId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading: authLoading } = useAuth();
  const [feedbacks, setFeedbacks] = useState([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [hasMyFeedback, setHasMyFeedback] = useState(false);

  const stats = useMemo(() => {
    const activeItems = feedbacks.filter((item) => item.status !== "deleted");
    const ratingItems = activeItems.filter((item) => typeof item.rating === "number");
    const ratingSum = ratingItems.reduce((sum, item) => sum + Number(item.rating || 0), 0);
    const ratingCount = ratingItems.length;
    return {
      ratingAvg: ratingCount ? ratingSum / ratingCount : 0,
      ratingCount,
      feedbackCount: activeItems.length,
      recentFeedbacks: activeItems.slice(0, 5),
    };
  }, [feedbacks]);

  const loadFeedback = async () => {
    if (!articleId) return;
    setIsLoading(true);
    setError("");
    try {
      const items = await getArticleFeedbacks(articleId);
      setFeedbacks(items);

      if (user?.uid) {
        const myFeedback = await getMyArticleFeedback(articleId, user.uid);
        setHasMyFeedback(Boolean(myFeedback));
        setRating(Number(myFeedback?.rating || 0));
        setComment(myFeedback?.comment || "");
      } else {
        setHasMyFeedback(false);
        setRating(0);
        setComment("");
      }
    } catch (nextError) {
      setError(getFriendlyError(nextError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, [articleId, user?.uid]);

  if (!articleId) return null;

  const openLogin = () => {
    navigate("/login", { state: { from: location } });
  };

  const submitFeedback = async () => {
    if (!user) {
      openLogin();
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await upsertArticleFeedback(
        articleId,
        {
          ...user,
          displayName: user.displayName || profile?.displayName || user.email,
        },
        {
          rating,
          comment,
        }
      );
      setSuccess(hasMyFeedback ? "Đã cập nhật phản hồi." : "Đã gửi phản hồi.");
      await loadFeedback();
    } catch (nextError) {
      setError(getFriendlyError(nextError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/70 bg-white p-6 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-brand-700">
            Đánh giá & phản hồi
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="font-display text-3xl font-bold text-ink">
              {stats.ratingCount ? stats.ratingAvg.toFixed(1) : "0.0"}/5
            </span>
            <span className="pb-1 text-xs font-semibold text-slate-500">
              {stats.ratingCount} lượt đánh giá
            </span>
          </div>
        </div>
        <MessageSquareText className="h-5 w-5 text-brand-600" />
      </div>

      <div className="mt-4">
        <StarRating value={stats.ratingAvg} readonly />
        <div className="mt-1 text-xs text-slate-500">
          {stats.feedbackCount} phản hồi công khai
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        {user ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-700">
                {hasMyFeedback ? "Phản hồi của bạn" : "Chọn đánh giá của bạn"}
              </span>
              <StarRating value={rating} onChange={setRating} />
            </div>
            <textarea
              className="input-base mt-4 min-h-[120px] resize-y"
              maxLength={1000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Chia sẻ cảm nhận hoặc góp ý của bạn về bài viết này…"
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Phản hồi dùng để cải thiện chất lượng nội dung, không phải tư vấn y tế.</span>
              <span>{comment.length}/1000</span>
            </div>
            <button
              type="button"
              className="btn-primary mt-4 w-full"
              disabled={isSubmitting || authLoading}
              onClick={submitFeedback}
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? "Đang gửi..." : hasMyFeedback ? "Cập nhật phản hồi" : "Gửi phản hồi"}
            </button>
          </>
        ) : (
          <div className="text-center">
            <p className="text-sm leading-6 text-slate-500">
              Đăng nhập để đánh giá và để lại phản hồi cho bài viết này.
            </p>
            <button type="button" className="btn-primary mt-4" onClick={openLogin}>
              Đăng nhập để phản hồi
            </button>
          </div>
        )}
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="text-sm font-bold text-ink">Bình luận gần đây</div>
        {isLoading ? (
          <div className="mt-4 text-sm text-slate-500">Đang tải phản hồi...</div>
        ) : stats.recentFeedbacks.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
            Chưa có phản hồi nào. Hãy là người đầu tiên đánh giá bài viết.
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {stats.recentFeedbacks.map((item) => {
              const name = item.user_name || item.user_email || "Người dùng";
              return (
                <article key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                      {getInitial(name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold text-ink">{name}</div>
                        <div className="text-xs text-slate-500">
                          {formatDateTime(item.updated_at || item.created_at)}
                        </div>
                      </div>
                      <div className="mt-1">
                        <StarRating value={Number(item.rating || 0)} readonly size="sm" />
                      </div>
                      {item.comment ? (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {item.comment}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
