import React, { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";

export default function ToastMessage({ open, message, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => onClose?.(), 3800);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  return (
    <div
      className={[
        "pointer-events-none fixed right-4 top-6 z-[80] w-[min(420px,calc(100vw-2rem))] transition-all duration-300",
        open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
      ].join(" ")}
    >
      <div className="pointer-events-auto flex items-start gap-2 rounded-2xl border border-emerald-200 bg-white p-4 shadow-lg">
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
        <p className="m-0 flex-1 text-sm font-semibold leading-relaxed text-slate-700">
          {message}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-700"
          aria-label="Đóng thông báo"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
