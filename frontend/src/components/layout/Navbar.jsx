import {
  ChevronDown,
  Globe2,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquareText,
  Shield,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
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

function getDisplayName(profile) {
  return profile?.displayName || profile?.email?.split("@")[0] || "User";
}

function UserMenu({ profile, loading, onSignOut, onNavigate }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const displayName = getDisplayName(profile);
  const avatar = displayName.slice(0, 1).toUpperCase() || "U";

  useEffect(() => {
    function onClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function onEsc(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const goTo = (path) => {
    setOpen(false);
    onNavigate?.();
    navigate(path);
  };

  const signOut = async () => {
    setOpen(false);
    onNavigate?.();
    await onSignOut();
    navigate("/");
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="flex items-center gap-3 rounded-full border border-brand-100 bg-brand-50 px-3 py-2 text-left transition hover:bg-brand-100"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
          {avatar}
        </div>
        <div className="hidden min-w-0 sm:block">
          <div className="max-w-32 truncate text-sm font-semibold text-ink">
            {displayName}
          </div>
          <div className="max-w-40 truncate text-xs text-slate-500">{profile.email}</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-[80] mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
            onClick={() => goTo("/profile")}
            role="menuitem"
          >
            <User className="h-4 w-4" />
            Thông tin người dùng
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
            onClick={() => goTo("/change-password")}
            role="menuitem"
          >
            <LockKeyhole className="h-4 w-4" />
            Đổi mật khẩu
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-rose-600 transition hover:bg-red-50"
            onClick={signOut}
            disabled={loading}
            role="menuitem"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function Navbar({ onAskClick }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { locale, setLocale, t } = useLocale();
  const { profile, signOutUser, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-xl">
      <div className="page-shell flex h-20 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-float ring-1 ring-brand-100">
            <img
              src="/logoIcare.png"
              alt="HealthCall"
              className="h-full w-full object-contain p-1"
            />
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

          <button
            type="button"
            className="btn-ghost"
            onClick={onAskClick}
          >
            <MessageSquareText className="h-4 w-4" />
            {t("Hỏi AI", "Ask AI")}
          </button>

          {profile ? (
            <>
              {profile.isAdmin ? (
                <Link to="/admin" className="btn-secondary">
                  <Shield className="h-4 w-4" />
                  Admin
                </Link>
              ) : null}
              <UserMenu profile={profile} loading={loading} onSignOut={signOutUser} />
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
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setMobileOpen(false);
                    onAskClick?.();
                  }}
                >
                  {t("Hỏi đáp trên kho tri thức", "Knowledge chat")}
                </button>
                {profile.isAdmin ? (
                  <Link
                    to="/admin"
                    className="btn-secondary"
                    onClick={() => setMobileOpen(false)}
                  >
                    Admin dashboard
                  </Link>
                ) : null}
                <Link
                  to="/profile"
                  className="btn-ghost"
                  onClick={() => setMobileOpen(false)}
                >
                  <User className="h-4 w-4" />
                  Thông tin người dùng
                </Link>
                <Link
                  to="/change-password"
                  className="btn-ghost"
                  onClick={() => setMobileOpen(false)}
                >
                  <LockKeyhole className="h-4 w-4" />
                  Đổi mật khẩu
                </Link>
                <button
                  type="button"
                  className="btn-ghost border-rose-100 bg-rose-50 text-rose-600 hover:bg-red-50"
                  onClick={async () => {
                    setMobileOpen(false);
                    await signOutUser();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  {t("Đăng xuất", "Sign out")}
                </button>
              </div>
            ) : (
              <div className="grid gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setMobileOpen(false);
                    onAskClick?.();
                  }}
                >
                  {t("Hỏi AI", "Ask AI")}
                </button>
                <Link to="/login" className="btn-primary" onClick={() => setMobileOpen(false)}>
                  {t("Đăng nhập", "Sign in")}
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
