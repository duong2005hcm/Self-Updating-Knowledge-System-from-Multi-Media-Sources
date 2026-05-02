import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  MessageSquareHeart,
  Newspaper,
  ScanSearch,
  Settings2,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAdminArticles, listPipelineJobs, listSources } from "../../api/adminApi";
import { getArticleFeedbacksForAdmin } from "../../api/articleFeedbackApi";
import { getChatFeedbacksForAdmin } from "../../api/chatFeedbackApi";
import { listAdminDocuments } from "../../api/documentApi";
import { getBackendHealth } from "../../api/publicApi";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminTaskList from "../../components/admin/AdminTaskList";
import {
  DocumentStatusChart,
  IngestResultsChart,
  SourceTypeChart,
} from "../../components/admin/DashboardCharts";
import DashboardStatCard from "../../components/admin/DashboardStatCard";
import RecentActivityTimeline from "../../components/admin/RecentActivityTimeline";
import LoadingState from "../../components/common/LoadingState";
import { formatDateTime, getStatusTone, truncate } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";

const SOURCE_COLORS = {
  PDF: "#0ea5e9",
  Web: "#14b8a6",
  Article: "#6366f1",
  News: "#f59e0b",
  Community: "#ec4899",
  Other: "#94a3b8",
};

const DOCUMENT_STATUS_CONFIG = {
  active: { label: "Active", color: "#10b981" },
  pending: { label: "Pending", color: "#f59e0b" },
  rejected: { label: "Rejected", color: "#ef4444" },
  deactivated: { label: "Deactivated", color: "#8b5cf6" },
  draft: { label: "Draft", color: "#64748b" },
};

function isPendingFeedback(status) {
  return !status || status === "active";
}

function normalizeSourceType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("pdf")) return "PDF";
  if (normalized.includes("web")) return "Web";
  if (normalized.includes("article")) return "Article";
  if (normalized.includes("news") || normalized === "moh") return "News";
  if (normalized.includes("community")) return "Community";
  return "Other";
}

function normalizeDocumentStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "approved" || normalized === "public") return "active";
  if (normalized === "inactive" || normalized === "hidden" || normalized === "private") {
    return "deactivated";
  }
  if (normalized === "processing") return "pending";
  if (normalized in DOCUMENT_STATUS_CONFIG) return normalized;
  return "draft";
}

function getSourceItems(sources = [], documents = []) {
  const counts = {
    PDF: 0,
    Web: 0,
    Article: 0,
    News: 0,
    Community: 0,
    Other: 0,
  };

  const baseItems = sources.length ? sources : documents;
  baseItems.forEach((item) => {
    const key = normalizeSourceType(item?.type || item?.source_type);
    counts[key] += 1;
  });

  return Object.entries(counts)
    .map(([label, value]) => ({
      label,
      value,
      color: SOURCE_COLORS[label],
    }))
    .filter((item) => item.value > 0);
}

function getDocumentStatusItems(documents = []) {
  const counts = {
    active: 0,
    pending: 0,
    rejected: 0,
    deactivated: 0,
    draft: 0,
  };

  documents.forEach((item) => {
    counts[normalizeDocumentStatus(item?.status)] += 1;
  });

  return Object.entries(counts)
    .map(([key, value]) => ({
      key,
      label: DOCUMENT_STATUS_CONFIG[key].label,
      value,
      color: DOCUMENT_STATUS_CONFIG[key].color,
    }))
    .filter((item) => item.value > 0);
}

function toDayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function buildRecentIngestSeries(jobs = []) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = toDayKey(date);
    return {
      key,
      label: date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
      fullLabel: date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };
  });

  const lookup = Object.fromEntries(days.map((item) => [item.key, item]));

  jobs.forEach((job) => {
    const key = toDayKey(job.started_at || job.created_at || job.updated_at);
    if (!lookup[key]) return;

    const created = Number(job.created_count || 0);
    const updated = Number(job.updated_count || 0);
    const skipped = Number(job.skipped_count || 0);
    const failed = Number(job.failed_count || 0);
    const explicitTotal = created + updated + skipped + failed;

    lookup[key].created += created;
    lookup[key].updated += updated;
    lookup[key].skipped += skipped;
    lookup[key].failed += failed;

    if (explicitTotal === 0) {
      if (String(job.status || "").toLowerCase() === "failed") {
        lookup[key].failed += 1;
      } else {
        lookup[key].updated += Math.max(Number(job.processed_count || 0), 1);
      }
    }
  });

  return days;
}

