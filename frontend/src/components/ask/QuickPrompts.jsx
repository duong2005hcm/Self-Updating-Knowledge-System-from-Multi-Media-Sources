const prompts = [
  "Tóm tắt tài liệu về sốt xuất huyết",
  "Tìm tài liệu về tiểu đường",
  "Các nguồn tham khảo về bệnh hô hấp",
  "Giải thích kết quả tìm kiếm hiện tại",
];

export default function QuickPrompts({ onSelect }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
      <div className="font-display text-xl font-bold text-ink">Bạn muốn hỏi gì?</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Chọn gợi ý hoặc nhập câu hỏi về kho tri thức sức khỏe.
      </p>
      <div className="mt-4 grid gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            onClick={() => onSelect(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
