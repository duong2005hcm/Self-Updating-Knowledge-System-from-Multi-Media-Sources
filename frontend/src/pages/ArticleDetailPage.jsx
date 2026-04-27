import { ArrowUpRight, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { listArticles } from "../api/articleApi";
import EmptyState from "../components/common/EmptyState";
import LoadingState from "../components/common/LoadingState";
import { formatDate } from "../lib/utils";

export default function ArticleDetailPage() {
  const { articleId } = useParams();
  const location = useLocation();
  const [article, setArticle] = useState(location.state?.article || null);
  const [loading, setLoading] = useState(!location.state?.article);

  useEffect(() => {
    if (article) return;
    let active = true;

    listArticles({ limit: 20 })
      .then((response) => {
        if (!active) return;
        const matched = (response.items || []).find((item) => item.id === articleId) || null;
        setArticle(matched);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [article, articleId]);

  if (loading) {
    return (
      <div className="page-shell py-10">
        <LoadingState title="Đang tìm thông tin bài viết" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="page-shell py-10">
        <EmptyState
          title="Chưa có article detail API"
          message="Route này đang hoạt động ở chế độ placeholder. Khi backend bổ sung API chi tiết bài viết, trang sẽ chuyển sang đọc dữ liệu thật theo `articleId`."
          action={
            <Link to="/blog" className="btn-primary">
              Quay lại blog
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-shell py-10 pb-16">
      <div className="glass-panel p-8 sm:p-10">
        <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.14em] text-brand-700">
          <FileText className="h-4 w-4" />
          Article placeholder detail
        </div>
        <h1 className="mt-5 max-w-4xl font-display text-4xl font-bold tracking-tight text-ink">
          {article.title}
        </h1>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
          <span>{article.source_name}</span>
          <span>{formatDate(article.published_at || article.created_at)}</span>
          <span>{article.topic}</span>
        </div>
        <p className="mt-6 text-base leading-8 text-slate-600">
          {article.summary || article.content}
        </p>
        <div className="mt-8 rounded-[24px] border border-slate-100 bg-slate-50 p-6 text-sm leading-8 text-slate-600">
          {article.content ||
            "Hiện backend chưa cung cấp endpoint chi tiết riêng cho article. Trang này đang hiển thị nội dung placeholder từ dữ liệu list hoặc state điều hướng."}
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
