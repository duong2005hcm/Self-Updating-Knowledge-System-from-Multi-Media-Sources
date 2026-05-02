import { ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/utils";

const toneMap = {
  brand: "bg-brand-50 text-brand-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  sky: "bg-sky-50 text-sky-700",
  slate: "bg-slate-100 text-slate-600",
};

export default function DashboardStatCard({
  icon: Icon,
  label,
  value,
  hint,
  detail,
  tone = "brand",
}) {
  return (
    <div className="glass-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-500">{label}</div>
          <div className="mt-3 font-display text-3xl font-bold text-ink">{value}</div>
          {hint ? <div className="mt-2 text-xs text-slate-500">{hint}</div> : null}
          {detail ? (
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
              {detail}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          ) : null}
        </div>
        {Icon ? (
          <div className={cn("rounded-2xl p-3", toneMap[tone] || toneMap.brand)}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
