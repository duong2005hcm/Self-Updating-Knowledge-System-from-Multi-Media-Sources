import { CheckCircle2, Eye, ExternalLink, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  approvePendingIngest,
  getPendingIngest,
  listPendingIngests,
  rejectPendingIngest,
} from "../../api/adminApi";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import LoadingState from "../../components/common/LoadingState";
import { formatDateTime, getStatusTone, truncate } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";

const filters = [
  { value: "pending", label: "Chờ duyệt" },
  { value: "", label: "Tất cả" },
  { value: "active", label: "Active" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "deactivated", label: "Deactivated" },
];

function resolveUrl(item) {
  return item?.url || item?.pdf_url || "";
}

function chunkCount(item) {
  return Number(item?.chunk_count || item?.chunks_preview?.length || 0);
}

export default function AdminApprovals() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [busyKey, setBusyKey] = useState("");

  const loadPending = async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await listPendingIngests(token, {
        limit: 50,
        status: status || undefined,
      });
      setItems(response.items || []);
    } catch (nextError) {
      setError(nextError.message || "Không thể tải hàng đợi phê duyệt tri thức.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, [status]);

  const viewDetail = async (pendingId) => {
    setLoadingDetail(true);
    setError("");
    try {
      const token = await getToken();
      const response = await getPendingIngest(pendingId, token);
      setSelectedDetail(response);
    } catch (nextError) {
      setError(nextError.message || "Không thể tải chi tiết pending ingest.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const approveItem = async (pendingId) => {
    if (!window.confirm("Duyệt tri thức này và commit vào RAG/Chroma?")) return;

    setBusyKey(`${pendingId}:approve`);
    setError("");
    try {
      const token = await getToken();
      await approvePendingIngest(pendingId, token, {});
      setSelectedDetail(null);
      await loadPending();
    } catch (nextError) {
      setError(nextError.message || "Không thể duyệt pending ingest.");
    } finally {
      setBusyKey("");
    }
  };

  const rejectItem = async (pendingId) => {
    const reason = window.prompt("Lý do từ chối tri thức này?", "");
    if (reason === null) return;

    setBusyKey(`${pendingId}:reject`);
    setError("");
    try {
      const token = await getToken();
      await rejectPendingIngest(pendingId, token, { reason });
      setSelectedDetail(null);
      await loadPending();
    } catch (nextError) {
      setError(nextError.message || "Không thể từ chối pending ingest.");
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        kicker="QUALITY CONTROL"
        title="Phê duyệt tri thức"
        description="Kiểm tra dữ liệu do n8n thu thập trước khi admin duyệt để commit vào document/version/chunks và Chroma."
      />

      {error ? <ErrorState message={error} /> : null}

      <div className="glass-panel flex flex-wrap gap-2 p-4">
        {filters.map((filter) => (
          <button
            key={filter.value || "all"}
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              status === filter.value
                ? "bg-brand-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700"
            }`}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingState title="Đang tải hàng đợi phê duyệt" /> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="Không có bản ghi cần phê duyệt"
          message="Khi n8n gửi preview hợp lệ, dữ liệu sẽ xuất hiện ở tab Chờ duyệt."
        />
      ) : null}

      <div className="grid gap-4">
        {items.map((item) => {
          const itemUrl = resolveUrl(item);
          const isPending = item.status === "pending";
          return (
            <article key={item.pending_id} className="glass-panel p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    <span className={`status-pill ${getStatusTone(item.status)}`}>
                      {item.status || "N/A"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {item.corpus || "unknown corpus"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {item.content_subtype || item.source_kind}
                    </span>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                      {chunkCount(item)} chunks
                    </span>
                  </div>

                  <h3 className="mt-4 font-display text-xl font-bold text-ink">
                    {item.title || itemUrl || item.pending_id}
                  </h3>
                  <div className="mt-2 text-xs font-semibold text-slate-500">
                    {item.source_name || item.source_id} · tạo {formatDateTime(item.created_at)}
                  </div>

                  {itemUrl ? (
                    <a
                      href={itemUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex max-w-full items-center gap-2 truncate text-sm font-semibold text-sky-700 hover:text-sky-900"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      <span className="truncate">{itemUrl}</span>
                    </a>
                  ) : null}

                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {truncate(item.extracted_text_preview || item.description || "", 360)}
                  </p>

                  {item.chunks_preview?.length ? (
                    <div className="mt-4 grid gap-2">
                      {item.chunks_preview.slice(0, 2).map((chunk, index) => (
                        <div key={`${item.pending_id}:chunk:${index}`} className="rounded-2xl bg-slate-50 p-3 text-xs leading-6 text-slate-600">
                          <span className="font-bold text-slate-700">Chunk {chunk.chunk_index ?? index}: </span>
                          {truncate(chunk.text || "", 220)}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 xl:max-w-sm xl:justify-end">
                  <button
                    type="button"
                    className="btn-ghost px-3 py-2 text-xs"
                    disabled={loadingDetail}
                    onClick={() => viewDetail(item.pending_id)}
                  >
                    <Eye className="h-4 w-4" />
                    Xem chi tiết
                  </button>
                  <button
                    type="button"
                    className="btn-primary px-3 py-2 text-xs"
                    disabled={!isPending || Boolean(busyKey)}
                    onClick={() => approveItem(item.pending_id)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Duyệt
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-2 text-xs text-rose-600"
                    disabled={!isPending || Boolean(busyKey)}
                    onClick={() => rejectItem(item.pending_id)}
                  >
                    <XCircle className="h-4 w-4" />
                    Từ chối
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {selectedDetail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-float">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Pending detail
                </div>
                <h2 className="mt-2 font-display text-2xl font-bold text-ink">
                  {selectedDetail.item.title || resolveUrl(selectedDetail.item) || selectedDetail.item.pending_id}
                </h2>
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  {selectedDetail.item.pending_id} · {selectedDetail.item.status}
                </div>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                onClick={() => setSelectedDetail(null)}
              >
                Đóng
              </button>
            </div>

            <div className="max-h-[calc(90vh-96px)] space-y-5 overflow-y-auto p-5">
              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
                <div><b>Source:</b> {selectedDetail.item.source_name || selectedDetail.item.source_id}</div>
                <div><b>Corpus:</b> {selectedDetail.item.corpus || "N/A"}</div>
                <div><b>Subtype:</b> {selectedDetail.item.content_subtype || "N/A"}</div>
                <div><b>Published:</b> {selectedDetail.item.published_at || "N/A"}</div>
                <div><b>DOI:</b> {selectedDetail.item.doi || "N/A"}</div>
                <div><b>PMID:</b> {selectedDetail.item.pmid || "N/A"}</div>
              </div>

              <section>
                <h3 className="font-display text-lg font-bold text-ink">Extracted text</h3>
                <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                  {selectedDetail.extracted_text || selectedDetail.item.extracted_text_preview || "Không có extracted text."}
                </pre>
              </section>

              <section>
                <h3 className="font-display text-lg font-bold text-ink">
                  Chunks ({selectedDetail.chunks?.length || selectedDetail.item.chunk_count || 0})
                </h3>
                <div className="mt-3 grid gap-3">
                  {(selectedDetail.chunks || []).map((chunk, index) => (
                    <div key={`${selectedDetail.item.pending_id}:detail:${index}`} className="rounded-2xl border border-slate-100 p-4">
                      <div className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                        Chunk {chunk.chunk_index ?? index}
                      </div>
                      <p className="text-sm leading-7 text-slate-700">{chunk.text}</p>
                    </div>
                  ))}
                </div>
              </section>

              {selectedDetail.item.status === "pending" ? (
                <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-white/95 py-4">
                  <button
                    type="button"
                    className="btn-ghost px-4 py-2 text-rose-600"
                    disabled={Boolean(busyKey)}
                    onClick={() => rejectItem(selectedDetail.item.pending_id)}
                  >
                    <XCircle className="h-4 w-4" />
                    Từ chối
                  </button>
                  <button
                    type="button"
                    className="btn-primary px-4 py-2"
                    disabled={Boolean(busyKey)}
                    onClick={() => approveItem(selectedDetail.item.pending_id)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Duyệt và commit RAG
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
