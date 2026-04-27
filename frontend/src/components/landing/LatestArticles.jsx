import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate, getTopicGradient, truncate } from "../../lib/utils";
import SectionHeading from "../common/SectionHeading";

export default function LatestArticles({ articles, usingFallback }) {
  return (
    <section className="page-shell py-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          kicker="Latest articles"
          title="Tin tức hot và tài liệu mới cập nhật"
          description="Landing page gọi trực tiếp `GET /api/articles?limit=6`. Khi API lỗi, giao diện tự rơi về bộ dữ liệu mẫu để không làm gãy trang."
        />
        {usingFallback ? (
          <div className="status-pill border-amber-200 bg-amber-50 text-amber-700">
            Đang dùng mock fallback
          </div>
        ) : null}
      </div>

      <div className="card-grid mt-10">
        {articles.map((article) => (
          <article key={article.id} className="glass-panel overflow-hidden">
            <div className={`h-44 bg-gradient-to-br ${getTopicGradient(article.topic || article.source_name)} p-6 text-white`}>
              <div className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                {article.topic || article.source_name || "Health"}
              </div>
              <div className="mt-6 max-w-xs text-2xl font-bold leading-tight">
                {truncate(article.title, 70)}
              </div>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
                <span>{article.source_name || "Unknown source"}</span>
                <span>{formatDate(article.published_at || article.created_at)}</span>
                <span>{article.tags?.[0] || article.content_type || "news"}</span>
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-ink">
                {article.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                {truncate(article.summary || article.content, 160)}
              </p>
              <div className="mt-5 flex items-center gap-3">
                <Link
                  to={`/blog/${article.id}`}
                  state={{ article }}
                  className="btn-secondary px-4 py-2.5"
                >
                  Đọc thêm
                </Link>
                {article.source_url ? (
                  <a
                    href={article.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"
                  >
                    Nguồn gốc
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
