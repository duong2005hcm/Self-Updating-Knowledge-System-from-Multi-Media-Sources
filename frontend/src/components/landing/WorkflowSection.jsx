import { workflowSteps } from "../../data/features";
import SectionHeading from "../common/SectionHeading";

export default function WorkflowSection() {
  return (
    <section className="page-shell py-12">
      <div className="glass-panel p-8 sm:p-10">
        <SectionHeading
          kicker="Workflow"
          title="Từ nguồn dữ liệu thô đến hỗ trợ tra cứu có kiểm soát"
          description="Pipeline được thiết kế cho ingestion, chuẩn hóa, lưu trữ và truy xuất tài liệu trước khi AI tạo câu trả lời."
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
