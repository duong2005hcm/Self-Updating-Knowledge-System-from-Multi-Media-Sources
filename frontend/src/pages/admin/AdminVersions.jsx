import { Search } from "lucide-react";
import { useState } from "react";
import { getDocumentVersions } from "../../api/documentApi";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import LoadingState from "../../components/common/LoadingState";
import { formatDateTime } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";

export default function AdminVersions() {
  const { getToken } = useAuth();
  const [documentId, setDocumentId] = useState("");
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadVersions = async (event) => {
    event.preventDefault();
    const normalizedId = documentId.trim();
    if (!normalizedId) return;

    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await getDocumentVersions(normalizedId, token);
      setVersions(response.items || []);
    } catch (nextError) {
      setError(nextError.message || "Không thể tải phiên bản tài liệu.");
      setVersions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        kicker="KNOWLEDGE BASE"
        title="Quản lý phiên bản"
        description="Theo dõi lịch sử phiên bản tài liệu, checksum và thay đổi tri thức."
      />

      <form className="glass-panel grid gap-3 p-5 lg:grid-cols-[1fr_auto]" onSubmit={loadVersions}>
        <input
          className="input-base"
          value={documentId}
          onChange={(event) => setDocumentId(event.target.value)}
          placeholder="Nhập document_id để gọi GET /api/documents/{document_id}/versions"
        />
        <button type="submit" className="btn-primary" disabled={loading || !documentId.trim()}>
          <Search className="h-4 w-4" />
          Tải versions
        </button>
      </form>

      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState title="Đang tải phiên bản tài liệu" /> : null}

      {!loading && !documentId.trim() ? (
        <EmptyState
          title="Chưa chọn tài liệu"
          message="Nhập document_id để xem lịch sử phiên bản. Trang này dùng API backend hiện có khi có mã tài liệu."
        />
      ) : null}

      {!loading && documentId.trim() && versions.length === 0 ? (
        <EmptyState title="Chưa có phiên bản" message="API chưa trả về version nào cho document_id này." />
      ) : null}

      {versions.length > 0 ? (
        <div className="grid gap-4">
          {versions.map((version) => (
            <article key={version.id || version.version_no} className="glass-panel p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                  Version {version.version_no || version.id}
                </span>
                <span className="text-sm font-semibold text-slate-500">
                  {formatDateTime(version.created_at || version.updated_at)}
                </span>
              </div>
              <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {JSON.stringify(version, null, 2)}
              </pre>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
