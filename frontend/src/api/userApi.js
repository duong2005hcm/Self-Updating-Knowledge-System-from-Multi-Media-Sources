import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "../auth/firebase";

function getDbOrThrow() {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error("Firestore chưa được cấu hình.");
  }
  return db;
}

export async function getUserProfile(uid) {
  if (!uid) return null;
  const db = getDbOrThrow();
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveUserProfile(uid, payload) {
  if (!uid) throw new Error("Thiếu user id.");
  const db = getDbOrThrow();
  const data = {
    uid,
    email: payload.email || "",
    display_name: payload.displayName || "",
    phone: payload.phone || "",
    birth_date: payload.birthDate || "",
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, "users", uid), data, { merge: true });
  return data;
}
