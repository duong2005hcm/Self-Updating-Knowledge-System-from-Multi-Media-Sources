import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "../auth/firebase";

function getDbOrThrow() {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error("Chưa cấu hình Firestore feedback.");
  }
  return db;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000).toISOString();
  return value;
}

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeSystemFeedback(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    feedback_id: data.feedback_id || snapshot.id,
    user_id: data.user_id || snapshot.id,
    user_email: data.user_email || "",
    user_name: data.user_name || data.user_email || "Người dùng",
    rating: Number(data.rating || 0),
    comment: data.comment || "",
    page: data.page || "about",
    status: data.status || "active",
    created_at: normalizeTimestamp(data.created_at),
    updated_at: normalizeTimestamp(data.updated_at),
  };
}

function validateSystemFeedback({ rating, comment }) {
  const nextRating = Number(rating);
  const nextComment = String(comment || "").trim();

  if (Number.isNaN(nextRating) || nextRating < 1 || nextRating > 5) {
    throw new Error("Vui lòng chọn điểm đánh giá từ 1 đến 5 sao.");
  }

  if (nextComment.length > 1000) {
    throw new Error("Cảm nhận tối đa 1000 ký tự.");
  }

  return {
    rating: nextRating,
    comment: nextComment,
  };
}

export async function getSystemFeedbacks() {
  const db = getDbOrThrow();
  const snapshots = await getDocs(collection(db, "system_feedbacks"));

  return snapshots.docs
    .filter((snapshot) => {
      const status = snapshot.data()?.status;
      return !status || status === "active";
    })
    .sort((a, b) => {
      const aData = a.data() || {};
      const bData = b.data() || {};
      const aTime = timestampToMillis(aData.updated_at || aData.created_at);
      const bTime = timestampToMillis(bData.updated_at || bData.created_at);
      return bTime - aTime;
    })
    .map(normalizeSystemFeedback);
}

export async function getMySystemFeedback(uid) {
  if (!uid) return null;
  const db = getDbOrThrow();
  const snapshot = await getDoc(doc(db, "system_feedbacks", uid));
  return snapshot.exists() ? normalizeSystemFeedback(snapshot) : null;
}

export async function upsertSystemFeedback(user, payload) {
  if (!user?.uid) throw new Error("Bạn cần đăng nhập để đánh giá.");

  const db = getDbOrThrow();
  const { rating, comment } = validateSystemFeedback(payload);
  const feedbackRef = doc(db, "system_feedbacks", user.uid);
  const oldSnapshot = await getDoc(feedbackRef);

  const data = {
    feedback_id: user.uid,
    user_id: user.uid,
    user_email: user.email || "",
    user_name: user.displayName || user.email || "Người dùng",
    rating,
    comment,
    page: "about",
    status: "active",
    updated_at: serverTimestamp(),
  };

  if (!oldSnapshot.exists()) {
    data.created_at = serverTimestamp();
  }

  await setDoc(feedbackRef, data, { merge: true });
  const nextSnapshot = await getDoc(feedbackRef);
  return normalizeSystemFeedback(nextSnapshot);
}
