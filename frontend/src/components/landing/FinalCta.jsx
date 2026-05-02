import { ArrowRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

export default function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[32px] bg-gradient-to-r from-brand-700 via-brand-600 to-mint-500 px-8 py-10 text-white shadow-float sm:px-10 lg:px-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-100">
              Bắt đầu ngay
            </div>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Sẵn sàng tra cứu tri thức sức khỏe?
            </h2>
            <p className="mt-4 text-sm leading-7 text-brand-50 sm:text-base">
              Tìm tài liệu, đọc nguồn tham khảo và dùng AI để hiểu nội dung nhanh hơn.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/search" className="btn-secondary border-white/20 bg-white text-brand-700 hover:bg-brand-50">
              Bắt đầu tìm kiếm
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/blog" className="btn-primary bg-brand-900 hover:bg-brand-950">
              <BookOpen className="h-4 w-4" />
              Xem blog y tế
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
