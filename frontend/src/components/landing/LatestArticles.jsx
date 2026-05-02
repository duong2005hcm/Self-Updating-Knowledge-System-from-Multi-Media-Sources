import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDateTime, getArticleTopicLabel, truncate } from "../../lib/utils";
import EmptyState from "../common/EmptyState";
import ErrorState from "../common/ErrorState";
import LoadingState from "../common/LoadingState";
import SafeImage from "../common/SafeImage";
import SectionHeading from "../common/SectionHeading";

function getImageUrl(article) {
  return article.image_url || article.thumbnail_url || article.cover_image || article.image || "";
}

function getSummary(article) {
  return article.summary || article.excerpt || article.description || article.content || "";
}

export default function LatestArticles({
  articles,
  error,
  isLoading,
  usingFallback,
}) {
  const hasArticles = articles.length > 0;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          kicker="Tin tức y tế"
          title="Tin nổi bật và bài viết sức khỏe mới nhất"
          description="Theo dõi các cập nhật y tế nổi bật, nguồn chính thống và bài viết sức khỏe được chọn lọc."
        />
        {usingFallback ? (
          <div className="status-pill border-amber-200 bg-amber-50 text-amber-700">
            Đang hiển thị dữ liệu mẫu
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-10">
          <LoadingState
            title="Đang tải bài viết y tế"
            description="Hệ thống đang lấy tin tức và bài viết sức khỏe mới nhất."
          />
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="mt-10">
          <ErrorState
            title="Chưa tải được bài viết mới"
            message={`${error} Tạm thời hiển thị dữ liệu mẫu để bạn xem giao diện.`}
          />
        </div>
      ) : null}

      {!isLoading && !error && !hasArticles ? (
        <div className="mt-10">
          <EmptyState
            title="Chưa có bài viết public"
            message="Khi admin cập nhật tin Bộ Y tế hoặc duyệt bài viết mới, nội dung sẽ xuất hiện tại đây."
          />
        </div>
      ) : null}

      {hasArticles ? (
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => {
            const topicLabel = getArticleTopicLabel(article, "Tin tức");

            return (
              <article key={article.id} className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-float">
                <div className="relative h-56 w-full overflow-hidden bg-slate-100">
                  <SafeImage
                    src={getImageUrl(article)}
                    alt={article.title}
                    fallbackType="article"
                    fallbackLabel={topicLabel}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
                  <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-brand-700 shadow-sm">
                    {topicLabel}
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
                    <span>{article.source_name || "Nguồn tham khảo"}</span>
                    <span>{formatDateTime(article.published_at || article.created_at || article.updated_at)}</span>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-semibold leading-7 text-ink">
                    {article.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-500">
                    {truncate(getSummary(article), 160)}
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
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
