import { workflowSteps } from "../../data/features";
import SectionHeading from "../common/SectionHeading";

export default function WorkflowSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="rounded-[32px] border border-white/80 bg-white p-8 shadow-soft sm:p-10">
        <SectionHeading
          kicker="Cách sử dụng"
          title="Một quy trình đơn giản cho người cần tra cứu sức khỏe"
          description="Bắt đầu bằng tìm kiếm, đọc nguồn trước, sau đó dùng AI để hỗ trợ hiểu nội dung nhanh hơn."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-4">
          {workflowSteps.map((step, index) => (
            <div key={step.title} className="rounded-[26px] border border-slate-100 bg-slate-50 p-6">
              <div className="text-sm font-semibold text-brand-700">0{index + 1}</div>
              <h3 className="mt-4 font-display text-xl font-semibold text-ink">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
