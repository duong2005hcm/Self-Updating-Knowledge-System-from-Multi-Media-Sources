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
            badge="Giải pháp"
            title="SIMLESI AI giải quyết như thế nào?"
            desc="Một kiến trúc AI SaaS gọn, chuẩn và bền vững cho quản trị tri thức doanh nghiệp."
          />
        </SectionReveal>

        <SectionReveal className="mt-10">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h3 className="m-0 text-2xl font-black leading-tight text-slate-900 md:text-3xl">
                Từ dữ liệu rời rạc thành tri thức có thể hỏi đáp ngay
              </h3>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                SIMLESI AI tổ chức lại toàn bộ dữ liệu phân tán thành một luồng tri thức thống nhất.
                Dữ liệu được thu thập, chuẩn hóa, cập nhật định kỳ và phục vụ hỏi đáp theo ngữ cảnh.
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
