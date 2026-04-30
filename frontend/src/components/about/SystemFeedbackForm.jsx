import { LockKeyhole, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getMySystemFeedback,
  upsertSystemFeedback,
} from "../../api/systemFeedbackApi";
import StarRating from "../blog/StarRating";
import { useAuth } from "../../providers/AuthProvider";

function getFriendlyError(error) {
  const message = error?.message || "";
  const code = error?.code || "";

  if (code === "permission-denied" || message.toLowerCase().includes("permission")) {
    return "Không thể lưu đánh giá. Vui lòng kiểm tra quyền Firestore.";
  }

  return message || "Không thể lưu đánh giá hệ thống.";
}

export default function SystemFeedbackForm({ onSubmitted }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hasFeedback, setHasFeedback] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setRating(0);
      setComment("");
      setHasFeedback(false);
      return;
    }

    let active = true;
    setLoadingMine(true);
    setError("");

    getMySystemFeedback(user.uid)
      .then((feedback) => {
        if (!active) return;
        setHasFeedback(Boolean(feedback));
        setRating(Number(feedback?.rating || 0));
        setComment(feedback?.comment || "");
      })
      .catch((nextError) => {
        if (active) setError(getFriendlyError(nextError));
      })
      .finally(() => {
        if (active) setLoadingMine(false);
      });

    return () => {
      active = false;
    };
  }, [user?.uid]);

  const openLogin = () => {
    navigate("/login", { state: { from: location } });
  };

  const submitFeedback = async (event) => {
    event.preventDefault();

    if (!user) {
      openLogin();
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await upsertSystemFeedback(
        {
          ...user,
          displayName: user.displayName || profile?.displayName || user.email,
        },
        {
          rating,
          comment,
        }
      );
      setHasFeedback(true);
      setSuccess("Cảm ơn bạn đã đánh giá hệ thống.");
      await onSubmitted?.();
    } catch (nextError) {
      setError(getFriendlyError(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-3xl border border-white/70 bg-white p-6 shadow-soft">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h3 className="mt-5 font-display text-2xl font-bold text-ink">
          Đăng nhập để đánh giá
        </h3>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          Bạn có thể xem đánh giá công khai. Để gửi cảm nhận của riêng mình, vui lòng đăng nhập bằng tài khoản Firebase.
        </p>
        <button type="button" className="btn-primary mt-5" onClick={openLogin}>
          Đăng nhập để đánh giá
        </button>
      </div>
    );
  }

  return (
    <form className="rounded-3xl border border-white/70 bg-white p-6 shadow-soft" onSubmit={submitFeedback}>
      <div className="text-sm font-bold uppercase tracking-[0.18em] text-brand-700">
        Đánh giá hệ thống
      </div>
      <h3 className="mt-3 font-display text-2xl font-bold text-ink">
        {hasFeedback ? "Cập nhật đánh giá của bạn" : "Chia sẻ cảm nhận của bạn"}
      </h3>

      <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <span className="text-sm font-semibold text-slate-700">Chọn điểm</span>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>

      <label className="mt-5 grid gap-2">
        <span className="text-sm font-semibold text-slate-700">Cảm nhận</span>
        <textarea
          className="input-base min-h-[150px] resize-y"
          maxLength={1000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Bạn thấy trải nghiệm tra cứu, đọc nguồn và hỏi AI như thế nào?"
          disabled={loadingMine || submitting}
        />
      </label>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>Feedback giúp nhóm cải thiện trải nghiệm và chất lượng nội dung.</span>
        <span>{comment.length}/1000</span>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {success}
        </div>
      ) : null}

      <button type="submit" className="btn-primary mt-5 w-full" disabled={loadingMine || submitting}>
        <Send className="h-4 w-4" />
        {submitting
          ? "Đang gửi..."
          : hasFeedback
            ? "Cập nhật đánh giá"
            : "Gửi đánh giá"}
      </button>
    </form>
  );
}
