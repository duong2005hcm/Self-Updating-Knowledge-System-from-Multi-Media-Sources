import { MessageSquareHeart, Star, UsersRound } from "lucide-react";

function getStats(feedbacks) {
  const ratings = feedbacks
    .map((item) => Number(item.rating))
    .filter((rating) => !Number.isNaN(rating) && rating > 0);
  const ratingSum = ratings.reduce((sum, rating) => sum + rating, 0);

  return {
    average: ratings.length ? ratingSum / ratings.length : 0,
    total: ratings.length,
    latest: feedbacks.length,
  };
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-500">{label}</div>
          <div className="mt-3 font-display text-3xl font-bold text-ink">{value}</div>
          {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
        </div>
        <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function SystemFeedbackStats({ feedbacks = [] }) {
  const stats = getStats(feedbacks);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        icon={Star}
        label="Điểm trung bình"
        value={`${stats.average.toFixed(1)}/5`}
      />
      <StatCard
        icon={UsersRound}
        label="Tổng đánh giá"
        value={stats.total}
      />
      <StatCard
        icon={MessageSquareHeart}
        label="Feedback mới nhất"
        value={stats.latest}
        hint="Đang hiển thị phản hồi active"
      />
    </div>
  );
}
