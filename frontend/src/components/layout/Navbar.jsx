import { Globe2, LogOut, Menu, MessageSquareText, Shield, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../providers/AuthProvider";
import { useLocale } from "../../providers/LocaleProvider";
import { cn } from "../../lib/utils";

const navigation = [
  { to: "/", labelVi: "Trang chủ", labelEn: "Home" },
  { to: "/search", labelVi: "Tìm kiếm tài liệu bệnh", labelEn: "Search" },
  { to: "/blog", labelVi: "Blog", labelEn: "Blog" },
  { to: "/faq", labelVi: "FAQ", labelEn: "FAQ" },
  { to: "/about", labelVi: "Giới thiệu", labelEn: "About" },
];

function NavItems({ onNavigate }) {
  const { t } = useLocale();

  return navigation.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "rounded-full px-4 py-2 text-sm font-semibold transition",
          isActive
            ? "bg-brand-600 text-white shadow-float"
            : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
        )
      }
    >
      {t(item.labelVi, item.labelEn)}
    </NavLink>
  ));
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { locale, setLocale, t } = useLocale();
  const { profile, signOutUser, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-xl">
      <div className="page-shell flex h-20 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 via-sky-500 to-mint-400 text-lg font-black text-white shadow-float">
            TK
          </div>
          <div>
            <div className="font-display text-base font-bold text-ink sm:text-lg">
              Tri thức Sức khỏe
            </div>
            <div className="text-xs text-slate-500">
              {t("Hỗ trợ tra cứu sức khỏe đa nguồn", "Multi-source health knowledge")}
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 lg:flex">
          <NavItems />
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <div className="rounded-full border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                locale === "vi" ? "bg-white text-ink shadow-sm" : "text-slate-500"
              )}
              onClick={() => setLocale("vi")}
            >
              VI
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                locale === "en" ? "bg-white text-ink shadow-sm" : "text-slate-500"
              )}
              onClick={() => setLocale("en")}
            >
              EN
            </button>
          </div>

          {profile ? (
            <>
              <Link to="/ask" className="btn-ghost">
                <MessageSquareText className="h-4 w-4" />
                {t("Hỏi AI", "Ask AI")}
              </Link>
              {profile.isAdmin ? (
                <Link to="/admin" className="btn-secondary">
                  <Shield className="h-4 w-4" />
                  Admin
                </Link>
              ) : null}
              <div className="flex items-center gap-3 rounded-full border border-brand-100 bg-brand-50 px-4 py-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {profile.displayName?.slice(0, 1)?.toUpperCase() || "U"}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">
                    {profile.displayName}
                  </div>
                  <div className="truncate text-xs text-slate-500">{profile.email}</div>
                </div>
                <button
                  type="button"
                  className="rounded-full p-2 text-slate-500 transition hover:bg-white hover:text-rose-600"
                  onClick={signOutUser}
                  disabled={loading}
                  aria-label="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <Link to="/login" className="btn-primary">
              {t("Đăng nhập", "Sign in")}
            </Link>
          )}
        </div>

        <button
          type="button"
          className="inline-flex rounded-full border border-slate-200 bg-white p-3 text-slate-700 lg:hidden"
          onClick={() => setMobileOpen((current) => !current)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-slate-100 bg-white/95 lg:hidden">
          <div className="page-shell flex flex-col gap-3 py-4">
            <div className="flex flex-wrap gap-2">
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <Globe2 className="h-4 w-4 text-brand-600" />
              <button
                type="button"
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  locale === "vi" ? "bg-white text-ink shadow-sm" : "text-slate-500"
                )}
                onClick={() => setLocale("vi")}
              >
                VI
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  locale === "en" ? "bg-white text-ink shadow-sm" : "text-slate-500"
                )}
                onClick={() => setLocale("en")}
              >
                EN
              </button>
            </div>
            {profile ? (
              <div className="flex flex-col gap-2">
                <Link to="/ask" className="btn-primary" onClick={() => setMobileOpen(false)}>
                  {t("Hỏi đáp trên kho tri thức", "Knowledge chat")}
                </Link>
                {profile.isAdmin ? (
                  <Link
                    to="/admin"
                    className="btn-secondary"
                    onClick={() => setMobileOpen(false)}
                  >
                    Admin dashboard
                  </Link>
                ) : null}
                <button type="button" className="btn-ghost" onClick={signOutUser}>
                  <LogOut className="h-4 w-4" />
                  {t("Đăng xuất", "Sign out")}
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn-primary" onClick={() => setMobileOpen(false)}>
                {t("Đăng nhập", "Sign in")}
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
