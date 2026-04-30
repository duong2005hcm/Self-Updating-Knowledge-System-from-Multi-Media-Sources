import { CheckCircle2, RotateCcw, ShieldOff, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { patchGovernance } from "../../api/adminApi";
import { listAdminDocuments } from "../../api/documentApi";
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

const actions = [
  { value: "approve", label: "Duyệt", icon: CheckCircle2 },
  { value: "reject", label: "Từ chối", icon: XCircle },
  { value: "deactivate", label: "Deactivate", icon: ShieldOff },
  { value: "reactivate", label: "Reactivate", icon: RotateCcw },
];

export default function AdminApprovals() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState([]);
  const [busyKey, setBusyKey] = useState("");

  const loadDocuments = async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await listAdminDocuments(token, {
        limit: 50,
        status: status || undefined,
      });
      setDocuments(response.items || []);
    } catch (nextError) {
      setError(nextError.message || "Không thể tải danh sách tri thức cần phê duyệt.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [status]);

  const runAction = async (documentId, action) => {
    setBusyKey(`${documentId}:${action}`);
    setError("");
    try {
      const token = await getToken();
      await patchGovernance(documentId, action, token);
      await loadDocuments();
    } catch (nextError) {
      setError(nextError.message || "Không thể cập nhật governance document.");
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        kicker="QUALITY CONTROL"
        title="Phê duyệt tri thức"
        description="Duyệt tài liệu, bài viết hoặc tri thức đang chờ kiểm tra trước khi công khai. Hiện trang này gắn các governance APIs cho documents."
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

      {loading ? <LoadingState title="Đang tải tri thức cần duyệt" /> : null}

      {!loading && documents.length === 0 ? (
        <EmptyState
          title="Không có bản ghi cần phê duyệt"
          message="Nếu backend chưa có hàng đợi duyệt riêng, trang này dùng danh sách documents và governance APIs hiện có."
        />
      ) : null}

      <div className="grid gap-4">
        {documents.map((document) => (
          <article key={document.id} className="glass-panel p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span className={`status-pill ${getStatusTone(document.status)}`}>
                    {document.status || "N/A"}
                  </span>
                  <span className={`status-pill ${getStatusTone(document.visibility)}`}>
                    {document.visibility || "N/A"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {document.domain || "general"}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-xl font-bold text-ink">{document.title}</h3>
                <div className="mt-2 text-xs font-semibold text-slate-500">
                  {document.id} · cập nhật {formatDateTime(document.updated_at || document.created_at)}
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {truncate(document.summary || document.description || document.content_preview, 260)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 lg:max-w-sm">
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.value}
                      type="button"
                      className="btn-ghost px-3 py-2 text-xs"
                      disabled={Boolean(busyKey)}
                      onClick={() => runAction(document.id, action.value)}
                    >
                      <Icon className="h-4 w-4" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