function buildTimelineItems(jobs = []) {
  return [...jobs]
    .sort((a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime())
    .slice(0, 6)
    .map((job) => ({
      id: job.id,
      status: job.status,
      title: `${String(job.status || "unknown").toUpperCase()} · ${truncate(job.source_id || "system", 18)}`,
      description: `${truncate(job.id || "", 18)} · ${Number(job.processed_count || 0)} processed · ${Number(job.created_count || 0)} created · ${Number(job.failed_count || 0)} failed`,
      time: job.started_at || job.created_at,
    }));
}

function QuickActionsPanel() {
  const actions = [
    {
      to: "/admin/ingest",
      label: "Ingest PDF / Web",
      hint: "Nạp tài liệu mới",
      icon: ScanSearch,
    },
    {
      to: "/admin/articles",
      label: "Ingest Articles",
      hint: "Cập nhật tin và bài viết",
      icon: Newspaper,
    },
    {
      to: "/admin/sources",
      label: "Quản lý nguồn",
      hint: "Theo dõi source và trust score",
      icon: Settings2,
    },
    {
      to: "/admin/approvals",
      label: "Phê duyệt tri thức",
      hint: "Duyệt tài liệu và summary",
      icon: CheckCircle2,
    },
    {
      to: "/admin/feedback",
      label: "Xem feedback",
      hint: "Theo dõi phản hồi người dùng",
      icon: MessageSquareHeart,
    },
  ];

  return (
    <div className="glass-panel p-6">
      <div className="section-kicker">Actions</div>
      <h2 className="mt-3 font-display text-2xl font-semibold text-ink">Thao tác nhanh</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Lối tắt đến những tác vụ admin dùng thường xuyên nhất.
      </p>

      <div className="mt-6 grid gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.to}
              to={action.to}
              className="group flex items-center justify-between gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-4 transition hover:border-brand-100 hover:bg-brand-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-2xl bg-white p-3 text-brand-700 shadow-sm">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-ink">{action.label}</div>
                  <div className="truncate text-xs text-slate-500">{action.hint}</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-brand-700" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function RecentJobsPanel({ jobs = [] }) {
  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="section-kicker">Pipeline</div>
          <h2 className="mt-3 font-display text-2xl font-semibold text-ink">
            Recent pipeline jobs
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Chỉ giữ 5 job mới nhất để dashboard không bị kéo dài.
          </p>
        </div>
        <Link to="/admin/pipeline" className="btn-ghost px-4 py-2">
          Xem tất cả
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Chưa có pipeline jobs gần đây.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <div className="min-w-[640px] space-y-3">
            {jobs.slice(0, 5).map((job) => (
              <div
                key={job.id}
                className="grid grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-3xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm"
              >
                <span className={`status-pill ${getStatusTone(job.status)}`}>{job.status}</span>
                <span className="truncate font-semibold text-ink">{truncate(job.id, 18)}</span>
                <span className="truncate text-slate-500">{truncate(job.source_id || "system", 16)}</span>
                <span className="font-semibold text-slate-600">
                  {Number(job.processed_count || 0)}/{Number(job.created_count || 0)}
                </span>
                <span className="text-xs text-slate-400">{formatDateTime(job.started_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { getToken } = useAuth();
  const [state, setState] = useState({
    loading: true,
    errorMessages: [],
    health: "checking",
    sourceItems: [],
    sourceTotal: 0,
    documents: [],
    documentTotal: 0,
    jobs: [],
    pendingArticles: 0,
    articleFeedbacks: [],
    chatFeedbacks: [],
  });

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({ ...current, loading: true, errorMessages: [] }));

      try {
        const token = await getToken();
        const [
          healthResult,
          sourcesResult,
          documentsResult,
          jobsResult,
          pendingArticlesResult,
          articleFeedbackResult,
          chatFeedbackResult,
        ] = await Promise.allSettled([
          getBackendHealth(),
          listSources(token),
          listAdminDocuments(token, { limit: 200 }),
          listPipelineJobs(token, { limit: 50 }),
          listAdminArticles(token, { limit: 50, status: "pending" }),
          getArticleFeedbacksForAdmin(),
          getChatFeedbacksForAdmin(),
        ]);

        if (!active) return;

        const errors = [
          sourcesResult,
          documentsResult,
          jobsResult,
          pendingArticlesResult,
          articleFeedbackResult,
          chatFeedbackResult,
        ]
          .filter((result) => result.status === "rejected")
          .map((result) => result.reason?.message || "Không thể tải một phần dữ liệu dashboard.")
          .filter(Boolean);

        setState({
          loading: false,
          errorMessages: errors,
          health:
            healthResult.status === "fulfilled" && healthResult.value?.status === "ok"
              ? "ready"
              : "down",
          sourceItems:
            sourcesResult.status === "fulfilled" ? sourcesResult.value.items || [] : [],
          sourceTotal:
            sourcesResult.status === "fulfilled" ? Number(sourcesResult.value.total || 0) : 0,
          documents:
            documentsResult.status === "fulfilled" ? documentsResult.value.items || [] : [],
          documentTotal:
            documentsResult.status === "fulfilled"
              ? Number(documentsResult.value.total || 0)
              : 0,
          jobs: jobsResult.status === "fulfilled" ? jobsResult.value.items || [] : [],
          pendingArticles:
            pendingArticlesResult.status === "fulfilled"
              ? Number(
                  pendingArticlesResult.value.total ||
                    pendingArticlesResult.value.items?.length ||
                    0
                )
              : 0,
          articleFeedbacks:
            articleFeedbackResult.status === "fulfilled" ? articleFeedbackResult.value || [] : [],
          chatFeedbacks:
            chatFeedbackResult.status === "fulfilled" ? chatFeedbackResult.value || [] : [],
        });
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          errorMessages: [error.message || "Không thể tải dữ liệu dashboard."],
          health: "down",
          sourceItems: [],
          sourceTotal: 0,
          documents: [],
          documentTotal: 0,
          jobs: [],
          pendingArticles: 0,
          articleFeedbacks: [],
          chatFeedbacks: [],
        });
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [getToken]);

  const derived = useMemo(() => {
    const documentStatusItems = getDocumentStatusItems(state.documents);
    const sourceTypeItems = getSourceItems(state.sourceItems, state.documents);
    const ingestSeries = buildRecentIngestSeries(state.jobs);
    const timelineItems = buildTimelineItems(state.jobs);

    const pendingDocumentCount = state.documents.filter((item) =>
      ["pending", "draft", "processing"].includes(String(item.status || "").toLowerCase())
    ).length;
    const summaryDraftCount = state.documents.filter((item) => {
      const hasSummary =
        Boolean(item.ai_summary) ||
        (Array.isArray(item.ai_key_points) && item.ai_key_points.length > 0);
      return hasSummary && String(item.summary_status || "").toLowerCase() !== "approved";
    }).length;
    const failedJobsCount = state.jobs.filter((job) => {
      const normalizedStatus = String(job.status || "").toLowerCase();
      return normalizedStatus === "failed" || Number(job.failed_count || 0) > 0;
    }).length;
    const feedbackPendingCount =
      state.articleFeedbacks.filter((item) => isPendingFeedback(item.status)).length +
      state.chatFeedbacks.filter((item) => isPendingFeedback(item.status)).length;

    const pendingApprovals = pendingDocumentCount + state.pendingArticles;

    return {
      documentStatusItems,
      sourceTypeItems,
      ingestSeries,
      timelineItems,
      pendingDocumentCount,
      summaryDraftCount,
      failedJobsCount,
      feedbackPendingCount,
      pendingApprovals,
      recentJobCount: state.jobs.length,
    };
  }, [state]);

  if (state.loading) {
    return <LoadingState title="Đang tải admin dashboard" />;
  }

  const taskItems = [
    {
      id: "docs",
      label: "Tài liệu chờ duyệt",
      count: derived.pendingDocumentCount,
      priority: derived.pendingDocumentCount > 0 ? "high" : "low",
      to: "/admin/approvals",
      help: "Các tài liệu hoặc trạng thái chờ duyệt trước khi công khai.",
    },
    {
      id: "summary",
      label: "Summary AI chờ duyệt",
      count: derived.summaryDraftCount,
      priority: derived.summaryDraftCount > 0 ? "medium" : "low",
      to: "/admin/approvals",
      help: "Summary draft đã tạo nhưng chưa được admin approve.",
    },
    {
      id: "articles",
      label: "Bài viết người dùng chờ duyệt",
      count: state.pendingArticles,
      priority: state.pendingArticles > 0 ? "medium" : "low",
      to: "/admin/articles",
      help: "Bài viết cộng đồng đang ở trạng thái pending moderation.",
    },
    {
      id: "feedback",
      label: "Feedback chưa xử lý",
      count: derived.feedbackPendingCount,
      priority: derived.feedbackPendingCount > 0 ? "medium" : "low",
      to: "/admin/feedback",
      help: "Feedback bài viết và chatbox cần review hoặc ẩn.",
    },
    {
      id: "pipeline",
      label: "Pipeline failed gần đây",
      count: derived.failedJobsCount,
      priority: derived.failedJobsCount > 0 ? "high" : "low",
      to: "/admin/pipeline",
      help: "Các job ingest lỗi cần kiểm tra source, file hoặc backend.",
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admin Dashboard"
        description="Tổng quan vận hành kho tri thức, chất lượng dữ liệu và hoạt động cập nhật."
        action={
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/ingest" className="btn-primary">
              <ScanSearch className="h-4 w-4" />
              Ingest PDF / Web
            </Link>
            <Link to="/admin/articles" className="btn-secondary">
              <Newspaper className="h-4 w-4" />
              Ingest Articles
            </Link>
          </div>
        }
      />

      {state.errorMessages.length ? (
        <div className="rounded-3xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <div className="font-semibold">Không thể tải đầy đủ dữ liệu backend</div>
              <p className="mt-1 leading-6 text-amber-800">
                Dashboard vẫn hiển thị phần đã có dữ liệu; các khối lỗi sẽ dùng `0` hoặc trạng thái
                trống để không làm vỡ giao diện.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          icon={Activity}
          label="Backend health"
          value={state.health === "ready" ? "Online" : "Offline"}
          hint={state.health === "ready" ? "API phản hồi bình thường" : "Không kết nối được backend"}
          tone={state.health === "ready" ? "emerald" : "rose"}
        />
        <DashboardStatCard
          icon={Database}
          label="Tổng sources"
          value={state.sourceTotal}
          hint="Nguồn dữ liệu đang theo dõi"
          tone="brand"
        />
        <DashboardStatCard
          icon={FileText}
          label="Tổng documents"
          value={state.documentTotal}
          hint="Bao gồm các trạng thái khác nhau"
          tone="sky"
        />
        <DashboardStatCard
          icon={Workflow}
          label="Pipeline jobs gần đây"
          value={derived.recentJobCount}
          hint="Dựa trên 50 job mới nhất"
          tone="slate"
        />
        <DashboardStatCard
          icon={ShieldAlert}
          label="Pending approvals"
          value={derived.pendingApprovals}
          hint={`${derived.pendingDocumentCount} tài liệu · ${state.pendingArticles} bài viết`}
          tone={derived.pendingApprovals > 0 ? "amber" : "emerald"}
        />
        <DashboardStatCard
          icon={MessageSquareHeart}
          label="Feedback chưa xử lý"
          value={derived.feedbackPendingCount}
          hint={`${state.articleFeedbacks.length} article · ${state.chatFeedbacks.length} chat`}
          tone={derived.feedbackPendingCount > 0 ? "amber" : "emerald"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminTaskList items={taskItems} />
        <QuickActionsPanel />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DocumentStatusChart items={derived.documentStatusItems} />
        <SourceTypeChart items={derived.sourceTypeItems} />
        <div className="xl:col-span-2">
          <IngestResultsChart items={derived.ingestSeries} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <RecentActivityTimeline items={derived.timelineItems} />
        <RecentJobsPanel jobs={state.jobs} />
      </div>
    </div>
  );
}
