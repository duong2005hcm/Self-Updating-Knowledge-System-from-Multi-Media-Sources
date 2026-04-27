import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { faqs } from "../../data/faqs";
import { cn } from "../../lib/utils";
import SectionHeading from "../common/SectionHeading";

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="page-shell py-12">
      <SectionHeading
        kicker="FAQ"
        title="Những câu hỏi người dùng thường đặt ra khi tra cứu sức khỏe"
        description="Phần FAQ định vị rõ vai trò của hệ thống: hỗ trợ tham khảo, minh bạch nguồn và cập nhật tri thức y tế có quản trị."
      />
      <div className="mt-10 grid gap-4">
        {faqs.map((item, index) => {
          const isOpen = index === openIndex;
          return (
            <div key={item.question} className="glass-panel overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
              >
                <span className="font-display text-lg font-semibold text-ink">
                  {item.question}
                </span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-slate-400 transition",
                    isOpen ? "rotate-180" : ""
                  )}
                />
              </button>
              {isOpen ? (
                <div className="border-t border-slate-100 px-6 py-5 text-sm leading-7 text-slate-500">
                  {item.answer}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
