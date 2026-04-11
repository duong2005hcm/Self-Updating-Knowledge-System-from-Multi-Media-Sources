import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import ContactForm from "./ContactForm";

const MODAL_META = {
  consultation: {
    title: "Đăng ký tư vấn",
    desc: "Để lại thông tin, đội ngũ SIMLESI AI sẽ liên hệ và tư vấn giải pháp phù hợp.",
  },
  demo: {
    title: "Yêu cầu demo",
    desc: "Mô tả nhanh bối cảnh sử dụng để chúng tôi chuẩn bị demo sát nhu cầu của bạn.",
  },
};

export default function ContactModal({
  open,
  type = "consultation",
  onClose,
  onSubmitSuccess,
}) {
  const [rendered, setRendered] = useState(open);
  const [active, setActive] = useState(false);
  const meta = MODAL_META[type] || MODAL_META.consultation;

  useEffect(() => {
    if (open) {
      setRendered(true);
      const id = requestAnimationFrame(() => setActive(true));
      return () => cancelAnimationFrame(id);
    }

    setActive(false);
    const timer = setTimeout(() => setRendered(false), 180);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!rendered) return undefined;

    const handleEsc = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [rendered, onClose]);

  useEffect(() => {
    if (!rendered) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [rendered]);

  if (!rendered) return null;

  return (
    <div
      className={[
        "fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px] transition-opacity duration-200",
        active ? "opacity-100" : "opacity-0",
      ].join(" ")}
      onClick={onClose}
    >
      <div
        className={[
          "relative w-full max-w-2xl rounded-3xl border border-white/70 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.22)] transition-all duration-200 md:p-6",
          active ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0",
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Đóng form"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-700"
        >
          <X size={16} />
        </button>

        <h3 className="m-0 pr-12 text-2xl font-black tracking-tight text-slate-900">
          {meta.title}
        </h3>
        <p className="mt-2 pr-10 text-sm leading-relaxed text-slate-600">
          {meta.desc}
        </p>

        <div className="mt-5">
          <ContactForm
            type={type}
            onCancel={onClose}
            onSuccess={onSubmitSuccess}
          />
        </div>
      </div>
    </div>
  );
}
