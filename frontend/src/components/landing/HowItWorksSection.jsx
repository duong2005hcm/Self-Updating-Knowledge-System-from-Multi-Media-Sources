import React from "react";
import { WORKFLOW_STEPS } from "../../constants/landingData";
import SectionTitle from "./SectionTitle";
import SectionReveal from "./SectionReveal";

export default function HowItWorksSection() {
  return (
    <section id="quy-trinh" className="scroll-mt-28 px-4 py-20 md:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionReveal>
          <SectionTitle
            badge="Quy trình"
            title="Cách hệ thống hoạt động"
            desc="Luồng xử lý 4 bước rõ ràng, dễ mở rộng và phù hợp triển khai doanh nghiệp."
          />
        </SectionReveal>

        <SectionReveal className="mt-10">
          <div className="hidden lg:block">
            <div className="relative grid grid-cols-4 gap-6">
              <div className="absolute left-2 right-2 top-7 h-px bg-gradient-to-r from-blue-200 via-indigo-200 to-blue-200" />
              {WORKFLOW_STEPS.map((item, index) => (
                <article key={item.title} className="relative">
                  <div className="relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-full border border-blue-200 bg-white text-lg font-black text-blue-700">
                    {index + 1}
                  </div>
                  <h3 className="mt-5 text-base font-black leading-snug text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-8 border-l border-blue-200 pl-6 lg:hidden">
            {WORKFLOW_STEPS.map((item, index) => (
              <article key={item.title} className="relative">
                <span className="absolute -left-[38px] top-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-white text-xs font-black text-blue-700">
                  {index + 1}
                </span>
                <h3 className="m-0 text-base font-black leading-snug text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
              </article>
            ))}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
