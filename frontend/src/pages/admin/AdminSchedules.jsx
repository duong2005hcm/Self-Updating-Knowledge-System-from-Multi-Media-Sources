import { CalendarClock } from "lucide-react";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import { formatDateTime } from "../../lib/utils";

const mockSchedules = [
  {
    source: "Bộ Y tế",
    frequency: "Hằng ngày 08:00",
    lastRun: "2026-04-29T08:00:00+07:00",
    nextRun: "2026-04-30T08:00:00+07:00",
    active: true,
  },
  {
    source: "PubMed",
    frequency: "Mỗi 12 giờ",
    lastRun: null,
    nextRun: null,
    active: false,
  },
  {
    source: "Europe PMC",
    frequency: "Hằng tuần",
    lastRun: null,
    nextRun: null,
    active: false,
  },
];

export default function AdminSchedules() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        kicker="OPERATIONS"
        title="Lịch quét tự động"
        description="Quản lý lịch chạy workflow nạp tri thức tự động."
      />

      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
        Chưa gắn API schedule. Bảng dưới đây là placeholder để mô tả cấu trúc quản trị lịch quét.
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 p-5">
          <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Schedule registry</h2>
            <p className="text-sm text-slate-500">Source, frequency, last run, next run, active.</p>
          </div>
        </div>
        <div className="grid gap-3 p-5">
          {mockSchedules.map((schedule) => (
            <article key={schedule.source} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-5">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Source</div>
                  <div className="mt-1 font-semibold text-ink">{schedule.source}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Frequency</div>
                  <div className="mt-1 text-sm text-slate-600">{schedule.frequency}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Last run</div>
                  <div className="mt-1 text-sm text-slate-600">{formatDateTime(schedule.lastRun)}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Next run</div>
                  <div className="mt-1 text-sm text-slate-600">{formatDateTime(schedule.nextRun)}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Active</div>
                  <div className="mt-1">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                      schedule.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {schedule.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
