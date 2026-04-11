import React from "react";
import SectionReveal from "./SectionReveal";

export default function FinalCTASection({ onOpenContact }) {
  return (
    <section id="tu-van" className="scroll-mt-28 px-4 py-16 md:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionReveal>
          <div className="rounded-[30px] border border-blue-100 bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white shadow-soft md:p-10">
            <h2 className="m-0 max-w-3xl text-3xl font-black leading-tight tracking-tight md:text-4xl">
              Sẵn sàng xây dựng hệ thống tri thức AI cho doanh nghiệp của bạn?
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-blue-50 md:text-base">
              Bắt đầu với bản demo gọn, đo lường nhanh hiệu quả và mở rộng theo nhu cầu vận hành thực tế.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onOpenContact?.("consultation")}
                className="rounded-full bg-white px-6 py-3 text-sm font-extrabold text-blue-700 transition hover:bg-blue-50"
              >
                Đăng ký tư vấn
              </button>
              <button
                type="button"
                onClick={() => onOpenContact?.("demo")}
                className="rounded-full border border-white/60 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-white/10"
              >
                Xem demo
              </button>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
