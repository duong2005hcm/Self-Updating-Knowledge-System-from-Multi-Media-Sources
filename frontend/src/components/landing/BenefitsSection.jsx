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
            badge="Giá tr? nh?n du?c"
            title="L?i ích mang l?i cho doanh nghi?p"
            desc="T?p trung tang t?c v?n hành, tang d? chính xác và chu?n hóa tri th?c dùng chung."
          />
        </SectionReveal>

        <SectionReveal className="mt-10">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <h3 className="m-0 text-2xl font-black leading-tight text-slate-900 md:text-3xl">
                Tri th?c dúng, ngay th?i di?m c?n
              </h3>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                SIMLESI AI giúp d?i ngu truy c?p tri th?c nh?t quán, gi?m l?ch thông tin gi?a các phòng ban và rút ng?n
                dáng k? th?i gian x? lý các yêu c?u l?p l?i.
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

