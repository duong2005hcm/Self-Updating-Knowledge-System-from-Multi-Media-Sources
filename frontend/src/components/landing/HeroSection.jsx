import { ArrowRight, HeartPulse, ShieldAlert, Stethoscope } from "lucide-react";
import { Link } from "react-router-dom";
import { useLocale } from "../../providers/LocaleProvider";
import { cn } from "../../lib/utils";

const statusToneMap = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  degraded: "border-amber-200 bg-amber-50 text-amber-700",
  offline: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function HeroSection({ healthState }) {
  const { t } = useLocale();
  const tone = statusToneMap[healthState.status] || statusToneMap.degraded;

  return (
    <section className="page-shell py-8 pb-16 pt-10 lg:py-16">
      <div className="glass-panel overflow-hidden bg-hero-mesh p-8 sm:p-10 lg:p-14">
        <div className="hero-grid">
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="section-kicker">
                <HeartPulse className="h-4 w-4" />
                {t("Knowledge-first health retrieval", "Knowledge-first health retrieval")}
              </span>
              <div
                className={cn(
                  "status-pill",
                  tone
                )}
              >
                <Stethoscope className="h-4 w-4" />
                {healthState.label}
              </div>
            </div>

            <div className="space-y-6">
              <h1 className="max-w-4xl font-display text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
                Hệ thống tri thức Hỗ trợ tra cứu Sức khỏe
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-slate-600">
                Thu thập, chuẩn hóa và cập nhật tri thức y tế từ nhiều nguồn như tài
                liệu bệnh học, bài viết học thuật, tin tức y tế và báo cáo chuyên
                ngành. Hỗ trợ tìm kiếm tài liệu bằng ngữ nghĩa và tra cứu thông tin
                sức khỏe có nguồn tham khảo.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/search" className="btn-primary">
                Tìm kiếm tài liệu
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/blog" className="btn-secondary">
                Xem tin tức y tế
              </Link>
            </div>

            <div className="rounded-[26px] border border-amber-100 bg-amber-50/90 p-5 text-sm leading-7 text-amber-800">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-4 w-4" />
                Cảnh báo tham khảo
              </div>
              Thông tin trong hệ thống chỉ phục vụ tham khảo, không thay thế tư vấn,
              chẩn đoán hoặc điều trị từ bác sĩ/chuyên gia y tế.
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[28px] border border-white/80 bg-white/80 p-6 shadow-soft">
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-700">
                Retrieval snapshot
              </div>
              <div className="mt-5 grid gap-4">
                <div className="rounded-3xl bg-slate-50 p-5">
                  <div className="text-sm font-semibold text-ink">Tra cứu theo ngữ cảnh</div>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    Search mode `hybrid`, `semantic`, `keyword` được map trực tiếp với
                    backend và hiển thị snippet, score, domain, source.
                  </p>
                </div>
                <div className="rounded-3xl bg-brand-900 p-5 text-white">
                  <div className="text-sm font-semibold text-brand-100">
                    Knowledge workflow
                  </div>
                  <ul className="mt-3 grid gap-3 text-sm leading-7 text-brand-50">
                    <li>1. Ingest tài liệu và nguồn web.</li>
                    <li>2. Chuẩn hóa metadata, version, chunk.</li>
                    <li>3. Tìm kiếm tài liệu trước khi hỏi AI.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[24px] border border-brand-100 bg-white/80 p-5">
                <div className="text-sm font-semibold text-brand-700">Đa nguồn</div>
                <p className="mt-2 text-sm text-slate-500">PDF, web, bài viết học thuật, news.</p>
              </div>
              <div className="rounded-[24px] border border-mint-100 bg-white/80 p-5">
                <div className="text-sm font-semibold text-mint-700">Minh bạch nguồn</div>
                <p className="mt-2 text-sm text-slate-500">Ưu tiên hiển thị metadata và snippet.</p>
              </div>
              <div className="rounded-[24px] border border-sky-100 bg-white/80 p-5">
                <div className="text-sm font-semibold text-sky-700">Hỏi đáp grounded</div>
                <p className="mt-2 text-sm text-slate-500">Ask AI chỉ hoạt động sau lớp retrieval.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
