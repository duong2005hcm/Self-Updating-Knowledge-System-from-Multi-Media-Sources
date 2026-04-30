import { ArrowLeft, ArrowUpRight, CalendarDays, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getArticle } from "../api/articleApi";
import ArticleFeedback from "../components/blog/ArticleFeedback";
import EmptyState from "../components/common/EmptyState";
import LoadingState from "../components/common/LoadingState";
import SafeImage from "../components/common/SafeImage";
import { formatDateTime, getArticleTopicLabel } from "../lib/utils";

function getImageUrl(article) {
  return article.image_url || article.thumbnail_url || article.cover_image || article.image || "";
}

function getSummary(article) {
  return article.summary || article.excerpt || article.description || "";
}

export default function BlogDetailPage() {
  const { articleId } = useParams();
  const location = useLocation();
  const [article, setArticle] = useState(location.state?.article || null);
  const [loading, setLoading] = useState(!location.state?.article);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    getArticle(articleId)
      .then((response) => {
        if (!active) return;
        setArticle(response.item || null);
      })
      .catch((nextError) => {
        if (!active) return;
        if (!location.state?.article) {
          setArticle(null);
        }
        setError(nextError.message || "Chi tiết bài viết sẽ được cập nhật.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [articleId, location.state?.article]);

  if (loading && !article) {
    return (
      <div className="page-shell py-10">
        <LoadingState title="Đang tải chi tiết bài viết" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="page-shell py-10 pb-16">
        <EmptyState
          title="Chi tiết bài viết sẽ được cập nhật"
          message={error || "Hiện chưa có dữ liệu chi tiết cho bài viết này."}
          action={
            <Link to="/blog" className="btn-primary">
              <ArrowLeft className="h-4 w-4" />
              Quay lại Blog
            </Link>
          }
        />
      </div>
    );
  }

  const topic = getArticleTopicLabel(article, "Tin tức");
  const author = article.author_name || article.source_name || "Nguồn y tế";
  const imageUrl = getImageUrl(article);
  const displayTime = article.published_at || article.created_at || article.updated_at;

  return (
    <article className="pb-16">
      <div className="page-shell py-8">
        <Link to="/blog" className="btn-ghost">
          <ArrowLeft className="h-4 w-4" />
          Quay lại Blog
        </Link>
      </div>

      <header className="page-shell">
        <div className="rounded-3xl border border-white/70 bg-white p-6 shadow-soft sm:p-8 lg:p-10">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                {topic}
              </span>
              {(article.tags || []).slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold leading-tight text-ink sm:text-5xl">
              {article.title}
            </h1>
            <div className="mt-5 flex flex-wrap gap-5 text-sm font-semibold text-slate-500">
              <span className="inline-flex items-center gap-2">
                <UserRound className="h-4 w-4" />
                {author}
              </span>
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {formatDateTime(displayTime)}
              </span>
            </div>
        </div>
      </header>

      <div className="page-shell mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="rounded-2xl border border-white/70 bg-white p-6 shadow-soft sm:p-8">
          {error ? (
            <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Chi tiết bài viết sẽ được cập nhật. Đang hiển thị dữ liệu đã có từ danh sách.
            </div>
          ) : null}
          <p className="text-lg italic leading-9 text-slate-700">
            {getSummary(article)}
          </p>
          {imageUrl ? (
            <figure className="mx-auto mt-7 max-w-4xl">
              <div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                <SafeImage
                  src={imageUrl}
                  alt={article.title}
                  fallbackType="article"
                  fallbackLabel={topic}
                  className="h-auto max-h-[620px] w-full object-contain"
                />
              </div>
              <figcaption className="mt-3 text-center text-sm italic leading-6 text-slate-500">
                {article.image_caption || article.title}
              </figcaption>
            </figure>
          ) : null}
          <div className="mt-8 whitespace-pre-wrap text-base leading-8 text-slate-600">
            {article.content || "Chi tiết bài viết sẽ được cập nhật."}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="h-fit rounded-2xl border border-white/70 bg-white p-6 shadow-soft">
            <div className="text-sm font-bold uppercase tracking-[0.18em] text-brand-700">
              Nguồn tham khảo
            </div>
            <div className="mt-4 text-sm leading-7 text-slate-500">
              Bài viết chỉ có giá trị tham khảo, không thay thế tư vấn, chẩn đoán hoặc điều trị từ bác sĩ/chuyên gia y tế.
            </div>
            {article.source_url ? (
              <a
                href={article.source_url}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary mt-5 w-full"
              >
                Mở nguồn gốc
                <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : null}
            <div className="mt-5 space-y-2 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500">
              <div>Đăng lúc: {formatDateTime(article.published_at || article.created_at)}</div>
              <div>Cập nhật: {formatDateTime(article.updated_at)}</div>
            </div>
          </div>

          <ArticleFeedback articleId={articleId} />
        </aside>
      </div>
    </article>
  );
}
