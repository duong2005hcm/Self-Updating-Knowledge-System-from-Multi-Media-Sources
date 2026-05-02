import { ArrowRight, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDateTime, truncate } from "../../lib/utils";

function dotClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "success" || normalized === "completed" || normalized === "active") {
    return "bg-emerald-500";
  }
  if (normalized === "failed" || normalized === "error") {
    return "bg-rose-500";
  }
  if (normalized === "skipped" || normalized === "pending" || normalized === "processing") {
    return "bg-amber-500";
  }
  return "bg-slate-400";
}

function IconForStatus({ status }) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "success" || normalized === "completed" || normalized === "active") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }
  if (normalized === "failed" || normalized === "error") {
    return <XCircle className="h-4 w-4 text-rose-600" />;
  }
  return <Clock3 className="h-4 w-4 text-amber-600" />;
}

export default function RecentActivityTimeline({ items = [] }) {
  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="section-kicker">Timeline</div>
          <h2 className="mt-3 font-display text-2xl font-semibold text-ink">Hoạt động gần đây</h2>
          <p className="mt-2 text-sm text-slate-500">
            Các job và thay đổi mới nhất được rút gọn để admin đọc nhanh.
          </p>
        </div>
        <Link to="/admin/pipeline" className="btn-ghost px-4 py-2">
          Xem tất cả
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Chưa có hoạt động gần đây để hiển thị.
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {items.map((item, index) => (
            <div key={item.id} className="relative flex gap-4">
              <div className="relative flex w-8 shrink-0 justify-center">
                <span className={`mt-1 h-3.5 w-3.5 rounded-full ${dotClass(item.status)}`} />
                {index < items.length - 1 ? (
                  <span className="absolute top-5 h-[calc(100%-0.5rem)] w-px bg-slate-200" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <IconForStatus status={item.status} />
                      <p className="text-sm font-bold text-ink">{item.title}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {truncate(item.description, 140)}
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-slate-400">
                    {formatDateTime(item.time)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
