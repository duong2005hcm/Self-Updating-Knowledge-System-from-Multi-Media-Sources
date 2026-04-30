import { MessageSquareHeart, Star, ThumbsUp, TimerReset } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getArticleFeedbacksForAdmin,
  updateArticleFeedbackStatus,
} from "../../api/articleFeedbackApi";
import {
  getChatFeedbacksForAdmin,
  updateChatFeedbackStatus,
} from "../../api/chatFeedbackApi";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import ArticleFeedbackManager from "../../components/admin/ArticleFeedbackManager";
import ChatFeedbackManager from "../../components/admin/ChatFeedbackManager";
import FeedbackTabs from "../../components/admin/FeedbackTabs";
import ErrorState from "../../components/common/ErrorState";
import LoadingState from "../../components/common/LoadingState";
import { useAuth } from "../../providers/AuthProvider";

function getFriendlyFeedbackError(error) {
  const message = error?.message || "";
  const code = error?.code || "";
  const normalized = message.toLowerCase();

  if (code === "permission-denied" || normalized.includes("permission")) {
    return "Không có quyền đọc feedback. Kiểm tra Firestore rules/admin claim.";
  }

  if (normalized.includes("index")) {
    return "Thiếu Firestore index. Article feedback đã bỏ orderBy; nếu lỗi còn xuất hiện, kiểm tra query Firestore khác.";
  }

  return message || "Không thể tải feedback người dùng.";
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="glass-panel p-5">
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

function isPending(status) {
  return !status || status === "active";
}

export default function AdminFeedback() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState("articles");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [articleFeedbacks, setArticleFeedbacks] = useState([]);
  const [chatFeedbacks, setChatFeedbacks] = useState([]);
  const [busyKey, setBusyKey] = useState("");
  const [articleFilter, setArticleFilter] = useState("all");
  const [articleSearch, setArticleSearch] = useState("");
  const [articleView, setArticleView] = useState("byArticle");
  const [expandedArticleId, setExpandedArticleId] = useState("");
  const [chatFilter, setChatFilter] = useState("all");
  const [chatSearch, setChatSearch] = useState("");

  const loadFeedbacks = async () => {
    setLoading(true);
    setError("");
    const [articleResult, chatResult] = await Promise.allSettled([
      getArticleFeedbacksForAdmin(),
      getChatFeedbacksForAdmin(),
    ]);

    if (articleResult.status === "fulfilled") {
      setArticleFeedbacks(articleResult.value || []);
    } else {
      setArticleFeedbacks([]);
    }

    if (chatResult.status === "fulfilled") {
      setChatFeedbacks(chatResult.value || []);
    } else {
      setChatFeedbacks([]);
    }

    const errors = [articleResult, chatResult]
      .filter((result) => result.status === "rejected")
      .map((result) => getFriendlyFeedbackError(result.reason))
      .filter(Boolean);

    if (errors.length) {
      setError(errors.join(" "));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFeedbacks();
  }, []);

  const stats = useMemo(() => {
    const articleRatings = articleFeedbacks
      .map((item) => Number(item.rating))
      .filter((rating) => !Number.isNaN(rating));
    const ratingSum = articleRatings.reduce((sum, rating) => sum + rating, 0);
    const helpfulCount = chatFeedbacks.filter((item) => item.helpful === true).length;
    const chatTotal = chatFeedbacks.length;
    const pendingCount =
      articleFeedbacks.filter((item) => isPending(item.status)).length +
      chatFeedbacks.filter((item) => isPending(item.status)).length;

    return {
      articleTotal: articleFeedbacks.length,
      articleAvg: articleRatings.length ? ratingSum / articleRatings.length : 0,
      chatTotal,
      helpfulRate: chatTotal ? (helpfulCount / chatTotal) * 100 : 0,
      pendingCount,
    };
  }, [articleFeedbacks, chatFeedbacks]);

  const updateArticleStatus = async (item, status) => {
    setBusyKey(`article:${item.article_id}:${item.user_id}:${status}`);
    setError("");
    try {
      await updateArticleFeedbackStatus(item.article_id, item.user_id, status, user || profile);
      await loadFeedbacks();
    } catch (nextError) {
      setError(getFriendlyFeedbackError(nextError));
    } finally {
      setBusyKey("");
    }
  };

  const updateChatStatus = async (item, status) => {
    const id = item.feedback_id || item.id;
    setBusyKey(`chat:${id}:${status}`);
    setError("");
    try {
      await updateChatFeedbackStatus(id, status, user || profile);
      await loadFeedbacks();
    } catch (nextError) {
      setError(getFriendlyFeedbackError(nextError));
    } finally {
      setBusyKey("");
    }
  };

  if (loading) {
    return <LoadingState title="Đang tải feedback người dùng" />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        kicker="QUALITY CONTROL"
        title="Feedback của người dùng"
        description="Theo dõi đánh giá bài viết và phản hồi chất lượng câu trả lời Ask AI để cải thiện kho tri thức."
      />

      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={MessageSquareHeart}
          label="Tổng feedback bài viết"
          value={stats.articleTotal}
        />
        <StatCard
          icon={Star}
          label="Điểm trung bình bài viết"
          value={`${stats.articleAvg.toFixed(1)}/5`}
        />
        <StatCard
          icon={MessageSquareHeart}
          label="Tổng feedback chatbox"
          value={stats.chatTotal}
        />
        <StatCard
          icon={ThumbsUp}
          label="Tỷ lệ hữu ích"
          value={`${stats.helpfulRate.toFixed(0)}%`}
        />
        <StatCard
          icon={TimerReset}
          label="Feedback chưa xử lý"
          value={stats.pendingCount}
        />
      </div>

      <FeedbackTabs value={tab} onChange={setTab} />

      {tab === "articles" ? (
        <ArticleFeedbackManager
          items={articleFeedbacks}
          filter={articleFilter}
          search={articleSearch}
          view={articleView}
          expandedArticleId={expandedArticleId}
          busy={Boolean(busyKey)}
          onFilterChange={setArticleFilter}
          onSearchChange={setArticleSearch}
          onViewChange={setArticleView}
          onToggleArticle={(articleId) =>
            setExpandedArticleId((current) => (current === articleId ? "" : articleId))
          }
          onUpdate={updateArticleStatus}
        />
      ) : (
        <ChatFeedbackManager
          items={chatFeedbacks}
          filter={chatFilter}
          search={chatSearch}
          busy={Boolean(busyKey)}
          onFilterChange={setChatFilter}
          onSearchChange={setChatSearch}
          onUpdate={updateChatStatus}
        />
      )}
    </div>
  );
}
