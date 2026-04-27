import { ArrowRight, PhoneCall } from "lucide-react";
import { Link } from "react-router-dom";

export default function FinalCta() {
  return (
    <section className="page-shell py-14">
      <div className="overflow-hidden rounded-[32px] bg-gradient-to-r from-brand-700 via-brand-600 to-mint-500 px-8 py-10 text-white shadow-float sm:px-10 lg:px-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-100">
              Final CTA
            </div>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Sẵn sàng tra cứu tri thức sức khỏe?
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/search" className="btn-secondary border-white/20 bg-white text-brand-700 hover:bg-brand-50">
              Bắt đầu tra cứu
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="mailto:support@healthknowledge.vn" className="btn-primary bg-brand-900 hover:bg-brand-950">
              <PhoneCall className="h-4 w-4" />
              Liên hệ nhóm phát triển
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
