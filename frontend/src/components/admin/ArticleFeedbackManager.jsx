import { EyeOff, RotateCcw, Star, CheckCircle2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDateTime, truncate } from "../../lib/utils";

const filters = [
  { value: "all", label: "Tất cả" },
  { value: "low", label: "Rating thấp 0-2 sao" },
  { value: "mid", label: "Rating trung bình 3 sao" },
  { value: "high", label: "Rating cao 4-5 sao" },
  { value: "comment", label: "Có bình luận" },
  { value: "pending", label: "Chưa xử lý" },
  { value: "reviewed", label: "Đã xử lý" },
  { value: "hidden", label: "Đã ẩn" },
];

function feedbackStatus(item) {
  return item.status || "active";
}

function isPending(item) {
  const status = feedbackStatus(item);
  return status === "active";
}

function StarValue({ value }) {
  return (
    <span className="inline-flex items-center gap-1 font-bold text-amber-600">
      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
      {Number(value || 0).toFixed(1)}
    </span>
  );
}

function StatusPill({ status }) {
  const normalized = status || "active";
  const tone =
    normalized === "hidden"
      ? "bg-slate-100 text-slate-600 ring-slate-200"
      : normalized === "reviewed"
        ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
        : "bg-amber-50 text-amber-700 ring-amber-100";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${tone}`}>
      {normalized}
    </span>
  );
}

function ActionButtons({ item, onUpdate, busy }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="btn-ghost px-3 py-2 text-xs"
        disabled={busy}
        onClick={() => onUpdate(item, "reviewed")}
      >
        <CheckCircle2 className="h-4 w-4" />
        Đã xử lý
      </button>
      <button
        type="button"
        className="btn-ghost px-3 py-2 text-xs"
        disabled={busy}
        onClick={() => onUpdate(item, "hidden")}
      >
        <EyeOff className="h-4 w-4" />
        Ẩn
      </button>
      <button
        type="button"
        className="btn-ghost px-3 py-2 text-xs"
        disabled={busy}
        onClick={() => onUpdate(item, "active")}
      >
        <RotateCcw className="h-4 w-4" />
        Khôi phục
      </button>
      <Link to={`/blog/${item.article_id}`} className="btn-secondary px-3 py-2 text-xs">
        <ExternalLink className="h-4 w-4" />
        Mở bài viết
      </Link>
    </div>
  );
}

function matchesFilter(item, filter) {
  const rating = Number(item.rating || 0);
  const hasComment = Boolean(String(item.comment || "").trim());
  const status = feedbackStatus(item);

  if (filter === "low") return rating <= 2;
  if (filter === "mid") return rating === 3;
  if (filter === "high") return rating >= 4;
  if (filter === "comment") return hasComment;
  if (filter === "pending") return isPending(item);
  if (filter === "reviewed") return status === "reviewed";
  if (filter === "hidden") return status === "hidden";
  return true;
}

function matchesSearch(item, search) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return true;

  return [
    item.article_title,
    item.user_email,
    item.user_name,
    item.comment,
    item.article_topic,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

function buildArticleGroups(items) {
  const groups = new Map();
  items.forEach((item) => {
    const articleId = item.article_id || "unknown";
    const current = groups.get(articleId) || {
      articleId,
      title: item.article_title || "Bài viết không tồn tại",
      topic: item.article_topic || "",
      tags: item.article_tags || [],
      feedbacks: [],
    };
    current.feedbacks.push(item);
    groups.set(articleId, current);
  });

  return Array.from(groups.values())
    .map((group) => {
      const ratings = group.feedbacks
        .map((item) => Number(item.rating))
        .filter((rating) => !Number.isNaN(rating));
      const ratingSum = ratings.reduce((sum, rating) => sum + rating, 0);
      return {
        ...group,
        ratingCount: ratings.length,
        ratingAvg: ratings.length ? ratingSum / ratings.length : 0,
        commentCount: group.feedbacks.filter((item) => String(item.comment || "").trim()).length,
        pendingCount: group.feedbacks.filter(isPending).length,
      };
    })
    .sort((a, b) => b.pendingCount - a.pendingCount || b.ratingCount - a.ratingCount);
}

export default function ArticleFeedbackManager({
  items,
  filter,
  search,
  view,
  expandedArticleId,
  busy,
  onFilterChange,
  onSearchChange,
  onViewChange,
  onToggleArticle,
  onUpdate,
}) {
  const visibleItems = items.filter((item) => matchesFilter(item, filter) && matchesSearch(item, search));
  const articleGroups = buildArticleGroups(visibleItems);

  const renderFeedback = (item) => (
    <article key={`${item.article_id}-${item.user_id}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StarValue value={item.rating} />
            <StatusPill status={feedbackStatus(item)} />
            <span className="text-xs font-semibold text-slate-500">
              {formatDateTime(item.updated_at || item.created_at)}
            </span>
          </div>
          <div className="mt-2 font-semibold text-ink">{item.user_name || "Người dùng"}</div>
          <div className="text-xs text-slate-500">{item.user_email || "Không có email"}</div>
          {view === "all" ? (
            <div className="mt-3 text-sm font-semibold text-brand-700">
              {item.article_title || "Bài viết không tồn tại"}
            </div>
          ) : null}
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {item.comment ? truncate(item.comment, 420) : "Không có bình luận."}
          </p>
        </div>
        <ActionButtons item={item} onUpdate={onUpdate} busy={busy} />
      </div>
    </article>
  );

  return (
    <div className="space-y-5">
      <div className="glass-panel flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              view === "byArticle" ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
            onClick={() => onViewChange("byArticle")}
          >
            Theo bài viết
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              view === "all" ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
            onClick={() => onViewChange("all")}
          >
            Tất cả feedback
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_240px] xl:min-w-[560px]">
          <input
            className="input-base"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Tìm theo bài viết, email hoặc bình luận..."
          />
          <select
            className="input-base"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
          >
            {filters.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {view === "byArticle" ? (
        <div className="grid gap-4">
          {articleGroups.length === 0 ? (
            <div className="glass-panel p-8 text-center text-sm text-slate-500">
              Chưa có feedback bài viết phù hợp bộ lọc.
            </div>
          ) : (
            articleGroups.map((group) => (
              <article key={group.articleId} className="glass-panel p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-display text-xl font-bold text-ink">{group.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.topic ? (
                        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                          {group.topic}
                        </span>
                      ) : null}
                      {group.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 text-sm sm:grid-cols-4 lg:min-w-[520px]">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Điểm TB</div>
                      <div className="mt-1"><StarValue value={group.ratingAvg} /></div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Đánh giá</div>
                      <div className="mt-1 font-bold text-ink">{group.ratingCount}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Bình luận</div>
                      <div className="mt-1 font-bold text-ink">{group.commentCount}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Chưa xử lý</div>
                      <div className="mt-1 font-bold text-ink">{group.pendingCount}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary px-4 py-2"
                    onClick={() => onToggleArticle(group.articleId)}
                  >
                    {expandedArticleId === group.articleId ? "Thu gọn" : "Xem feedback"}
                  </button>
                  <Link to={`/blog/${group.articleId}`} className="btn-ghost px-4 py-2">
                    Mở bài viết
                  </Link>
                </div>
                {expandedArticleId === group.articleId ? (
                  <div className="mt-5 grid gap-3">
                    {group.feedbacks.map(renderFeedback)}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {visibleItems.length === 0 ? (
            <div className="glass-panel p-8 text-center text-sm text-slate-500">
              Chưa có feedback bài viết phù hợp bộ lọc.
            </div>
          ) : (
            visibleItems.map(renderFeedback)
          )}
        </div>
      )}
    </div>
  );
}
