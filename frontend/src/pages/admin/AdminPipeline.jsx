import { useEffect, useState } from "react";
import { getPipelineJob, listPipelineJobs } from "../../api/adminApi";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import LoadingState from "../../components/common/LoadingState";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { useAuth } from "../../providers/AuthProvider";
import { formatDateTime, getStatusTone } from "../../lib/utils";

export default function AdminPipeline() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadJobs = async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const response = await listPipelineJobs(token, { limit: 50, status: status || undefined });
      setJobs(response.items || []);
    } catch (nextError) {
      setError(nextError.message || "Không thể tải pipeline jobs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [status]);

  const openJob = async (jobId) => {
    setDetailLoading(true);
    try {
      const token = await getToken();
      const response = await getPipelineJob(jobId, token);
      setSelectedJob(response.item || null);
    } catch (nextError) {
      setError(nextError.message || "Không thể tải chi tiết job.");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Pipeline jobs"
        description="Theo dõi `GET /api/pipeline/jobs` và `GET /api/pipeline/jobs/:job_id` để kiểm tra tiến trình ingest gần đây."
      />

      {error ? <ErrorState message={error} /> : null}

      <div className="flex flex-wrap gap-3">
        {["", "success", "failed", "processing"].map((value) => (
          <button
            key={value || "all"}
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              status === value
                ? "bg-brand-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700"
            }`}
            onClick={() => setStatus(value)}
          >
            {value || "all"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <div className="glass-panel p-6">
          {loading ? (
            <LoadingState title="Đang tải pipeline jobs" />
          ) : jobs.length === 0 ? (
            <EmptyState title="Chưa có pipeline job" />
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  className="w-full rounded-[24px] border border-slate-100 bg-slate-50 p-5 text-left transition hover:border-brand-200"
                  onClick={() => openJob(job.id)}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`status-pill ${getStatusTone(job.status)}`}>{job.status}</span>
                    <span className="text-sm font-medium text-slate-500">{job.id}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                    <span>source: {job.source_id}</span>
                    <span>created: {job.created_count}</span>
                    <span>updated: {job.updated_count}</span>
                    <span>started: {formatDateTime(job.started_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="glass-panel p-6">
          <h2 className="font-display text-2xl font-semibold text-ink">Job detail</h2>
          {detailLoading ? (
            <div className="mt-6">
              <LoadingState title="Đang tải chi tiết job" />
            </div>
          ) : !selectedJob ? (
            <div className="mt-6">
              <EmptyState
                title="Chưa chọn job"
                message="Chọn một job ở cột bên trái để xem thông tin chi tiết và logs."
              />
            </div>
          ) : (
            <pre className="mt-6 overflow-x-auto rounded-[24px] bg-slate-950 p-5 text-xs leading-6 text-slate-100">
              {JSON.stringify(selectedJob, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
