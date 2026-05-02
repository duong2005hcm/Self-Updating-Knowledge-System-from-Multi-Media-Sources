const toneMap = {
  created: "border-emerald-200 bg-emerald-50 text-emerald-800",
  updated: "border-sky-200 bg-sky-50 text-sky-800",
  skipped: "border-amber-200 bg-amber-50 text-amber-800",
  failed: "border-rose-200 bg-rose-50 text-rose-800",
  mixed: "border-slate-200 bg-slate-50 text-slate-700",
};

const messageMap = {
  created: "Đã tạo tài liệu mới.",
  updated: "Tài liệu đã được cập nhật phiên bản mới.",
  skipped: "Tài liệu không thay đổi, đã bỏ qua embedding lại.",
  failed: "Ingest thất bại.",
  mixed: "Ingest hoàn tất với nhiều trạng thái khác nhau.",
};

export default function IngestStatusToast({ action, message, onClose }) {
  if (!action) return null;

  const tone = toneMap[action] || toneMap.mixed;
  const text = message || messageMap[action] || "Đã nhận kết quả ingest.";

  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${tone}`}
    >
      <span>{text}</span>
      {onClose ? (
        <button type="button" className="text-xs opacity-70 hover:opacity-100" onClick={onClose}>
          Đóng
        </button>
      ) : null}
    </div>
  );
}
