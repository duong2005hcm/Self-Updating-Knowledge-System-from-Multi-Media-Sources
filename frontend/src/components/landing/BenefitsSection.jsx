import React from "react";
import { Check } from "lucide-react";
import { BENEFITS, IMPACT_METRICS } from "../../constants/landingData";
import SectionTitle from "./SectionTitle";
import SectionReveal from "./SectionReveal";

export default function BenefitsSection() {
  return (
    <section id="loi-ich" className="scroll-mt-28 px-4 py-20 md:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionReveal>
          <SectionTitle
            badge="Giá trị nhận được"
            title="Lợi ích mang lại cho doanh nghiệp"
            desc="Tập trung tăng tốc vận hành, tăng độ chính xác và chuẩn hóa tri thức dùng chung."
          />
        </SectionReveal>

        <SectionReveal className="mt-10">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <h3 className="m-0 text-2xl font-black leading-tight text-slate-900 md:text-3xl">
                Tri thức đúng, ngay thời điểm cần
              </h3>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                SIMLESI AI giúp đội ngũ truy cập tri thức nhất quán, giảm lệch thông tin giữa các phòng ban và rút ngắn
                đáng kể thời gian xử lý các yêu cầu lặp lại.
              </p>

              <div className="mt-6 space-y-3">
                {BENEFITS.map((item) => (
                  <p key={item} className="m-0 flex items-start gap-2 text-sm font-semibold leading-relaxed text-slate-700">
                    <Check size={18} className="mt-0.5 shrink-0 text-blue-600" />
                    <span>{item}</span>
                  </p>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {IMPACT_METRICS.map((item) => (
                <article key={item.label} className="rounded-2xl border border-slate-200/80 bg-white/75 p-5 text-center">
                  <p className="m-0 text-3xl font-black text-blue-700">{item.value}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{item.label}</p>
                </article>
              ))}
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
