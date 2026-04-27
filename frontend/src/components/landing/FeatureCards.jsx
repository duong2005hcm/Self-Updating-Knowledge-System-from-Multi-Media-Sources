import {
  FileBadge,
  MessageSquareText,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { featureCards } from "../../data/features";
import SectionHeading from "../common/SectionHeading";

const iconMap = {
  Search,
  Network,
  RefreshCw,
  FileBadge,
  MessageSquareText,
  ShieldCheck,
};

export default function FeatureCards() {
  return (
    <section className="page-shell py-12">
      <SectionHeading
        kicker="Capabilities"
        title="Hệ thống được thiết kế để tra cứu trước, hỏi đáp sau"
        description="Mỗi thành phần giao diện bám đúng vai trò của backend hiện tại: tìm kiếm, đọc tài liệu, đối chiếu nguồn và quản trị pipeline."
      />
      <div className="card-grid mt-10">
        {featureCards.map((feature) => {
          const Icon = iconMap[feature.icon];
          return (
            <article key={feature.id} className="glass-panel p-6">
              <div className="inline-flex rounded-2xl bg-brand-50 p-3 text-brand-700">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold text-ink">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">{feature.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
