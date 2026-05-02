import { Paperclip, SendHorizonal } from "lucide-react";
import { useEffect, useRef } from "react";

export default function ChatInput({
  value,
  disabled,
  sending,
  uploadBusy,
  onChange,
  onSend,
  onUpload,
  autoFocus = false,
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (autoFocus) {
      window.setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [autoFocus]);

  return (
    <div className="border-t border-slate-200 bg-white p-4">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-2 focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100">
        <textarea
          ref={textareaRef}
          className="max-h-40 min-h-[54px] w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
          placeholder="Nhập câu hỏi cho Ask AI..."
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${
            uploadBusy || disabled ? "text-slate-300" : "text-slate-500 hover:bg-white hover:text-brand-700"
          }`}>
            <Paperclip className="h-4 w-4" />
            PDF
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={uploadBusy || disabled}
              onChange={onUpload}
            />
          </label>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={disabled || sending || !value.trim()}
            onClick={onSend}
            aria-label="Gửi câu hỏi"
          >
            <SendHorizonal className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-500">
        Enter để gửi, Shift+Enter để xuống dòng. Thông tin chỉ mang tính tham khảo.
      </div>
    </div>
  );
}
