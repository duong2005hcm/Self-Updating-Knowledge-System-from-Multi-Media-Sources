import {
  CalendarClock,
  CheckCircle2,
  FileText,
  LayoutDashboard,
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
import { Link, NavLink, Outlet } from "react-router-dom";
import AskAiPanel from "../../components/ask/AskAiPanel";
import Navbar from "../../components/layout/Navbar";
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

function AdminSidebar({ onNavigate }) {
  const { profile, signOutUser } = useAuth();

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-100 p-5">
        <Link
          to="/"
          onClick={onNavigate}
          className="block rounded-[24px] bg-gradient-to-br from-brand-700 via-brand-600 to-mint-500 p-5 text-white"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm">
            <img
              src="/logoIcare.png"
              alt="HealthCall"
              className="h-full w-full object-contain p-1"
            />
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-100">
            Tri thức Sức khỏe
          </div>
          <div className="mt-3 font-display text-2xl font-bold">Admin Console</div>
          <div className="mt-2 text-sm text-brand-50">
            Quản trị tri thức, vận hành pipeline và kiểm soát chất lượng.
          </div>
        </Link>

        <div className="mt-5 rounded-[24px] border border-slate-100 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-ink">{profile?.displayName}</div>
          <div className="mt-1 truncate text-xs text-slate-500">{profile?.email}</div>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-5">
          {adminGroups.map((group) => (
            <div key={group.label}>
              <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                {group.label}
              </div>
              <div className="grid gap-2">
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
                          "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
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

      <div className="border-t border-slate-100 p-4">
        <div className="grid gap-2">
          <Link to="/" onClick={onNavigate} className="btn-ghost justify-center">
            Về site public
          </Link>
          <button type="button" className="btn-secondary justify-center" onClick={signOutUser}>
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAskOpen, setIsAskOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-ink">
      <Navbar onAskClick={() => setIsAskOpen(true)} />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <aside className="z-40 hidden h-full w-72 shrink-0 overflow-hidden border-r border-slate-200 bg-white lg:block">
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

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="sticky top-0 z-30 border-b border-slate-200 bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
            <button
              type="button"
              className="btn-secondary px-4 py-2"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
              Menu quản trị
            </button>
          </div>
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
      <AskAiPanel open={isAskOpen} onClose={() => setIsAskOpen(false)} />
    </div>
  );
}
