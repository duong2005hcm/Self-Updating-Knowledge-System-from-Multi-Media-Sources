import { LoaderCircle } from "lucide-react";

export default function LoadingState({
  title = "Đang tải dữ liệu",
  description = "Hệ thống đang gọi API và đồng bộ nội dung hiển thị.",
}) {
  return (
    <div className="glass-panel flex min-h-[220px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <div className="rounded-full bg-brand-50 p-4 text-brand-600">
        <LoaderCircle className="h-8 w-8 animate-spin" />
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        <p className="max-w-xl text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}
