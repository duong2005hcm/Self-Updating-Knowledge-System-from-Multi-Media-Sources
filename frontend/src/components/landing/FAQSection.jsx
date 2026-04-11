import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQS } from "../../data/landingData";
import SectionTitle from "./SectionTitle";
import SectionReveal from "./SectionReveal";

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="scroll-mt-28 px-4 py-20 md:px-6">
      <div className="mx-auto max-w-4xl">
        <SectionReveal>
          <SectionTitle
            badge="FAQ"
            title="Câu hỏi thường gặp"
            desc="Thông tin ngắn gọn để bạn đánh giá nhanh mức độ phù hợp của giải pháp."
          />
        </SectionReveal>

        <SectionReveal className="mt-8">
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200/80 bg-white/70">
            {FAQS.map((item, idx) => {
              const isOpen = idx === openIndex;
              return (
                <article key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? -1 : idx)}
                    className="flex w-full items-center justify-between gap-3 border-none bg-transparent px-5 py-4 text-left"
                  >
                    <span className="text-sm font-bold text-slate-900 md:text-base">{item.q}</span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-slate-500 transition ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && <p className="m-0 px-5 pb-5 text-sm leading-relaxed text-slate-600">{item.a}</p>}
                </article>
              );
            })}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
