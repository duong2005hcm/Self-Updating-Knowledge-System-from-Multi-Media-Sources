import { Mail, MapPin, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { useLocale } from "../../providers/LocaleProvider";

const quickLinks = [
  { to: "/", labelVi: "Trang chủ", labelEn: "Home" },
  { to: "/search", labelVi: "Tìm kiếm", labelEn: "Search" },
  { to: "/blog", labelVi: "Blog", labelEn: "Blog" },
  { to: "/faq", labelVi: "FAQ", labelEn: "FAQ" },
  { to: "/about", labelVi: "Giới thiệu", labelEn: "About" },
];

export default function Footer() {
  const { t } = useLocale();

  return (
    <footer className="border-t border-white/70 bg-white/80">
      <div className="page-shell grid gap-10 py-12 md:grid-cols-[1.3fr_0.7fr_0.8fr]">
        <div className="space-y-4">
          <div className="font-display text-2xl font-bold text-ink">Tri thức Sức khỏe</div>
          <p className="max-w-xl text-sm leading-7 text-slate-500">
            {t(
              "Nền tảng hỗ trợ tra cứu và hỏi đáp trên kho tri thức y tế đa nguồn, ưu tiên minh bạch nguồn tham khảo và cập nhật dữ liệu.",
              "A health knowledge platform for searching documents and asking grounded questions with transparent references."
            )}
          </p>
        </div>

        <div className="space-y-4">
          <div className="font-display text-lg font-semibold text-ink">
            {t("Menu nhanh", "Quick links")}
          </div>
          <div className="grid gap-3 text-sm text-slate-500">
            {quickLinks.map((item) => (
              <Link key={item.to} to={item.to} className="transition hover:text-brand-700">
                {t(item.labelVi, item.labelEn)}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="font-display text-lg font-semibold text-ink">Contact</div>
          <div className="grid gap-3 text-sm text-slate-500">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-brand-600" />
              <span>support@healthknowledge.vn</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-brand-600" />
              <span>0123 456 789</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-brand-600" />
              <span>Việt Nam</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
