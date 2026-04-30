import { ArrowUpRight, Eye, EyeOff, RefreshCw, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  approveArticle,
  createArticle,
  deleteArticle,
  hideArticle,
  ingestArticles,
  ingestMohArticles,
  listAdminArticles,
  rejectArticle,
} from "../../api/adminApi";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import LoadingState from "../../components/common/LoadingState";
import { useAuth } from "../../providers/AuthProvider";
import { formatDateTime, truncate } from "../../lib/utils";

const ingestDefaults = {
  source_name: "all",
  limit_per_source: 2,
  query: "public health",
  topic: "Tin tức",
  tags: "Tin tức",
};

const articleDefaults = {
  title: "",
  summary: "",
  content: "",
  source_name: "",
  source_url: "",
  topic: "Tin tức",
  tags: "",
  published_at: "",
};

const statusOptions = [
  { value: "pending", label: "Chờ duyệt" },
  { value: "", label: "Tất cả" },
  { value: "published", label: "Đã đăng" },
  { value: "approved", label: "Đã duyệt" },
  { value: "active", label: "Active legacy" },
  { value: "rejected", label: "Từ chối" },
  { value: "hidden", label: "Đã ẩn" },
];

function splitTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function statusLabel(status) {
  const option = statusOptions.find((item) => item.value === status);
  return option?.label || status || "Không rõ";
}

function statusClass(status) {
  if (status === "pending") return "bg-amber-50 text-amber-700 ring-amber-100";
  if (status === "rejected") return "bg-rose-50 text-rose-700 ring-rose-100";
  if (status === "hidden") return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-emerald-50 text-emerald-700 ring-emerald-100";
}

function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toIsoDateTime(value) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function articleDisplayTime(article) {
  return article.published_at || article.created_at || article.updated_at;
}

