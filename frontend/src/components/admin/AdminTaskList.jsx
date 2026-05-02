import { AlertTriangle, ArrowRight, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

const priorityStyles = {
  high: "border-rose-100 bg-rose-50 text-rose-700",
  medium: "border-amber-100 bg-amber-50 text-amber-700",
  low: "border-sky-100 bg-sky-50 text-sky-700",
};

function PriorityBadge({ priority }) {
  const normalized = priority || "low";
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em]",
        priorityStyles[normalized] || priorityStyles.low
      )}
    >
      {normalized}
    </span>
  );
}

export default function AdminTaskList({ items = [] }) {
  return (
    <div className="glass-panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="section-kicker">Workflow</div>
          <h2 className="mt-3 font-display text-2xl font-semibold text-ink">Việc cần xử lý</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Các đầu việc ưu tiên để admin nắm nhanh những khu vực cần kiểm tra hoặc duyệt thêm.
          </p>
        </div>
        <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
          <Clock3 className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-3xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-ink">{item.label}</h3>
                <PriorityBadge priority={item.priority} />
              </div>
              <p className="mt-2 text-sm text-slate-500">{item.help}</p>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-center">
              <div className="inline-flex min-w-16 items-center justify-center rounded-2xl bg-white px-3 py-2 text-lg font-bold text-ink shadow-sm ring-1 ring-slate-100">
                {item.count}
              </div>
              <Link to={item.to} className="btn-ghost px-4 py-2">
                Xem
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}

        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
            Chưa có đầu việc nào cần xử lý ngay.
          </div>
        ) : null}

        <div className="flex items-start gap-3 rounded-3xl border border-slate-100 bg-white p-4 text-sm text-slate-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p>
            Nếu một API hoặc Firestore chưa phản hồi, dashboard sẽ hiển thị `0` để giữ giao diện
            ổn định thay vì làm vỡ toàn bộ trang.
          </p>
        </div>
      </div>
    </div>
  );
}
