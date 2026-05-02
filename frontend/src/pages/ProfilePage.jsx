import { updateProfile } from "firebase/auth";
import { CalendarDays, Mail, Phone, Save, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserProfile, saveUserProfile } from "../api/userApi";
import LoadingState from "../components/common/LoadingState";
import { useAuth } from "../providers/AuthProvider";

function validateProfile(form) {
  if (form.displayName.trim().length > 100) {
    return "Họ và tên không quá 100 ký tự.";
  }
  if (form.phone && !/^[0-9+\s]{1,20}$/.test(form.phone.trim())) {
    return "Số điện thoại chỉ gồm số, dấu +, khoảng trắng và tối đa 20 ký tự.";
  }
  return "";
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    displayName: profile?.displayName || "",
    email: profile?.email || "",
    phone: "",
    birthDate: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    if (!user?.uid) return undefined;

    getUserProfile(user.uid)
      .then((data) => {
        if (!active) return;
        setForm({
          displayName: data?.display_name || profile?.displayName || "",
          email: user.email || "",
          phone: data?.phone || "",
          birthDate: data?.birth_date || "",
        });
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError.message || "Không thể tải thông tin người dùng.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [profile?.displayName, user?.email, user?.uid]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const validationError = validateProfile(form);
    setError(validationError);
    setSuccess("");
    if (validationError || !user) return;

    setSaving(true);
    try {
      const displayName = form.displayName.trim();
      await updateProfile(user, { displayName });
      await saveUserProfile(user.uid, {
        email: user.email,
        displayName,
        phone: form.phone.trim(),
        birthDate: form.birthDate,
      });
      await refreshProfile();
      setSuccess("Đã cập nhật thông tin.");
    } catch (nextError) {
      setError(nextError.message || "Không thể lưu thông tin người dùng.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell py-10">
        <LoadingState title="Đang tải thông tin người dùng" />
      </div>
    );
  }

  return (
    <div className="page-shell py-10 pb-16">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/70 bg-white p-6 shadow-soft sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <UserRound className="h-7 w-7" />
          </div>
          <div>
            <div className="section-kicker">Tài khoản</div>
            <h1 className="mt-3 font-display text-3xl font-bold text-ink">
              Thông tin người dùng
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Cập nhật hồ sơ cá nhân dùng trong hệ thống tri thức sức khỏe.
            </p>
          </div>
        </div>

        <form className="mt-8 grid gap-5" onSubmit={submit}>
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">Họ và tên</span>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input-base pl-11"
                value={form.displayName}
                onChange={(event) => setField("displayName", event.target.value)}
                placeholder="Nhập họ và tên"
              />
            </div>
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Ngày sinh</span>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input-base pl-11"
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => setField("birthDate", event.target.value)}
                />
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Số điện thoại</span>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input-base pl-11"
                  value={form.phone}
                  onChange={(event) => setField("phone", event.target.value)}
                  placeholder="+84 123 456 789"
                />
              </div>
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700">Email</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input-base pl-11" value={form.email} readOnly />
            </div>
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {success}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" className="btn-primary" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Đang lưu..." : "Lưu thông tin"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
              <X className="h-4 w-4" />
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
