import React from "react";
import { AlertTriangle } from "lucide-react";
import { PROBLEMS } from "../../data/landingData";
import SectionTitle from "./SectionTitle";
import SectionReveal from "./SectionReveal";

export default function ProblemsSection() {
  return (
    <section id="van-de" className="scroll-mt-28 px-4 py-20 md:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionReveal>
          <SectionTitle
            badge="Nỗi đau thực tế"
            title="Vấn đề doanh nghiệp đang gặp phải"
            desc="Tri thức nằm khắp nơi, khó truy xuất và khó kiểm chứng khiến vận hành mất tốc độ."
          />
        </SectionReveal>

        <SectionReveal className="mt-10">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            {PROBLEMS.map((item) => (
              <article
                key={item.title}
                className="group rounded-2xl border border-slate-200/80 bg-white/65 p-4 transition hover:border-blue-200 hover:bg-white"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                  <AlertTriangle size={18} />
                </div>
                <h3 className="m-0 text-base font-black text-slate-900">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.desc}</p>
              </article>
            ))}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
