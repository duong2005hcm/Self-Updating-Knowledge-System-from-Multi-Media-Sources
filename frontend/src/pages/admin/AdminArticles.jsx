import { useEffect, useState } from "react";
import { createArticle, ingestArticles } from "../../api/adminApi";
import { listArticles } from "../../api/articleApi";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import LoadingState from "../../components/common/LoadingState";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { useAuth } from "../../providers/AuthProvider";
import { formatDate, truncate } from "../../lib/utils";

const ingestDefaults = {
  source_name: "all",
  limit_per_source: 2,
  query: "public health",
  topic: "health",
  tags: "manual",
};

const articleDefaults = {
  title: "",
  summary: "",
  content: "",
  source_name: "",
  source_url: "",
  topic: "health",
  tags: "",
};

export default function AdminArticles() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [ingestForm, setIngestForm] = useState(ingestDefaults);
  const [articleForm, setArticleForm] = useState(articleDefaults);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const loadArticles = async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await listArticles({ limit: 20 }, token);
      setItems(response.items || []);
    } catch (nextError) {
      setError(nextError.message || "Không thể tải articles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, []);

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
          tags: ingestForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        },
        token
      );
      setResult(response);
      await loadArticles();
    } catch (nextError) {
      setError(nextError.message || "Không thể ingest articles.");
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
          tags: articleForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          status: "active",
          visibility: "public",
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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Quản lý bài viết và ingest news"
        description="Trang này ghép `GET /api/articles`, `POST /api/admin/articles/ingest` và thêm một form tạo article thủ công qua `POST /api/articles`."
      />

      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <div className="glass-panel p-6">
            <h2 className="font-display text-2xl font-semibold text-ink">Ingest Articles</h2>
            <form className="mt-6 grid gap-4" onSubmit={submitIngest}>
              <div className="grid gap-4 md:grid-cols-2">
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
                  <span className="text-sm font-semibold text-slate-700">Limit per source</span>
                  <input className="input-base" type="number" min="1" max="2" value={ingestForm.limit_per_source} onChange={(event) => setIngestForm((current) => ({ ...current, limit_per_source: event.target.value }))} />
                </label>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Query</span>
                <input className="input-base" value={ingestForm.query} onChange={(event) => setIngestForm((current) => ({ ...current, query: event.target.value }))} />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Topic</span>
                  <input className="input-base" value={ingestForm.topic} onChange={(event) => setIngestForm((current) => ({ ...current, topic: event.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Tags</span>
                  <input className="input-base" value={ingestForm.tags} onChange={(event) => setIngestForm((current) => ({ ...current, tags: event.target.value }))} placeholder="manual, health" />
                </label>
              </div>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Đang ingest..." : "Chạy ingest articles"}
              </button>
            </form>
          </div>

          <div className="glass-panel p-6">
            <h2 className="font-display text-2xl font-semibold text-ink">Tạo article thủ công</h2>
            <form className="mt-6 grid gap-4" onSubmit={submitManualArticle}>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Title</span>
                <input className="input-base" value={articleForm.title} onChange={(event) => setArticleForm((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Summary</span>
                <textarea className="input-base min-h-[120px]" value={articleForm.summary} onChange={(event) => setArticleForm((current) => ({ ...current, summary: event.target.value }))} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Content</span>
                <textarea className="input-base min-h-[160px]" value={articleForm.content} onChange={(event) => setArticleForm((current) => ({ ...current, content: event.target.value }))} />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Source name</span>
                  <input className="input-base" value={articleForm.source_name} onChange={(event) => setArticleForm((current) => ({ ...current, source_name: event.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Source URL</span>
                  <input className="input-base" value={articleForm.source_url} onChange={(event) => setArticleForm((current) => ({ ...current, source_url: event.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Topic</span>
                  <input className="input-base" value={articleForm.topic} onChange={(event) => setArticleForm((current) => ({ ...current, topic: event.target.value }))} />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Tags</span>
                  <input className="input-base" value={articleForm.tags} onChange={(event) => setArticleForm((current) => ({ ...current, tags: event.target.value }))} />
                </label>
              </div>
              <button type="submit" className="btn-secondary" disabled={busy}>
                {busy ? "Đang tạo..." : "Tạo article"}
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-6">
            <h2 className="font-display text-2xl font-semibold text-ink">Kết quả ingest</h2>
            <pre className="mt-6 overflow-x-auto rounded-[24px] bg-slate-950 p-5 text-xs leading-6 text-slate-100">
              {JSON.stringify(result, null, 2) || "Chưa có kết quả."}
            </pre>
          </div>

          <div className="glass-panel p-6">
            <h2 className="font-display text-2xl font-semibold text-ink">Danh sách articles</h2>
            {loading ? (
              <div className="mt-6">
                <LoadingState title="Đang tải articles" />
              </div>
            ) : items.length === 0 ? (
              <div className="mt-6">
                <EmptyState title="Chưa có article" />
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {items.map((item) => (
                  <article key={item.id} className="rounded-[24px] border border-slate-100 bg-slate-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {item.source_name} · {formatDate(item.published_at || item.created_at)}
                    </div>
                    <h3 className="mt-3 font-display text-lg font-semibold text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {truncate(item.summary || item.content, 180)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
