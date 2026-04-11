import React from "react";
import { CheckCircle2 } from "lucide-react";
import { SOLUTION_POINTS } from "../../constants/landingData";
import SectionTitle from "./SectionTitle";
import SectionReveal from "./SectionReveal";

const STACK = ["LangChain", "ChromaDB", "n8n", "OpenAI"];

export default function SolutionsSection() {
  return (
    <section id="giai-phap" className="scroll-mt-28 px-4 py-20 md:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionReveal>
          <SectionTitle
            badge="Gi?i pháp"
            title="SIMLESI AI gi?i quy?t nhu th? nào?"
            desc="M?t ki?n trúc AI SaaS g?n, chu?n và b?n v?ng cho qu?n tr? tri th?c doanh nghi?p."
          />
        </SectionReveal>

        <SectionReveal className="mt-10">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h3 className="m-0 text-2xl font-black leading-tight text-slate-900 md:text-3xl">
                T? d? li?u r?i r?c thành tri th?c có th? h?i dáp ngay
              </h3>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                SIMLESI AI t? ch?c l?i toàn b? d? li?u phân tán thành m?t lu?ng tri th?c th?ng nh?t.
                D? li?u du?c thu th?p, chu?n hóa, c?p nh?t d?nh k? và ph?c v? h?i dáp theo ng? c?nh.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {STACK.map((tech) => (
                  <span
                    key={tech}
                    className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-extrabold tracking-wide text-blue-700"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-200/80 border-y border-slate-200/70 bg-white/35">
              {SOLUTION_POINTS.map((item) => (
                <div key={item} className="flex gap-3 px-1 py-4">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-blue-600" />
                  <p className="m-0 text-sm font-semibold leading-relaxed text-slate-700 md:text-base">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}

