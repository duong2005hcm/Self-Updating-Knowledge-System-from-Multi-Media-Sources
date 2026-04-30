import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
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

function normalizeFeedback(snapshot) {
  const data = snapshot.data() || {};
  const articleRef = snapshot.ref?.parent?.parent;
  const articleId = articleRef?.id || data.article_id || "";
  return {
    id: snapshot.id,
    ...data,
    feedback_id: snapshot.id,
    article_id: articleId,
    user_id: data.user_id || snapshot.id,
    user_email: data.user_email || "",
    user_name: data.user_name || data.user_email || "Người dùng",
    rating: Number(data.rating || 0),
    comment: data.comment || "",
    status: data.status || "active",
    created_at: normalizeTimestamp(data.created_at),
    updated_at: normalizeTimestamp(data.updated_at),
    reviewed_at: normalizeTimestamp(data.reviewed_at),
    hidden_at: normalizeTimestamp(data.hidden_at),
  };
}

function normalizeArticle(snapshot) {
  if (!snapshot.exists()) return null;
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    title: data.title || data.name || "Bài viết không có tiêu đề",
    topic: data.topic || "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    status: data.status || "",
    visibility: data.visibility || "",
    source_type: data.source_type || "",
    updated_at: normalizeTimestamp(data.updated_at),
  };
}

function validateFeedbackPayload(payload) {
  const rating = Number(payload.rating);
  const comment = String(payload.comment || "").trim();

  if (Number.isNaN(rating) || rating < 0 || rating > 5) {
    throw new Error("Điểm đánh giá phải nằm trong khoảng 0 đến 5.");
  }

  if (comment.length > 1000) {
    throw new Error("Bình luận tối đa 1000 ký tự.");
  }

  if (rating === 0 && !comment) {
    throw new Error("Vui lòng chọn sao hoặc nhập phản hồi trước khi gửi.");
  }

  return { rating, comment };
}

export async function getArticleFeedbacks(articleId) {
  if (!articleId) return [];
  const db = getDbOrThrow();
  const feedbackRef = collection(db, "articles", articleId, "feedbacks");
  const feedbackQuery = query(feedbackRef, orderBy("updated_at", "desc"));
  const snapshots = await getDocs(feedbackQuery);
  return snapshots.docs
    .map(normalizeFeedback)
    .filter((item) => item.status !== "deleted");
}

export async function getMyArticleFeedback(articleId, uid) {
  if (!articleId || !uid) return null;
  const db = getDbOrThrow();
  const feedbackRef = doc(db, "articles", articleId, "feedbacks", uid);
  const snapshot = await getDoc(feedbackRef);
  return snapshot.exists() ? normalizeFeedback(snapshot) : null;
}

export async function upsertArticleFeedback(articleId, user, payload) {
  if (!articleId) throw new Error("Thiếu articleId.");
  if (!user?.uid) throw new Error("Bạn cần đăng nhập để gửi phản hồi.");

  const db = getDbOrThrow();
  const { rating, comment } = validateFeedbackPayload(payload);
  const feedbackRef = doc(db, "articles", articleId, "feedbacks", user.uid);
  const existing = await getDoc(feedbackRef);

  const nextData = {
    article_id: articleId,
    user_id: user.uid,
    user_email: user.email || "",
    user_name: user.displayName || user.email || "Người dùng",
    rating,
    comment,
    updated_at: serverTimestamp(),
    status: "active",
  };

  if (!existing.exists()) {
    nextData.created_at = serverTimestamp();
  }

  await setDoc(feedbackRef, nextData, { merge: true });
  const nextSnapshot = await getDoc(feedbackRef);
  return normalizeFeedback(nextSnapshot);
}

export async function getArticleFeedbacksForAdmin() {
  const db = getDbOrThrow();
  const snapshots = await getDocs(collectionGroup(db, "feedbacks"));
  const feedbackDocs = [...snapshots.docs].sort((a, b) => {
    const aData = a.data() || {};
    const bData = b.data() || {};
    const aTime = timestampToMillis(aData.updated_at || aData.created_at);
    const bTime = timestampToMillis(bData.updated_at || bData.created_at);
    return bTime - aTime;
  });
  const feedbacks = feedbackDocs.map(normalizeFeedback);
  const articleIds = Array.from(new Set(feedbacks.map((item) => item.article_id).filter(Boolean)));

  const articlePairs = await Promise.all(
    articleIds.map(async (articleId) => {
      const snapshot = await getDoc(doc(db, "articles", articleId));
      return [articleId, normalizeArticle(snapshot)];
    })
  );
  const articleMap = Object.fromEntries(articlePairs);

  return feedbacks.map((item) => {
    const article = articleMap[item.article_id];
    return {
      ...item,
      article,
      article_title: article?.title || "Bài viết không tồn tại",
      article_topic: article?.topic || "",
      article_tags: article?.tags || [],
    };
  });
}

export async function updateArticleFeedbackStatus(articleId, userId, status, adminUser) {
  if (!articleId || !userId) throw new Error("Thiếu articleId hoặc userId.");
  if (!["active", "reviewed", "hidden"].includes(status)) {
    throw new Error("Trạng thái feedback không hợp lệ.");
  }

  const db = getDbOrThrow();
  const feedbackRef = doc(db, "articles", articleId, "feedbacks", userId);
  const nextData = {
    status,
    updated_at: serverTimestamp(),
  };

  if (status === "reviewed") {
    nextData.reviewed_at = serverTimestamp();
    nextData.reviewed_by = adminUser?.uid || "";
  }

  if (status === "hidden") {
    nextData.hidden_at = serverTimestamp();
    nextData.hidden_by = adminUser?.uid || "";
  }

  await updateDoc(feedbackRef, nextData);
}
