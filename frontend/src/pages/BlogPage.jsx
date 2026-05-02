import { Edit3 } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getArticles, getMyArticles } from "../api/articleApi";
import ArticleCard from "../components/blog/ArticleCard";
import ArticleFilters from "../components/blog/ArticleFilters";
import EmptyState from "../components/common/EmptyState";
import SectionHeading from "../components/common/SectionHeading";
import { mockArticles } from "../data/mockArticles";
import { getArticleTopicLabel } from "../lib/utils";
import { useAuth } from "../providers/AuthProvider";

function normalizeArticle(article) {
  return {
    ...article,
    excerpt: article.excerpt || article.summary || "",
    author_name: article.author_name || article.source_name || "Nguồn y tế",
    image_url: article.image_url || null,
    tags: Array.isArray(article.tags) ? article.tags : [],
  };
}

function articleMatchesTopic(article, topic) {
  if (topic === "all") return true;
  const normalizedTopic = topic.toLowerCase();
  const displayTopic = getArticleTopicLabel(article, "");
  return (
    String(displayTopic || "").toLowerCase() === normalizedTopic ||
    String(article.topic || "").toLowerCase() === normalizedTopic ||
    (article.tags || []).some((tag) => String(tag).toLowerCase() === normalizedTopic)
  );
}

function articleMatchesQuery(article, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    article.title,
    article.excerpt,
    article.summary,
    article.content,
    article.source_name,
    getArticleTopicLabel(article, ""),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function getTime(article) {
  const value = article.published_at || article.created_at || article.updated_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function sortArticles(items, sort) {
  const nextItems = [...items];
  if (sort === "oldest") {
    return nextItems.sort((a, b) => getTime(a) - getTime(b));
  }
  if (sort === "featured") {
    return nextItems.sort((a, b) => {
      const scoreA = (a.tags?.length || 0) + (a.source_url ? 1 : 0) + (a.image_url ? 1 : 0);
      const scoreB = (b.tags?.length || 0) + (b.source_url ? 1 : 0) + (b.image_url ? 1 : 0);
      return scoreB - scoreA || getTime(b) - getTime(a);
    });
  }
  return nextItems.sort((a, b) => getTime(b) - getTime(a));
}

function LoadingSkeleton() {
  return (
    <div className="card-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-soft"
        >
          <div className="aspect-[16/10] animate-pulse bg-slate-100" />
          <div className="space-y-4 p-5">
            <div className="h-3 w-32 animate-pulse rounded-full bg-slate-100" />
            <div className="h-6 w-4/5 animate-pulse rounded-full bg-slate-100" />
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-100" />
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BlogPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, getToken } = useAuth();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [topic, setTopic] = useState("all");
  const [sort, setSort] = useState("latest");
  const requestedTab = searchParams.get("tab");
  const activeTab = profile && requestedTab === "mine" ? "mine" : "public";
  const submitted = searchParams.get("submitted") === "1";
  const [state, setState] = useState({
    loading: true,
    error: "",
    items: [],
    usingFallback: false,
  });

  useEffect(() => {
    let active = true;

    setState((current) => ({
      ...current,
      loading: true,
      error: "",
      usingFallback: false,
    }));

    const loadArticles = async () => {
      if (activeTab === "mine") {
        const token = await getToken();
        return getMyArticles({ limit: 50 }, token);
      }
      return getArticles({ limit: 50 });
    };

    loadArticles()
      .then((response) => {
        if (!active) return;
        setState({
          loading: false,
          error: "",
          items: (response.items || []).map(normalizeArticle),
          usingFallback: false,
        });
      })
      .catch((error) => {
        if (!active) return;
        const allowMockFallback = activeTab === "public";
        setState({
          loading: false,
          error:
            error.message ||
            (allowMockFallback
              ? "Không kết nối được backend, đang hiển thị dữ liệu mẫu."
              : "Không thể tải bài viết của bạn."),
          items: allowMockFallback ? mockArticles.map(normalizeArticle) : [],
          usingFallback: allowMockFallback,
        });
      });

    return () => {
      active = false;
    };
  }, [activeTab, getToken]);

  const visibleArticles = useMemo(() => {
    const filtered = state.items.filter(
      (article) =>
        articleMatchesTopic(article, topic) && articleMatchesQuery(article, deferredQuery)
    );
    return sortArticles(filtered, sort);
  }, [deferredQuery, sort, state.items, topic]);

  const openCreatePage = () => {
    if (!profile) {
      navigate("/blog/new");
      return;
    }
    navigate("/blog/new");
  };

  const setTab = (tab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    nextParams.delete("submitted");
    setSearchParams(nextParams);
  };

  return (
    <div className="page-shell py-10 pb-16">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          kicker="BLOG"
          title="Bài viết y tế và nguồn tin tham khảo"
          description="Cập nhật tin tức, tài liệu tham khảo và chia sẻ kiến thức sức khỏe từ cộng đồng và nguồn y tế đáng tin cậy."
        />
        <button type="button" className="btn-primary" onClick={openCreatePage}>
          <Edit3 className="h-4 w-4" />
          Viết bài mới
        </button>
      </section>

      {submitted && profile ? (
        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
          Bài viết của bạn đã gửi thành công và đang chờ duyệt.
        </div>
      ) : null}

      <div className="mt-7 flex flex-wrap gap-3 rounded-2xl border border-white/70 bg-white p-2 shadow-soft">
        <button
          type="button"
          className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "public"
              ? "bg-brand-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
          }`}
          onClick={() => setTab("public")}
        >
          Công khai
        </button>
        {profile ? (
          <button
            type="button"
            className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
              activeTab === "mine"
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
            }`}
            onClick={() => setTab("mine")}
          >
            Bài của tôi
          </button>
        ) : null}
      </div>

      <ArticleFilters
        query={query}
        topic={topic}
        sort={sort}
        onQueryChange={setQuery}
        onTopicChange={setTopic}
        onSortChange={setSort}
      />

      {state.error ? (
        <div
          className={`mt-6 rounded-2xl border px-4 py-3 text-sm font-semibold ${
            state.usingFallback
              ? "border-amber-100 bg-amber-50 text-amber-800"
              : "border-rose-100 bg-rose-50 text-rose-700"
          }`}
        >
          {state.usingFallback
            ? "Không kết nối được backend, đang hiển thị dữ liệu mẫu."
            : state.error}
        </div>
      ) : null}

      {state.loading ? (
        <div className="mt-8">
          <LoadingSkeleton />
        </div>
      ) : null}

      {!state.loading && visibleArticles.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={activeTab === "mine" ? "Bạn chưa gửi bài viết nào" : "Chưa có bài viết công khai"}
            message={
              activeTab === "mine"
                ? "Bài viết bạn gửi sẽ xuất hiện ở đây với trạng thái chờ duyệt, đã đăng hoặc từ chối."
                : "Hiện chưa có bài viết đã được duyệt để hiển thị công khai."
            }
            action={
              <button type="button" className="btn-primary" onClick={openCreatePage}>
                <Edit3 className="h-4 w-4" />
                Viết bài mới
              </button>
            }
          />
        </div>
      ) : null}

      {!state.loading && visibleArticles.length > 0 ? (
        <div className="mt-8">
          <div className="mb-4 text-sm font-semibold text-slate-500">
            {visibleArticles.length} bài viết
            {state.usingFallback ? " mẫu" : ""}
            {activeTab === "mine" ? " của bạn" : ""}
          </div>
          <div className="card-grid">
            {visibleArticles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                showStatus={activeTab === "mine"}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
