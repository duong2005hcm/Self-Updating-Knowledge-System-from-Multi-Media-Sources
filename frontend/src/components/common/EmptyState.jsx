import { Inbox } from "lucide-react";

export default function EmptyState({
  title = "Chưa có dữ liệu",
  message = "Nội dung sẽ xuất hiện tại đây khi backend trả về kết quả phù hợp.",
  action,
}) {
  return (
    <div className="glass-panel flex min-h-[220px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="rounded-full bg-slate-100 p-4 text-slate-500">
        <Inbox className="h-8 w-8" />
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        <p className="max-w-xl text-sm text-slate-500">{message}</p>
      </div>
      {action || null}
    </div>
  );
}
