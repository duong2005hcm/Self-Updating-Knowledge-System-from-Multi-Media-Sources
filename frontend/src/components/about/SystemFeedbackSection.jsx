import { useEffect, useState } from "react";
import { getSystemFeedbacks } from "../../api/systemFeedbackApi";
import { formatDateTime } from "../../lib/utils";
import StarRating from "../blog/StarRating";
import EmptyState from "../common/EmptyState";
import SystemFeedbackForm from "./SystemFeedbackForm";
import SystemFeedbackStats from "./SystemFeedbackStats";

function getInitial(name = "") {
  return String(name || "U").trim().slice(0, 1).toUpperCase() || "U";
}

function FeedbackCard({ feedback }) {
  const name = feedback.user_name || feedback.user_email || "Người dùng";

  return (
    <article className="rounded-3xl border border-white/70 bg-white p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
          {getInitial(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="truncate text-sm font-bold text-ink">{name}</div>
            <div className="text-xs text-slate-500">
              {formatDateTime(feedback.updated_at || feedback.created_at)}
            </div>
          </div>
          <div className="mt-1">
            <StarRating value={Number(feedback.rating || 0)} readonly size="sm" />
          </div>
          {feedback.comment ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {feedback.comment}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function SystemFeedbackSection() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFeedbacks = async () => {
    setLoading(true);
    setError("");
    try {
      const items = await getSystemFeedbacks();
      setFeedbacks(items);
    } catch (nextError) {
      const message = nextError?.code === "permission-denied"
        ? "Không thể tải đánh giá. Vui lòng kiểm tra quyền Firestore."
        : nextError.message || "Không thể tải đánh giá hệ thống.";
      setError(message);
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedbacks();
  }, []);

  return (
    <section className="page-shell py-14">
      <div className="rounded-[32px] bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-6 shadow-soft sm:p-8 lg:p-10">
        <div className="max-w-3xl">
          <span className="section-kicker">Đánh giá hệ thống</span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Bạn cảm nhận thế nào về hệ thống?
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">
            Đánh giá của bạn giúp nhóm cải thiện trải nghiệm tra cứu, chất lượng nội dung và khả năng hỗ trợ Ask AI.
          </p>
        </div>

        <div className="mt-8">
          <SystemFeedbackStats feedbacks={feedbacks} />
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
          <div>
            <h3 className="font-display text-2xl font-bold text-ink">Cảm nhận gần đây</h3>
            {loading ? (
              <div className="mt-5 grid gap-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-32 animate-pulse rounded-3xl bg-white/80" />
                ))}
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  title="Chưa có đánh giá nào"
                  message="Hãy là người đầu tiên chia sẻ cảm nhận về hệ thống."
                />
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                {feedbacks.slice(0, 6).map((feedback) => (
                  <FeedbackCard key={feedback.feedback_id} feedback={feedback} />
                ))}
              </div>
            )}
          </div>

          <SystemFeedbackForm onSubmitted={loadFeedbacks} />
        </div>
      </div>
    </section>
  );
}
