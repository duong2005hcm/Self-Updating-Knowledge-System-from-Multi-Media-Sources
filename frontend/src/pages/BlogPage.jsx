import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { listArticles } from "../api/articleApi";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import LoadingState from "../components/common/LoadingState";
import SectionHeading from "../components/common/SectionHeading";
import { formatDate, getTopicGradient, truncate } from "../lib/utils";

export default function BlogPage() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    items: [],
  });
  const [activeTag, setActiveTag] = useState("all");

  useEffect(() => {
    let active = true;

    listArticles({ limit: 20 })
      .then((response) => {
        if (!active) return;
        setState({
          loading: false,
          error: "",
          items: response.items || [],
        });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          loading: false,
          error: error.message || "Không thể tải danh sách bài viết.",
          items: [],
        });
      });

    return () => {
      active = false;
    };
  }, []);

  const tags = useMemo(() => {
    const values = new Set();
    state.items.forEach((item) => {
      (item.tags || []).forEach((tag) => values.add(tag));
      if (item.topic) values.add(item.topic);
    });
    return ["all", ...Array.from(values)];
  }, [state.items]);

  const filteredItems = useMemo(() => {
    if (activeTag === "all") return state.items;
    return state.items.filter((item) => {
      return item.topic === activeTag || (item.tags || []).includes(activeTag);
    });
  }, [activeTag, state.items]);

  return (
    <div className="page-shell py-10 pb-16">
      <SectionHeading
        kicker="Blog"
        title="Bài viết y tế và nguồn tin tham khảo"
        description="Trang blog gọi `GET /api/articles`, hiển thị filter tag/topic tại client và cho phép mở article placeholder hoặc nguồn gốc bên ngoài."
      />

      <div className="mt-8 flex flex-wrap gap-3">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTag === tag
                ? "bg-brand-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700"
            }`}
            onClick={() => setActiveTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="mt-10">
        {state.loading ? <LoadingState title="Đang tải bài viết y tế" /> : null}
        {!state.loading && state.error ? <ErrorState message={state.error} /> : null}
        {!state.loading && !state.error && filteredItems.length === 0 ? (
          <EmptyState
            title="Chưa có bài viết phù hợp"
            message="Backend chưa trả về bài viết nào cho bộ lọc hiện tại."
          />
        ) : null}
        {!state.loading && !state.error && filteredItems.length > 0 ? (
          <div className="card-grid">
            {filteredItems.map((article) => (
              <article key={article.id} className="glass-panel overflow-hidden">
                <div className={`h-40 bg-gradient-to-br ${getTopicGradient(article.topic || article.source_name)} p-6 text-white`}>
                  <div className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                    {article.topic || article.source_name}
                  </div>
                  <div className="mt-6 text-xl font-bold">{truncate(article.title, 60)}</div>
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <span>{article.source_name}</span>
                    <span>{formatDate(article.published_at || article.created_at)}</span>
                    <span>{article.content_type}</span>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-semibold text-ink">
                    {article.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-500">
                    {truncate(article.summary || article.content, 170)}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      to={`/blog/${article.id}`}
                      state={{ article }}
                      className="btn-secondary px-4 py-2.5"
                    >
                      Xem placeholder
                    </Link>
                    {article.source_url ? (
                      <a
                        href={article.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"
                      >
                        Mở nguồn gốc
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
