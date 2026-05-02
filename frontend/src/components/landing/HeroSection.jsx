import { ArrowRight, HeartPulse } from "lucide-react";
import { Link } from "react-router-dom";

export default function HeroSection({ onAskClick }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-sky-50 via-white to-emerald-50">
      <div className="pointer-events-none absolute -left-28 top-16 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-700 shadow-sm">
            <HeartPulse className="h-4 w-4" />
            Nền tảng tri thức sức khỏe đa nguồn
          </span>

          <h1 className="mt-7 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Tra cứu thông tin sức khỏe nhanh hơn, rõ nguồn hơn
          </h1>

          <p className="mt-6 text-base leading-8 text-slate-600 sm:text-lg">
            Hệ thống hỗ trợ tìm kiếm tài liệu bệnh học, tin tức y tế và nguồn tham khảo sức khỏe bằng ngữ nghĩa.
            Người dùng có thể tra cứu, đọc bài viết và hỏi AI dựa trên kho tri thức đã được cập nhật.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/search" className="btn-primary h-12 px-6 text-base sm:w-auto">
              Tìm kiếm tài liệu
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              className="btn-secondary h-12 px-6 text-base sm:w-auto"
              onClick={onAskClick}
            >
              Hỏi AI sức khỏe
            </button>
          </div>

          <p className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-800">
            Thông tin chỉ phục vụ tham khảo, không thay thế tư vấn, chẩn đoán hoặc điều trị từ bác sĩ/chuyên gia y tế.
          </p>
        </div>

        <div className="relative">
          <div
            className="relative overflow-hidden border border-white/80 bg-white shadow-2xl"
            style={{ borderRadius: "40px" }}
          >
            <img
              src="/dashb.jpg"
              alt="Minh họa hệ thống hỗ trợ tra cứu sức khỏe"
              className="aspect-[4/3] w-full object-cover object-center"
              style={{ borderRadius: "40px" }}
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-sky-950/20 via-transparent to-emerald-300/10" />
          </div>
        </div>
      </div>
    </section>
  );
}
