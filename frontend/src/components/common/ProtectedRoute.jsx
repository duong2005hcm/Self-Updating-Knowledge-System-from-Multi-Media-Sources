import { ShieldAlert } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../providers/AuthProvider";
import LoadingState from "./LoadingState";

function AccessDenied() {
  return (
    <div className="min-h-screen bg-surface px-4 py-20">
      <div className="page-shell">
        <div className="glass-panel mx-auto flex max-w-2xl flex-col items-center gap-4 px-6 py-12 text-center">
          <div className="rounded-full bg-rose-50 p-4 text-rose-600">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-semibold text-ink">
              Tài khoản chưa có admin claim
            </h1>
            <p className="text-sm text-slate-500">
              Các route quản trị chỉ mở cho Firebase user có custom claim `admin: true`.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RequireAuth() {
  const { loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState title="Đang kiểm tra phiên đăng nhập" />;
  }

  if (!user) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate replace to={`/login?redirect=${encodeURIComponent(redirect)}`} />;
  }

  return <Outlet />;
}

export function RequireAdmin() {
  const { loading, user, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState title="Đang xác thực quyền quản trị" />;
  }

  if (!user) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate replace to={`/login?redirect=${encodeURIComponent(redirect)}`} />;
  }

  if (!profile?.isAdmin) {
    return <AccessDenied />;
  }

  return <Outlet />;
}
