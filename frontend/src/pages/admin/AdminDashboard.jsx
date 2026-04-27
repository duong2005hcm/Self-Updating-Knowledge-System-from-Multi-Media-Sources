import { Activity, FileText, Link2, ScanSearch } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSources, listPipelineJobs } from "../../api/adminApi";
import { listAdminDocuments } from "../../api/documentApi";
import { getBackendHealth } from "../../api/publicApi";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import LoadingState from "../../components/common/LoadingState";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { useAuth } from "../../providers/AuthProvider";
import { formatDateTime, getStatusTone } from "../../lib/utils";

export default function AdminDashboard() {
  const { getToken } = useAuth();
  const [state, setState] = useState({
    loading: true,
    error: "",
    health: "checking",
    sources: 0,
    documents: 0,
    jobs: [],
  });

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const token = await getToken();
        const [healthResult, sourcesResult, documentsResult, jobsResult] = await Promise.allSettled([
          getBackendHealth(),
          listSources(token),
          listAdminDocuments(token, { limit: 50 }),
          listPipelineJobs(token, { limit: 5 }),
        ]);

        if (!active) return;

        const errorMessage =
          [sourcesResult, documentsResult, jobsResult]
            .find((result) => result.status === "rejected")
            ?.reason?.message || "";

        setState({
          loading: false,
          error: errorMessage,
          health:
            healthResult.status === "fulfilled" && healthResult.value?.status === "ok"
              ? "ready"
              : "down",
          sources:
            sourcesResult.status === "fulfilled" ? sourcesResult.value.total || 0 : 0,
          documents:
            documentsResult.status === "fulfilled" ? documentsResult.value.total || 0 : 0,
          jobs: jobsResult.status === "fulfilled" ? jobsResult.value.items || [] : [],
        });
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          error: error.message || "Không thể tải dashboard.",
          health: "down",
          sources: 0,
          documents: 0,
          jobs: [],
        });
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [getToken]);

  if (state.loading) {
    return <LoadingState title="Đang tải admin dashboard" />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admin Dashboard"
        description="Tổng quan nhanh backend health, số lượng source, document và các pipeline jobs gần nhất."
        action={
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/ingest" className="btn-primary">
              <ScanSearch className="h-4 w-4" />
              Ingest PDF / Web
            </Link>
            <Link to="/admin/articles" className="btn-secondary">
              <Link2 className="h-4 w-4" />
              Ingest Articles
            </Link>
          </div>
        }
      />

      {state.error ? <ErrorState message={state.error} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="glass-panel p-6">
          <div className="text-sm font-semibold text-slate-500">Backend health</div>
          <div className={`mt-4 status-pill ${getStatusTone(state.health === "ready" ? "success" : "failed")}`}>
            <Activity className="h-4 w-4" />
            {state.health === "ready" ? "Online" : "Unavailable"}
          </div>
        </div>
        <div className="glass-panel p-6">
          <div className="text-sm font-semibold text-slate-500">Tổng sources</div>
          <div className="mt-4 font-display text-4xl font-bold text-ink">{state.sources}</div>
        </div>
        <div className="glass-panel p-6">
          <div className="text-sm font-semibold text-slate-500">Tổng documents</div>
          <div className="mt-4 font-display text-4xl font-bold text-ink">{state.documents}</div>
        </div>
        <div className="glass-panel p-6">
          <div className="text-sm font-semibold text-slate-500">Pipeline jobs gần nhất</div>
          <div className="mt-4 font-display text-4xl font-bold text-ink">{state.jobs.length}</div>
        </div>
      </div>

      <div className="glass-panel p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">Recent pipeline jobs</h2>
            <p className="text-sm text-slate-500">Dữ liệu từ `GET /api/pipeline/jobs?limit=5`.</p>
          </div>
        </div>

        {state.jobs.length === 0 ? (
          <EmptyState
            title="Chưa có job gần đây"
            message="Pipeline chưa trả về bản ghi nào trong giới hạn hiện tại."
          />
        ) : (
          <div className="space-y-3">
            {state.jobs.map((job) => (
              <article key={job.id} className="rounded-[24px] border border-slate-100 bg-slate-50 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`status-pill ${getStatusTone(job.status)}`}>{job.status}</span>
                  <span className="text-sm font-medium text-slate-500">{job.id}</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                  <span>source_id: {job.source_id}</span>
                  <span>processed: {job.processed_count}</span>
                  <span>created: {job.created_count}</span>
                  <span>started: {formatDateTime(job.started_at)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
