const express = require("express");
const admin = require("firebase-admin");

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\-().\s]{8,25}$/;
const ALLOWED_TYPES = new Set(["consultation", "demo"]);
const CONTACT_COLLECTION =
  String(process.env.CONTACT_COLLECTION || "advisory").trim() || "advisory";

function normalizeText(value, maxLen = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function normalizeInterests(value) {
  if (!Array.isArray(value)) return [];
  const unique = [...new Set(value.map((item) => normalizeText(item, 64)).filter(Boolean))];
  return unique.slice(0, 10);
}

function validateContactPayload(payload = {}) {
  const type = ALLOWED_TYPES.has(payload.type) ? payload.type : "consultation";
  const fullName = normalizeText(payload.fullName, 120);
  const phone = normalizeText(payload.phone, 40);
  const email = normalizeText(payload.email, 120);
  const company = normalizeText(payload.company, 160);
  const message = normalizeText(payload.message, 4000);
  const usageScale = normalizeText(payload.usageScale, 300);
  const interests = normalizeInterests(payload.interests);

  const errors = {};

  if (!fullName) {
    errors.fullName = "fullName is required";
  }
  if (!phone && !email) {
    errors.contact = "phone or email is required";
  }
  if (phone && !PHONE_REGEX.test(phone)) {
    errors.phone = "phone format is invalid";
  }
  if (email && !EMAIL_REGEX.test(email)) {
    errors.email = "email format is invalid";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    data: {
      type,
      fullName,
      phone,
      email,
      company,
      message,
      interests,
      usageScale,
    },
  };
}

function getFirestoreDb() {
  if (!admin.apps.length) return null;
  return admin.firestore();
}

router.post("/", async (req, res) => {
  const result = validateContactPayload(req.body);
  if (!result.ok) {
    return res.status(400).json({
      ok: false,
      message: "Invalid contact payload",
      errors: result.errors,
    });
  }

  const db = getFirestoreDb();
  if (!db) {
    return res.status(500).json({
      ok: false,
      message: "Firebase Admin is not initialized",
    });
  }

  try {
    const createdAtISO = new Date().toISOString();
    const docRef = await db.collection(CONTACT_COLLECTION).add({
      source: "landing-form",
      userAgent: req.get("user-agent") || "",
      ip: req.ip || "",
      createdAtISO,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...result.data,
    });

    return res.status(201).json({
      ok: true,
      id: docRef.id,
      message: "Contact request received",
    });
  } catch (error) {
    console.error("[CONTACT] Failed to store advisory request:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to store advisory request",
    });
  }
});

module.exports = router;
module.exports.validateContactPayload = validateContactPayload;
