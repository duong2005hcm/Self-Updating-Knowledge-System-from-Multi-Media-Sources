import {
  collection,
  doc,
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
    throw new Error("Chưa cấu hình Firestore chat feedback.");
  }
  return db;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000).toISOString();
  return value;
}

function normalizeChatFeedback(snapshot) {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    feedback_id: data.feedback_id || snapshot.id,
    ...data,
    created_at: normalizeTimestamp(data.created_at),
    updated_at: normalizeTimestamp(data.updated_at),
    reviewed_at: normalizeTimestamp(data.reviewed_at),
    hidden_at: normalizeTimestamp(data.hidden_at),
  };
}

function validatePayload(payload) {
  const question = String(payload.question || "").trim();
  const answer = String(payload.answer || "").trim();
  const comment = String(payload.comment || "").trim();

  if (!question || !answer) {
    throw new Error("Thiếu câu hỏi hoặc câu trả lời để lưu feedback.");
  }

  if (typeof payload.helpful !== "boolean") {
    throw new Error("Vui lòng chọn hữu ích hoặc chưa hữu ích.");
  }

  if (comment.length > 1000) {
    throw new Error("Góp ý tối đa 1000 ký tự.");
  }

  return {
    question,
    answer,
    comment,
    helpful: payload.helpful,
    rating:
      typeof payload.rating === "number" && payload.rating >= 0 && payload.rating <= 5
        ? payload.rating
        : null,
    conversation_id: String(payload.conversation_id || "").trim(),
    contexts_count: Number(payload.contexts_count || 0),
  };
}

export async function createChatFeedback(payload, user) {
  if (!user?.uid) throw new Error("Bạn cần đăng nhập để gửi feedback chatbox.");

  const db = getDbOrThrow();
  const normalized = validatePayload(payload);
  const feedbackRef = doc(collection(db, "chat_feedbacks"));
  const data = {
    feedback_id: feedbackRef.id,
    user_id: user.uid,
    user_email: user.email || "",
    user_name: user.displayName || user.email || "Người dùng",
    ...normalized,
    status: "active",
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(feedbackRef, data);
  return { ...data, id: feedbackRef.id };
}

export async function getChatFeedbacksForAdmin() {
  const db = getDbOrThrow();
  const feedbackQuery = query(collection(db, "chat_feedbacks"), orderBy("created_at", "desc"));
  const snapshots = await getDocs(feedbackQuery);
  return snapshots.docs.map(normalizeChatFeedback);
}

export async function updateChatFeedbackStatus(feedbackId, status, adminUser) {
  if (!feedbackId) throw new Error("Thiếu feedbackId.");
  if (!["active", "reviewed", "hidden"].includes(status)) {
    throw new Error("Trạng thái feedback chatbox không hợp lệ.");
  }

  const db = getDbOrThrow();
  const feedbackRef = doc(db, "chat_feedbacks", feedbackId);
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
