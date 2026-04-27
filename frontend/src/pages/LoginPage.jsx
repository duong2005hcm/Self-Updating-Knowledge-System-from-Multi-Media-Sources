import { AlertCircle, ArrowRight, KeyRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authReady, profile, signInWithEmail, signUpWithEmail, refreshClaims } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const redirectTarget = useMemo(() => {
    const redirect = new URLSearchParams(location.search).get("redirect");
    return redirect || (profile?.isAdmin ? "/admin" : "/ask");
  }, [location.search, profile?.isAdmin]);

  useEffect(() => {
    if (!profile) return;
    navigate(redirectTarget, { replace: true });
  }, [navigate, profile, redirectTarget]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    const email = form.email.trim();
    const password = form.password;
    const name = form.name.trim();

    if (!isEmail(email)) {
      setError("Email không hợp lệ.");
      return;
    }

    if (password.length < 6) {
      setError("Mật khẩu tối thiểu 6 ký tự.");
      return;
    }

    if (mode === "register" && name.length < 2) {
      setError("Tên hiển thị tối thiểu 2 ký tự.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(name, email, password);
      }
      await refreshClaims();
      navigate(redirectTarget, { replace: true });
    } catch (nextError) {
      setError(nextError.message || "Đăng nhập thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-shell py-10 pb-16">
      <div className="mx-auto max-w-5xl">
        <div className="glass-panel grid overflow-hidden lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-gradient-to-br from-brand-700 via-brand-600 to-mint-500 p-8 text-white sm:p-10">
            <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]">
              Firebase Auth
            </div>
            <h1 className="mt-6 font-display text-4xl font-bold tracking-tight">
              Đăng nhập để hỏi đáp trên kho tri thức
            </h1>
            <p className="mt-4 text-sm leading-8 text-brand-50">
              Các API như `POST /api/ask`, admin sources, ingest, governance và pipeline
              đều cần Firebase ID token thật. Frontend mới không còn dùng local auth
              giả.
            </p>
            <div className="mt-10 grid gap-4">
              <div className="rounded-[24px] bg-white/10 p-5">
                Hỏi AI grounded theo document retrieval và conversation id.
              </div>
              <div className="rounded-[24px] bg-white/10 p-5">
                Admin routes chỉ hoạt động khi token có custom claim `admin: true`.
              </div>
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <div className="flex gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                  mode === "login" ? "bg-white text-ink shadow-sm" : "text-slate-500"
                }`}
                onClick={() => setMode("login")}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                  mode === "register" ? "bg-white text-ink shadow-sm" : "text-slate-500"
                }`}
                onClick={() => setMode("register")}
              >
                Tạo tài khoản
              </button>
            </div>

            {!authReady ? (
              <div className="mt-6 rounded-[24px] border border-amber-100 bg-amber-50 p-5 text-sm leading-7 text-amber-800">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <AlertCircle className="h-4 w-4" />
                  Firebase client chưa được cấu hình
                </div>
                Hãy thêm các biến `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
                `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` trong môi trường
                frontend để kích hoạt login thật.
              </div>
            ) : null}

            <form className="mt-8 grid gap-4" onSubmit={submit}>
              {mode === "register" ? (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-700">Tên hiển thị</span>
                  <input
                    className="input-base"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Nguyen Van A"
                    disabled={!authReady || busy}
                  />
                </label>
              ) : null}

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Email</span>
                <input
                  className="input-base"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="user@example.com"
                  disabled={!authReady || busy}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Mật khẩu</span>
                <input
                  className="input-base"
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="••••••••"
                  disabled={!authReady || busy}
                />
              </label>

              {error ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <button type="submit" className="btn-primary" disabled={!authReady || busy}>
                <KeyRound className="h-4 w-4" />
                {busy
                  ? "Đang xử lý..."
                  : mode === "login"
                    ? "Đăng nhập"
                    : "Tạo tài khoản"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-6 text-sm text-slate-500">
              Cần quyền admin? Hãy gán custom claim `admin: true` cho user rồi đăng nhập
              lại để frontend lấy Firebase ID token mới.
            </div>

            <div className="mt-8">
              <Link to="/" className="text-sm font-semibold text-brand-700">
                Quay lại trang chủ
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
