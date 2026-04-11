import React from "react";
import { Quote } from "lucide-react";
import { TESTIMONIALS } from "../../constants/landingData";
import SectionTitle from "./SectionTitle";
import SectionReveal from "./SectionReveal";

export default function TestimonialsSection() {
  return (
    <section id="danh-gia" className="scroll-mt-28 px-4 py-20 md:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionReveal>
          <SectionTitle
            badge="Ph?n h?i khách hàng"
            title="Ðánh giá t? d?i ngu dã tr?i nghi?m"
            desc="M?t vài nh?n xét gi? l?p theo b?i c?nh tri?n khai th?c t? t?i doanh nghi?p."
          />
        </SectionReveal>

        <SectionReveal className="mt-10">
          <div className="grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <article key={item.name} className="rounded-2xl border border-slate-200/80 bg-white/70 p-5">
                <Quote size={18} className="text-blue-600" />
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.content}</p>
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="m-0 text-sm font-black text-slate-900">{item.name}</p>
                  <p className="m-0 mt-1 text-xs font-semibold text-slate-500">
                    {item.role} · {item.company}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}

