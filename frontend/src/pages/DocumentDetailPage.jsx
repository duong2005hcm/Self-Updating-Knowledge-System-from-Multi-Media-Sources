import { Download, Eye, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getDocumentDetail, getDocumentPreview, openDocumentFile } from "../api/documentApi";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import LoadingState from "../components/common/LoadingState";
import { useAuth } from "../providers/AuthProvider";
import { formatDateTime, getStatusTone } from "../lib/utils";

function MetadataItem({ label, value }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-ink">{value || "N/A"}</div>
    </div>
  );
}

export default function DocumentDetailPage() {
  const { documentId } = useParams();
  const [searchParams] = useSearchParams();
  const { getToken, user } = useAuth();
  const sourceQuery = String(searchParams.get("q") || "").trim();
  const [state, setState] = useState({
    loading: true,
    error: "",
    document: null,
    preview: [],
    previewMode: "",
    previewQuery: "",
    fileBusy: false,
  });

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({ ...current, loading: true, error: "" }));

      try {
        const token = user ? await getToken() : null;
        const [detailResponse, previewResponse] = await Promise.all([
          getDocumentDetail(documentId, token),
          getDocumentPreview(documentId, {
            query: sourceQuery,
            limit: 3,
            previewChars: 700,
            token,
          }),
        ]);

        if (!active) return;
        setState({
          loading: false,
          error: "",
          document: detailResponse.item,
          preview: previewResponse.items || [],
          previewMode: previewResponse.mode || "",
          previewQuery: previewResponse.query || sourceQuery,
          fileBusy: false,
        });
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          error: error.message || "Không thể tải tài liệu.",
          document: null,
          preview: [],
          previewMode: "",
          previewQuery: "",
          fileBusy: false,
        });
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [documentId, getToken, sourceQuery, user]);

  const handleOpenFile = async (mode) => {
    if (!state.document) return;

    setState((current) => ({ ...current, fileBusy: true }));
    try {
      const token = user ? await getToken() : null;
      await openDocumentFile(documentId, {
        token,
        mode,
        fileName: state.document.title,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error.message || "Không thể mở file tài liệu.",
      }));
    } finally {
      setState((current) => ({ ...current, fileBusy: false }));
    }
  };

  const previewModeLabel =
    {
      ai_summary: "AI summary",
      matched_snippets: "snippet theo truy vấn",
      extractive_summary: "tóm tắt trích xuất",
      best_snippets: "snippet nổi bật",
    }[state.previewMode] || "preview tài liệu";
  const previewDescription = state.previewQuery
    ? `Các đoạn liên quan nhất tới truy vấn "${state.previewQuery}".`
    : "Tóm tắt hoặc snippet được backend chọn theo chất lượng, không lấy tuần tự 5 chunk đầu.";

  if (state.loading) {
    return (
      <div className="page-shell py-10">
        <LoadingState title="Đang tải chi tiết tài liệu" />
      </div>
    );
  }

  if (state.error && !state.document) {
    return (
      <div className="page-shell py-10">
        <ErrorState message={state.error} />
      </div>
    );
  }

  if (!state.document) {
    return (
      <div className="page-shell py-10">
        <EmptyState title="Tài liệu không tồn tại" />
      </div>
    );
  }

  return (
    <div className="page-shell py-10 pb-16">
      <div className="glass-panel p-8 sm:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`status-pill ${getStatusTone(state.document.status)}`}>
                {state.document.status}
              </span>
              <span className={`status-pill ${getStatusTone(state.document.visibility)}`}>
                {state.document.visibility}
              </span>
              <span className="status-pill border-slate-200 bg-slate-50 text-slate-600">
                {state.document.domain}
              </span>
            </div>
            <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-ink">
              {state.document.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">
              Trang này ghép metadata tài liệu với `GET /api/documents/:documentId/preview`
              để hiển thị snippet theo truy vấn hoặc tóm tắt ngắn thay vì 5 chunk đầu.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="btn-secondary"
              disabled={state.fileBusy}
              onClick={() => handleOpenFile("open")}
            >
              <Eye className="h-4 w-4" />
              Xem PDF
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={state.fileBusy}
              onClick={() => handleOpenFile("download")}
            >
              <Download className="h-4 w-4" />
              Tải PDF
            </button>
          </div>
        </div>

        {state.error ? (
          <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {state.error}
          </div>
        ) : null}

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetadataItem label="Source ID" value={state.document.source_id} />
          <MetadataItem label="Source Type" value={state.document.source_type} />
          <MetadataItem label="Topic" value={state.document.topic} />
          <MetadataItem label="Priority" value={state.document.priority} />
          <MetadataItem label="Current Version" value={state.document.current_version} />
          <MetadataItem label="Created At" value={formatDateTime(state.document.created_at)} />
          <MetadataItem label="Updated At" value={formatDateTime(state.document.updated_at)} />
          <MetadataItem label="Effective At" value={formatDateTime(state.document.effective_at)} />
        </div>
      </div>

      <section className="mt-10">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">Đoạn trích tài liệu</h2>
            <p className="text-sm text-slate-500">{previewDescription}</p>
          </div>
        </div>

        {state.preview.length === 0 ? (
          <EmptyState
            title="Chưa có snippet"
            message="Backend chưa trả về snippet/tóm tắt phù hợp hoặc tài khoản hiện tại không có quyền xem sâu hơn."
          />
        ) : (
          <div className="grid gap-4">
            {state.preview.map((snippet) => (
              <article key={snippet.id} className="glass-panel p-6">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <span>{previewModeLabel}</span>
                  {snippet.chunk_index !== null && snippet.chunk_index !== undefined ? (
                    <span>Chunk #{snippet.chunk_index}</span>
                  ) : null}
                  <span>{snippet.metadata?.source_name || snippet.metadata?.document_name || "Document preview"}</span>
                  <span>{snippet.metadata?.page_start ? `page ${snippet.metadata.page_start}` : snippet.metadata?.topic || "metadata"}</span>
                  <span>Score {Number(snippet.score || 0).toFixed(2)}</span>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                  {snippet.text}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
