import React from "react";
import { Building2 } from "lucide-react";
import { USE_CASES } from "../../constants/landingData";
import SectionTitle from "./SectionTitle";
import SectionReveal from "./SectionReveal";

export default function UseCasesSection() {
  return (
    <section id="doi-tuong" className="scroll-mt-28 px-4 py-20 md:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionReveal>
          <SectionTitle
            badge="Đối tượng phù hợp"
            title="Ai nên triển khai SIMLESI AI?"
            desc="Phù hợp cho tổ chức cần quản trị tri thức tập trung và khai thác nhanh trong vận hành."
          />
        </SectionReveal>

        <SectionReveal className="mt-10">
          <div className="grid gap-4 md:grid-cols-2">
            {USE_CASES.map((item) => (
              <article key={item} className="flex gap-3 border-b border-slate-200/80 pb-4">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Building2 size={17} />
                </span>
                <p className="m-0 text-sm font-semibold leading-relaxed text-slate-700 md:text-base">{item}</p>
              </article>
            ))}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
