import { ArrowUpRight, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getArticle } from "../api/articleApi";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import LoadingState from "../components/common/LoadingState";
import { formatDate } from "../lib/utils";

export default function ArticleDetailPage() {
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
        setError(nextError.message || "Không thể tải chi tiết bài viết.");
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
        <LoadingState title="Đang tải thông tin bài viết" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="page-shell py-10">
        {error ? (
          <ErrorState message={error} />
        ) : (
          <EmptyState
            title="Không tìm thấy bài viết"
            message="Backend chỉ trả bài viết public có status=active và visibility=public."
            action={
              <Link to="/blog" className="btn-primary">
                Quay lại blog
              </Link>
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="page-shell py-10 pb-16">
      <div className="glass-panel p-8 sm:p-10">
        <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.14em] text-brand-700">
          <FileText className="h-4 w-4" />
          Article detail
        </div>
        {error ? (
          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Không tải được bản mới từ API, đang hiển thị dữ liệu điều hướng.
          </div>
        ) : null}
        <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold tracking-tight text-ink">
          {article.title}
        </h1>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
          <span>{article.source_name}</span>
          <span>{formatDate(article.published_at || article.created_at)}</span>
          <span>{article.topic}</span>
          {(article.tags || []).slice(0, 3).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
        <p className="mt-6 text-base leading-8 text-slate-600">
          {article.summary || article.content}
        </p>
        <div className="mt-8 rounded-[24px] border border-slate-100 bg-slate-50 p-6 text-sm leading-8 text-slate-600">
          {article.content || article.summary || "Bài viết chưa có nội dung chi tiết."}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/blog" className="btn-secondary">
            Quay lại blog
          </Link>
          {article.source_url ? (
            <a
              href={article.source_url}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
            >
              Mở nguồn gốc
              <ArrowUpRight className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
