import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { LockKeyhole, Save, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

function mapPasswordError(error) {
  if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential") {
    return "Mật khẩu hiện tại không đúng.";
  }
  if (error?.code === "auth/requires-recent-login") {
    return "Vui lòng đăng nhập lại để đổi mật khẩu.";
  }
  if (error?.code === "auth/weak-password") {
    return "Mật khẩu mới quá yếu.";
  }
  return error?.message || "Không thể đổi mật khẩu.";
}

function validateForm(form) {
  if (!form.currentPassword) return "Vui lòng nhập mật khẩu hiện tại.";
  if (form.newPassword.length < 6) return "Mật khẩu mới tối thiểu 6 ký tự.";
  if (form.newPassword !== form.confirmPassword) return "Nhập lại mật khẩu mới không khớp.";
  if (form.currentPassword === form.newPassword) {
    return "Mật khẩu mới không được giống mật khẩu hiện tại.";
  }
  return "";
}

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isPasswordUser = user?.providerData?.some((provider) => provider.providerId === "password");

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSuccess("");
    const validationError = validateForm(form);
    setError(validationError);
    if (validationError || !user?.email) return;

    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, form.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, form.newPassword);
      setSuccess("Đổi mật khẩu thành công.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (nextError) {
      setError(mapPasswordError(nextError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell py-10 pb-16">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/70 bg-white p-6 shadow-soft sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <div>
            <div className="section-kicker">Bảo mật</div>
            <h1 className="mt-3 font-display text-3xl font-bold text-ink">
              Đổi mật khẩu
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Cập nhật mật khẩu cho tài khoản đăng nhập bằng email/password.
            </p>
          </div>
        </div>

        {!isPasswordUser ? (
          <div className="mt-8 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            Tài khoản hiện tại không dùng phương thức email/password hoặc không hỗ trợ đổi mật khẩu trực tiếp.
          </div>
        ) : (
          <form className="mt-8 grid gap-5" onSubmit={submit}>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Mật khẩu hiện tại</span>
              <input
                className="input-base"
                type="password"
                value={form.currentPassword}
                onChange={(event) => setField("currentPassword", event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Mật khẩu mới</span>
              <input
                className="input-base"
                type="password"
                value={form.newPassword}
                onChange={(event) => setField("newPassword", event.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Nhập lại mật khẩu mới</span>
              <input
                className="input-base"
                type="password"
                value={form.confirmPassword}
                onChange={(event) => setField("confirmPassword", event.target.value)}
                autoComplete="new-password"
              />
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
                {saving ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
                <X className="h-4 w-4" />
                Hủy
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