function ArticleModerationCard({ article, busy, onApprove, onReject, onHide, onDelete, onView }) {
  return (
    <article className="rounded-2xl border border-white/70 bg-white p-5 shadow-soft">
      <div className="grid gap-5 lg:grid-cols-[160px_1fr]">
        <div className="overflow-hidden rounded-2xl bg-slate-100">
          {article.image_url ? (
            <img
              src={article.image_url}
              alt={article.title}
              className="aspect-[4/3] h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-brand-500 to-mint-500 text-sm font-bold text-white">
              Article
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClass(article.status)}`}>
              {statusLabel(article.status)}
            </span>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
              {article.visibility || "public"}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {article.source_type || "unknown"}
            </span>
          </div>

          <h3 className="mt-4 font-display text-xl font-bold text-ink">
            {article.title}
          </h3>

          <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
            <span>{article.author_name || article.source_name || "Không rõ tác giả"}</span>
            <span>{article.topic || "general"}</span>
            <span>{formatDateTime(articleDisplayTime(article))}</span>
          </div>

          <div className="mt-3 grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500 sm:grid-cols-3">
            <span>Tạo: {formatDateTime(article.created_at)}</span>
            <span>Cập nhật: {formatDateTime(article.updated_at)}</span>
            <span>Đăng: {formatDateTime(article.published_at)}</span>
          </div>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            {truncate(article.summary || article.content || "Chưa có mô tả.", 220)}
          </p>

          {article.tags?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {article.tags.slice(0, 6).map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary px-4 py-2"
              disabled={busy}
              onClick={() => onApprove(article.id)}
            >
              <ShieldCheck className="h-4 w-4" />
              Duyệt
            </button>
            <button
              type="button"
              className="btn-secondary px-4 py-2"
              disabled={busy}
              onClick={() => onReject(article.id)}
            >
              <XCircle className="h-4 w-4" />
              Từ chối
            </button>
            <button
              type="button"
              className="btn-secondary px-4 py-2"
              disabled={busy}
              onClick={() => onHide(article.id)}
            >
              <EyeOff className="h-4 w-4" />
              Ẩn
            </button>
            <button type="button" className="btn-ghost px-4 py-2" onClick={() => onView(article)}>
              <Eye className="h-4 w-4" />
              Xem chi tiết
            </button>
            <button
              type="button"
              className="btn-ghost px-4 py-2 text-rose-700 hover:bg-rose-50"
              disabled={busy}
              onClick={() => onDelete(article)}
            >
              <Trash2 className="h-4 w-4" />
              Xóa
            </button>
            {article.source_url ? (
              <a href={article.source_url} target="_blank" rel="noreferrer" className="btn-ghost px-4 py-2">
                Nguồn
                <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function AdminArticles() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [ingestForm, setIngestForm] = useState(ingestDefaults);
  const [articleForm, setArticleForm] = useState(articleDefaults);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [result, setResult] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);

  const loadArticles = async (nextStatus = statusFilter) => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await listAdminArticles(token, {
        limit: 50,
        status: nextStatus || undefined,
      });
      setItems(response.items || []);
    } catch (nextError) {
      setError(nextError.message || "Không thể tải danh sách articles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, [statusFilter]);

  const runModeration = async (articleId, action) => {
    setActionBusy(`${articleId}:${action}`);
    setError("");
    try {
      const token = await getToken();
      if (action === "approve") await approveArticle(articleId, token);
      if (action === "reject") await rejectArticle(articleId, token);
      if (action === "hide") await hideArticle(articleId, token);
      await loadArticles();
    } catch (nextError) {
      setError(nextError.message || "Không thể cập nhật trạng thái bài viết.");
    } finally {
      setActionBusy("");
    }
  };

  const runDeleteArticle = async (article) => {
    const confirmed = window.confirm(
      `Xóa vĩnh viễn bài viết này khỏi Firebase?\n\n${article.title}`
    );
    if (!confirmed) return;

    setActionBusy(`${article.id}:delete`);
    setError("");
    try {
      const token = await getToken();
      const response = await deleteArticle(article.id, token);
      setResult(response);
      if (selectedArticle?.id === article.id) {
        setSelectedArticle(null);
      }
      await loadArticles();
    } catch (nextError) {
      setError(nextError.message || "Không thể xóa bài viết.");
    } finally {
      setActionBusy("");
    }
  };

  const submitIngest = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      const response = await ingestArticles(
        {
          source_name: ingestForm.source_name,
          limit_per_source: Number(ingestForm.limit_per_source),
          query: ingestForm.query,
          topic: ingestForm.topic,
          tags: splitTags(ingestForm.tags),
        },
        token
      );
      setResult(response);
      setStatusFilter("active");
      await loadArticles("active");
    } catch (nextError) {
      setError(nextError.message || "Không thể ingest articles.");
    } finally {
      setBusy(false);
    }
  };

  const runMohIngest = async () => {
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      const response = await ingestMohArticles(token);
      setResult(response);
      setIngestForm((current) => ({
        ...current,
        source_name: "moh",
        limit_per_source: 2,
        query: "health",
        topic: "Tin tức",
        tags: "Tin tức, Bộ Y tế, Tin nổi bật",
      }));
      setStatusFilter("active");
      await loadArticles("active");
    } catch (nextError) {
      setError(nextError.message || "Không thể cập nhật tin Bộ Y tế.");
    } finally {
      setBusy(false);
    }
  };

  const submitManualArticle = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      const response = await createArticle(
        {
          title: articleForm.title,
          summary: articleForm.summary,
          content: articleForm.content,
          content_type: "news",
          source_type: "external_news",
          source_name: articleForm.source_name,
          source_url: articleForm.source_url,
          topic: articleForm.topic,
          tags: splitTags(articleForm.tags),
          status: "published",
          visibility: "public",
          published_at: toIsoDateTime(articleForm.published_at),
        },
        token
      );
      setResult(response);
      setArticleForm(articleDefaults);
      await loadArticles();
    } catch (nextError) {
      setError(nextError.message || "Không thể tạo article thủ công.");
    } finally {
      setBusy(false);
    }
  };

  const currentBusy = useMemo(() => Boolean(actionBusy || busy), [actionBusy, busy]);
  const ingestResult = result && typeof result.created_count === "number" ? result : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Quản lý bài viết và duyệt nội dung"
        description="Admin đọc `GET /api/admin/articles`, duyệt/từ chối/ẩn bài cộng đồng và bấm cập nhật tin external news bằng Firebase ID token có custom claim admin=true."
      />

      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="glass-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">
                Moderation queue
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Pending không public. Sau khi duyệt sang published, bài mới xuất hiện ở Blog và Landing.
              </p>
            </div>
            <select
              className="input-base sm:w-56"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <LoadingState title="Đang tải articles cần duyệt" />
          ) : items.length === 0 ? (
            <EmptyState
              title="Không có bài viết trong bộ lọc này"
              message="Khi user gửi bài mới, bài sẽ có status pending và xuất hiện tại đây."
            />
          ) : (
            <div className="grid gap-4">
              {items.map((item) => (
                <ArticleModerationCard
                  key={item.id}
                  article={item}
                  busy={currentBusy}
                  onApprove={(articleId) => runModeration(articleId, "approve")}
                  onReject={(articleId) => runModeration(articleId, "reject")}
                  onHide={(articleId) => runModeration(articleId, "hide")}
                  onDelete={runDeleteArticle}
                  onView={setSelectedArticle}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="glass-panel p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">
                  Bộ Y tế
                </div>
                <h2 className="mt-2 font-display text-xl font-semibold text-ink">
                  Cập nhật tin nổi bật
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Lấy tối đa 2 bài mới từ mục Tin nổi bật của Bộ Y tế, tự dedup và lưu vào articles.
                </p>
              </div>
              <RefreshCw className={`h-5 w-5 text-brand-600 ${busy ? "animate-spin" : ""}`} />
            </div>

            <button type="button" className="btn-primary mt-5 w-full" disabled={busy} onClick={runMohIngest}>
              {busy ? "Đang cập nhật..." : "Cập nhật tin Bộ Y tế"}
            </button>

            {ingestResult ? (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-2xl bg-emerald-50 p-3 font-bold text-emerald-700">
                  {ingestResult.created_count ?? 0}
                  <div className="mt-1 font-medium">mới</div>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3 font-bold text-amber-700">
                  {ingestResult.skipped_count ?? 0}
                  <div className="mt-1 font-medium">trùng</div>
                </div>
                <div className="rounded-2xl bg-rose-50 p-3 font-bold text-rose-700">
                  {ingestResult.failed_count ?? 0}
                  <div className="mt-1 font-medium">lỗi</div>
                </div>
              </div>
            ) : null}
          </div>

          {selectedArticle ? (
            <div className="glass-panel p-6">
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-display text-xl font-bold text-ink">Chi tiết bài viết</h2>
                <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setSelectedArticle(null)}>
                  Đóng
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p><strong>Title:</strong> {selectedArticle.title}</p>
                <p><strong>Author:</strong> {selectedArticle.author_name || selectedArticle.source_name}</p>
                <p><strong>Status:</strong> {selectedArticle.status}</p>
                <p><strong>Visibility:</strong> {selectedArticle.visibility}</p>
                <p><strong>Topic:</strong> {selectedArticle.topic}</p>
                <p><strong>Created at:</strong> {formatDateTime(selectedArticle.created_at)}</p>
                <p><strong>Updated at:</strong> {formatDateTime(selectedArticle.updated_at)}</p>
                <p><strong>Published at:</strong> {formatDateTime(selectedArticle.published_at)}</p>
                <p><strong>Tags:</strong> {(selectedArticle.tags || []).join(", ") || "Không có"}</p>
                <p><strong>Summary:</strong> {selectedArticle.summary || "Không có"}</p>
                <p className="whitespace-pre-wrap"><strong>Content:</strong> {selectedArticle.content || "Không có"}</p>
              </div>
            </div>
          ) : null}

          <div className="glass-panel p-6">
            <h2 className="font-display text-xl font-semibold text-ink">Ingest Articles</h2>
            <form className="mt-5 grid gap-4" onSubmit={submitIngest}>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Source name</span>
                <select className="input-base" value={ingestForm.source_name} onChange={(event) => setIngestForm((current) => ({ ...current, source_name: event.target.value }))}>
                  <option value="all">all</option>
                  <option value="pubmed">pubmed</option>
                  <option value="europe_pmc">europe_pmc</option>
                  <option value="moh">moh</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Query</span>
                <input className="input-base" value={ingestForm.query} onChange={(event) => setIngestForm((current) => ({ ...current, query: event.target.value }))} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Limit</span>
                  <input className="input-base" type="number" min="1" max="2" value={ingestForm.limit_per_source} onChange={(event) => setIngestForm((current) => ({ ...current, limit_per_source: event.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Topic</span>
                  <input className="input-base" value={ingestForm.topic} onChange={(event) => setIngestForm((current) => ({ ...current, topic: event.target.value }))} />
                </label>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Tags</span>
                <input className="input-base" value={ingestForm.tags} onChange={(event) => setIngestForm((current) => ({ ...current, tags: event.target.value }))} placeholder="manual, health" />
              </label>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Đang ingest..." : "Chạy ingest articles"}
              </button>
            </form>
          </div>

          <div className="glass-panel p-6">
            <h2 className="font-display text-xl font-semibold text-ink">Tạo article thủ công</h2>
            <form className="mt-5 grid gap-4" onSubmit={submitManualArticle}>
              <input className="input-base" placeholder="Title" value={articleForm.title} onChange={(event) => setArticleForm((current) => ({ ...current, title: event.target.value }))} />
              <textarea className="input-base min-h-[100px]" placeholder="Summary" value={articleForm.summary} onChange={(event) => setArticleForm((current) => ({ ...current, summary: event.target.value }))} />
              <textarea className="input-base min-h-[140px]" placeholder="Content" value={articleForm.content} onChange={(event) => setArticleForm((current) => ({ ...current, content: event.target.value }))} />
              <input className="input-base" placeholder="Source name" value={articleForm.source_name} onChange={(event) => setArticleForm((current) => ({ ...current, source_name: event.target.value }))} />
              <input className="input-base" placeholder="Source URL" value={articleForm.source_url} onChange={(event) => setArticleForm((current) => ({ ...current, source_url: event.target.value }))} />
              <input className="input-base" placeholder="Topic" value={articleForm.topic} onChange={(event) => setArticleForm((current) => ({ ...current, topic: event.target.value }))} />
              <input className="input-base" placeholder="Tags" value={articleForm.tags} onChange={(event) => setArticleForm((current) => ({ ...current, tags: event.target.value }))} />
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Thời gian đăng</span>
                <div className="flex gap-2">
                  <input
                    className="input-base"
                    type="datetime-local"
                    value={articleForm.published_at}
                    onChange={(event) => setArticleForm((current) => ({ ...current, published_at: event.target.value }))}
                  />
                  <button
                    type="button"
                    className="btn-ghost px-3 py-2"
                    onClick={() => setArticleForm((current) => ({ ...current, published_at: toDateTimeLocalValue(new Date()) }))}
                  >
                    Bây giờ
                  </button>
                </div>
                <span className="text-xs text-slate-500">
                  Nếu để trống, backend sẽ dùng thời điểm hiện tại khi bài được publish.
                </span>
              </label>
              <button type="submit" className="btn-secondary" disabled={busy}>
                {busy ? "Đang tạo..." : "Tạo và publish"}
              </button>
            </form>
          </div>

          <div className="glass-panel p-6">
            <h2 className="font-display text-xl font-semibold text-ink">Kết quả API</h2>
            <pre className="mt-4 max-h-80 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
              {JSON.stringify(result, null, 2) || "Chưa có kết quả."}
            </pre>
          </div>
        </aside>
      </div>
    </div>
  );
}
