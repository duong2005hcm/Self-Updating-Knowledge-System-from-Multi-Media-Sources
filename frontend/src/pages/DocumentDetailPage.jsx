import { Download, Eye, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getDocumentDetail, openDocumentFile } from "../api/documentApi";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import LoadingState from "../components/common/LoadingState";
import { formatDateTime, getStatusTone } from "../lib/utils";
import { useAuth } from "../providers/AuthProvider";

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

function SummaryBadge({ status }) {
  if (status !== "approved") {
    return (
      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        Pending
      </span>
    );
  }

  return (
    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
      Approved
    </span>
  );
}

export default function DocumentDetailPage() {
  const { documentId } = useParams();
  const { getToken, user } = useAuth();
  const [state, setState] = useState({
    loading: true,
    error: "",
    document: null,
    fileBusy: false,
  });

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({ ...current, loading: true, error: "" }));

      try {
        const token = user ? await getToken() : null;
        const detailResponse = await getDocumentDetail(documentId, token);

        if (!active) return;
        setState({
          loading: false,
          error: "",
          document: detailResponse.item,
          fileBusy: false,
        });
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          error: error.message || "Không thể tải tài liệu.",
          document: null,
          fileBusy: false,
        });
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [documentId, getToken, user]);

  const handleOpenFile = async (mode) => {
    if (!state.document) return;

    const targetWindow = mode === "open" ? window.open("about:blank", "_blank") : null;
    if (targetWindow) {
      targetWindow.opener = null;
    }

    setState((current) => ({ ...current, fileBusy: true }));
    try {
      const token = user ? await getToken() : null;
      await openDocumentFile(documentId, {
        token,
        mode,
        fileName: state.document.title,
        targetWindow,
      });
    } catch (error) {
      if (targetWindow && !targetWindow.closed) {
        targetWindow.close();
      }
      setState((current) => ({
        ...current,
        error: error.message || "Không thể mở file tài liệu.",
      }));
    } finally {
      setState((current) => ({ ...current, fileBusy: false }));
    }
  };

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

  const hasApprovedSummary =
    state.document.summary_status === "approved" && Boolean(state.document.ai_summary);
  const suggestedTags = Array.isArray(state.document.ai_suggested_tags)
    ? state.document.ai_suggested_tags.filter(Boolean)
    : [];

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
              Tài liệu đã được hệ thống tóm tắt và kiểm duyệt để người dùng đọc nhanh nội dung
              chính.
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

        <section className="mt-8 rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
                <FileText className="h-4 w-4" />
                Tóm tắt đã được kiểm duyệt
              </div>
            </div>
            <SummaryBadge status={state.document.summary_status} />
          </div>

          {hasApprovedSummary ? (
            <>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {state.document.ai_summary}
              </p>

              {state.document.summary_updated_at ? (
                <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                  Cập nhật summary {formatDateTime(state.document.summary_updated_at)}
                </p>
              ) : null}

              {state.document.ai_suggested_topic || suggestedTags.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {state.document.ai_suggested_topic ? (
                    <span className="rounded-full border border-sky-100 bg-white px-3 py-1 text-xs font-semibold text-sky-700">
                      Topic: {state.document.ai_suggested_topic}
                    </span>
                  ) : null}
                  {suggestedTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {Array.isArray(state.document.ai_key_points) && state.document.ai_key_points.length ? (
                <div className="mt-5">
                  <h3 className="text-sm font-bold text-slate-800">Ý chính</h3>
                  <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
                    {state.document.ai_key_points.map((point, index) => (
                      <li key={`${point}-${index}`} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {state.document.ai_medical_warning ? (
                <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
                  {state.document.ai_medical_warning}
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-500">
              Tài liệu này chưa có tóm tắt được duyệt. Bạn vẫn có thể xem hoặc tải PDF gốc.
            </div>
          )}
        </section>

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
    </div>
  );
}
