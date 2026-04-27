import { useEffect, useState } from "react";
import { patchGovernance } from "../../api/adminApi";
import {
  getDocumentChunks,
  getDocumentVersions,
  listAdminDocuments,
} from "../../api/documentApi";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import LoadingState from "../../components/common/LoadingState";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { useAuth } from "../../providers/AuthProvider";
import { formatDateTime, getStatusTone, truncate } from "../../lib/utils";

const actions = ["approve", "reject", "deactivate", "reactivate"];

export default function AdminDocuments() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [versions, setVersions] = useState([]);
  const [chunks, setChunks] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadDocuments = async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await listAdminDocuments(token, { limit: 50 });
      setDocuments(response.items || []);
    } catch (nextError) {
      setError(nextError.message || "Không thể tải documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDetails = async (documentId) => {
    setSelectedDocumentId(documentId);
    setDetailLoading(true);
    try {
      const token = await getToken();
      const [versionsResponse, chunksResponse] = await Promise.all([
        getDocumentVersions(documentId, token),
        getDocumentChunks(documentId, {
          token,
          limit: 10,
          previewChars: 1200,
          includeContent: true,
        }),
      ]);
      setVersions(versionsResponse.items || []);
      setChunks(chunksResponse.items || []);
    } catch (nextError) {
      setError(nextError.message || "Không thể tải versions/chunks.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAction = async (documentId, action) => {
    try {
      const token = await getToken();
      await patchGovernance(documentId, action, token);
      await loadDocuments();
      if (selectedDocumentId === documentId) {
        await loadDetails(documentId);
      }
    } catch (nextError) {
      setError(nextError.message || "Không thể cập nhật governance.");
    }
  };

  if (loading) {
    return <LoadingState title="Đang tải documents" />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Quản lý tài liệu"
        description="Bảng này dùng `GET /api/documents` cho danh sách admin và các action governance để approve, reject, deactivate, reactivate."
      />

      {error ? <ErrorState message={error} /> : null}

      <div className="glass-panel p-6">
        {documents.length === 0 ? (
          <EmptyState title="Chưa có document" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Domain</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Visibility</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-4">
                      <button type="button" className="text-left" onClick={() => loadDetails(document.id)}>
                        <div className="font-semibold text-ink">{document.title}</div>
                        <div className="text-xs text-slate-500">{document.id}</div>
                      </button>
                    </td>
                    <td className="px-4 py-4">{document.domain}</td>
                    <td className="px-4 py-4">
                      <span className={`status-pill ${getStatusTone(document.status)}`}>{document.status}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`status-pill ${getStatusTone(document.visibility)}`}>{document.visibility}</span>
                    </td>
                    <td className="px-4 py-4">{formatDateTime(document.updated_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {actions.map((action) => (
                          <button
                            key={action}
                            type="button"
                            className="btn-ghost px-3 py-2 text-xs"
                            onClick={() => handleAction(document.id, action)}
                          >
                            {action}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2 text-xs"
                          onClick={() => loadDetails(document.id)}
                        >
                          Versions / Chunks
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedDocumentId ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="glass-panel p-6">
            <h2 className="font-display text-2xl font-semibold text-ink">Versions</h2>
            {detailLoading ? (
              <div className="mt-6">
                <LoadingState title="Đang tải versions" />
              </div>
            ) : versions.length === 0 ? (
              <div className="mt-6">
                <EmptyState title="Chưa có version" />
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {versions.map((version) => (
                  <article key={version.id} className="rounded-[24px] border border-slate-100 bg-slate-50 p-5 text-sm text-slate-600">
                    <div className="font-semibold text-ink">Version {version.version_no}</div>
                    <div className="mt-2">status: {version.status}</div>
                    <div className="mt-2">created: {formatDateTime(version.created_at)}</div>
                    <div className="mt-2 break-all">raw_path: {version.raw_path || "N/A"}</div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel p-6">
            <h2 className="font-display text-2xl font-semibold text-ink">Chunks</h2>
            {detailLoading ? (
              <div className="mt-6">
                <LoadingState title="Đang tải chunks" />
              </div>
            ) : chunks.length === 0 ? (
              <div className="mt-6">
                <EmptyState title="Chưa có chunk" />
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {chunks.map((chunk) => (
                  <article key={chunk.id} className="rounded-[24px] border border-slate-100 bg-slate-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      chunk #{chunk.chunk_index ?? "N/A"}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                      {truncate(chunk.content || chunk.content_preview, 420)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
