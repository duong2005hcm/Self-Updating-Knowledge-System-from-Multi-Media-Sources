import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareHeart,
  Newspaper,
  ScanSearch,
  Settings2,
  ShieldCheck,
  Workflow,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";

const adminGroups = [
  {
    label: "DASHBOARD",
    items: [{ to: "/admin", label: "Tổng quan", icon: LayoutDashboard, end: true }],
  },
  {
    label: "KNOWLEDGE BASE",
    items: [
      { to: "/admin/sources", label: "Nguồn dữ liệu", icon: Settings2 },
      { to: "/admin/documents", label: "Danh sách tài liệu", icon: ShieldCheck },
      { to: "/admin/versions", label: "Quản lý phiên bản", icon: FileText },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { to: "/admin/ingest", label: "Nạp dữ liệu", icon: ScanSearch },
      { to: "/admin/pipeline", label: "Nhật ký Pipeline", icon: Workflow },
      { to: "/admin/schedules", label: "Lịch quét tự động", icon: CalendarClock },
    ],
  },
  {
    label: "QUALITY CONTROL",
    items: [
      { to: "/admin/approvals", label: "Phê duyệt tri thức", icon: CheckCircle2 },
      { to: "/admin/articles", label: "Bài viết", icon: Newspaper },
      { to: "/admin/feedback", label: "Feedback của người dùng", icon: MessageSquareHeart },
    ],
  },
];

const routeTitles = [
  { path: "/admin/sources", title: "Nguồn dữ liệu" },
  { path: "/admin/documents", title: "Danh sách tài liệu" },
  { path: "/admin/versions", title: "Quản lý phiên bản" },
  { path: "/admin/ingest", title: "Nạp dữ liệu" },
  { path: "/admin/pipeline", title: "Nhật ký Pipeline" },
  { path: "/admin/schedules", title: "Lịch quét tự động" },
  { path: "/admin/approvals", title: "Phê duyệt tri thức" },
  { path: "/admin/articles", title: "Bài viết" },
  { path: "/admin/feedback", title: "Feedback của người dùng" },
];

function getPageTitle(pathname) {
  return routeTitles.find((item) => pathname.startsWith(item.path))?.title || "Tổng quan";
}

function AdminSidebar({ onNavigate }) {
  const { profile, signOutUser } = useAuth();
  const navigate = useNavigate();

  const logout = async () => {
    await signOutUser();
    navigate("/");
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-brand-100">
          <img src="/logoIcare.png" alt="HealthCall" className="h-full w-full object-contain p-1" />
        </div>
        <div className="min-w-0">
          <div className="font-display text-base font-bold text-ink">Admin</div>
          <div className="truncate text-xs text-slate-500">Tri thức Sức khỏe</div>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="grid gap-4">
          {adminGroups.map((group) => (
            <div key={group.label}>
              <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {group.label}
              </div>
              <div className="grid gap-1.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition",
                          isActive
                            ? "border-sky-100 bg-sky-50 text-sky-700"
                            : "border-transparent text-slate-600 hover:border-brand-100 hover:bg-brand-50 hover:text-brand-700"
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="mb-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
          <div className="truncate text-sm font-semibold text-ink">{profile?.displayName || "Admin"}</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">{profile?.email}</div>
        </div>
        <div className="grid gap-2">
          <Link to="/" onClick={onNavigate} className="btn-ghost justify-center px-3 py-2">
            <Home className="h-4 w-4" />
            Về site public
          </Link>
          <button type="button" className="btn-secondary justify-center px-3 py-2" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminTopbar({ onOpenSidebar }) {
  const { profile, signOutUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = getPageTitle(location.pathname);

  const logout = async () => {
    await signOutUser();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white p-2 text-slate-700 shadow-sm lg:hidden"
          aria-label="Mở menu quản trị"
          onClick={onOpenSidebar}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Admin Console
          </div>
          <h1 className="truncate font-display text-base font-bold text-ink sm:text-lg">
            {pageTitle}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <Link to="/" className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-flex">
          Về site public
        </Link>
        <div className="hidden min-w-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 sm:block">
          <div className="max-w-36 truncate text-sm font-semibold text-ink">{profile?.displayName || "Admin"}</div>
          <div className="max-w-40 truncate text-xs text-slate-500">{profile?.email}</div>
        </div>
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
          aria-label="Đăng xuất"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-ink">
      <aside className="hidden h-screen w-72 shrink-0 overflow-hidden border-r border-slate-200 bg-white lg:block">
        <AdminSidebar />
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            aria-label="Đóng menu quản trị"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative h-full w-[min(86vw,320px)] overflow-hidden border-r border-slate-200 bg-white shadow-float">
            <div className="absolute right-3 top-3 z-10">
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white p-2 text-slate-700 shadow-sm"
                aria-label="Đóng menu quản trị"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      ) : null}

      <main className="h-screen min-w-0 flex-1 overflow-y-auto">
        <AdminTopbar onOpenSidebar={() => setSidebarOpen(true)} />
        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
