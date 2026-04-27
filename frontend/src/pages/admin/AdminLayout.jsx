import { LayoutDashboard, Newspaper, ScanSearch, Settings2, ShieldCheck, Workflow } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../providers/AuthProvider";

const adminNav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/sources", label: "Sources", icon: Settings2 },
  { to: "/admin/documents", label: "Documents", icon: ShieldCheck },
  { to: "/admin/ingest", label: "Ingest", icon: ScanSearch },
  { to: "/admin/articles", label: "Articles", icon: Newspaper },
  { to: "/admin/pipeline", label: "Pipeline", icon: Workflow },
];

export default function AdminLayout() {
  const { profile, signOutUser } = useAuth();

  return (
    <div className="min-h-screen bg-surface">
      <div className="page-shell py-8">
        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
          <aside className="glass-panel h-fit p-5">
            <Link to="/" className="rounded-[24px] bg-gradient-to-br from-brand-700 via-brand-600 to-mint-500 p-5 text-white">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-100">
                Tri thức Sức khỏe
              </div>
              <div className="mt-3 font-display text-2xl font-bold">Admin Console</div>
              <div className="mt-2 text-sm text-brand-50">
                Quản trị nguồn, tài liệu, ingest và pipeline jobs.
              </div>
            </Link>

            <div className="mt-5 rounded-[24px] border border-slate-100 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-ink">{profile?.displayName}</div>
              <div className="mt-1 text-xs text-slate-500">{profile?.email}</div>
            </div>

            <nav className="mt-5 grid gap-2">
              {adminNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        isActive
                          ? "bg-brand-600 text-white shadow-float"
                          : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-6 grid gap-2">
              <Link to="/" className="btn-ghost justify-center">
                Về site public
              </Link>
              <button type="button" className="btn-secondary justify-center" onClick={signOutUser}>
                Đăng xuất
              </button>
            </div>
          </aside>

          <main className="space-y-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
