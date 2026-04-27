import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function ErrorState({
  title = "Không thể tải dữ liệu",
  message = "Đã có lỗi xảy ra khi kết nối backend.",
  onRetry,
}) {
  return (
    <div className="glass-panel flex min-h-[220px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="rounded-full bg-rose-50 p-4 text-rose-600">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        <p className="max-w-xl text-sm text-slate-500">{message}</p>
      </div>
      {onRetry ? (
        <button className="btn-ghost" onClick={onRetry} type="button">
          <RefreshCcw className="h-4 w-4" />
          Thử lại
        </button>
      ) : null}
    </div>
  );
}
