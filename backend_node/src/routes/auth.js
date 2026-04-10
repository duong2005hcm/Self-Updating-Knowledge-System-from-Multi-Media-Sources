const express = require("express");
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const { verifyUserJwt } = require("../middleware/verifyUserJwt");

const router = express.Router();
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

function normalizeServiceAccount(serviceAccount) {
  if (typeof serviceAccount?.private_key === "string") {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }
  return serviceAccount;
}

function loadServiceAccountFromEnv() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return normalizeServiceAccount(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT.trim())
      );
    } catch (error) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT is not valid JSON: ${error.message}`);
    }
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!serviceAccountPath) {
    throw new Error(
      "Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH."
    );
  }

  try {
    const resolvedPath = path.resolve(serviceAccountPath);
    const raw = fs.readFileSync(resolvedPath, "utf8");
    return normalizeServiceAccount(JSON.parse(raw));
  } catch (error) {
    throw new Error(
      `Cannot read service account from FIREBASE_SERVICE_ACCOUNT_PATH/GOOGLE_APPLICATION_CREDENTIALS: ${error.message}`
    );
  }
}

if (!admin.apps.length) {
  try {
    const serviceAccount = loadServiceAccountFromEnv();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("[AUTH] Firebase Admin Ready");
  } catch (error) {
    console.error("[AUTH] Firebase Init Error:", error.message);
    throw error;
  }
}

const SECRET_KEY = process.env.JWT_SECRET || "ChuoiBiMatCuaBan123!";
const db = admin.firestore();

function verifyAdminJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      message: "Missing Authorization header. Expected: Bearer <Node JWT>.",
    });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    if (String(decoded?.role || "").toLowerCase() !== "admin") {
      return res.status(403).json({
        ok: false,
        message: "Forbidden: admin role is required.",
      });
    }

    req.authUser = {
      ...decoded,
      uid: decoded?.id || decoded?.uid || null,
    };
    return next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      message: `Unauthorized: ${error.message || "Invalid Node JWT"}`,
    });
  }
}

function parsePositiveInt(raw, fallbackValue, minValue, maxValue) {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallbackValue;
  return Math.min(maxValue, Math.max(minValue, parsed));
}

function safeDateFromValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value?.toDate === "function") {
    const converted = value.toDate();
    return Number.isNaN(converted?.getTime?.()) ? null : converted;
  }
  if (typeof value?.seconds === "number") {
    const converted = new Date(value.seconds * 1000);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  if (typeof value === "string" || typeof value === "number") {
    const converted = new Date(value);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  return null;
}

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: VIETNAM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const monthLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: VIETNAM_TIME_ZONE,
  month: "2-digit",
  year: "numeric",
});

function formatDateKeyVN(date) {
  return dateKeyFormatter.format(date);
}

function formatMonthLabelVN(date) {
  const parts = monthLabelFormatter.formatToParts(date);
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  return `${month}/${year}`;
}

function formatHourLabelVN(date) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: VIETNAM_TIME_ZONE,
    hour: "2-digit",
    hour12: false,
  }).format(date);
  return `${hour}:00`;
}

function formatWeekdayLabelVN(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: VIETNAM_TIME_ZONE,
    weekday: "short",
  }).format(date);
}

function formatMonthDayLabelVN(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VIETNAM_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value ?? "00";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  return `${day}/${month}`;
}

async function listAllAuthUsers() {
  const allUsers = [];
  let pageToken;

  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    allUsers.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  return allUsers;
}

function buildLoginPlan(period) {
  const now = new Date();

  if (period === "year") {
    const currentEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const previousStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 23, 1));

    const buckets = [];
    for (let i = 0; i < 12; i += 1) {
      const bucketStart = new Date(
        Date.UTC(currentStart.getUTCFullYear(), currentStart.getUTCMonth() + i, 1)
      );
      buckets.push({ label: formatMonthLabelVN(bucketStart), count: 0, start: bucketStart });
    }

    return {
      period: "year",
      buckets,
      currentStart,
      currentEnd,
      previousStart,
      previousEnd: currentStart,
      mapCurrentBucket(date) {
        const monthDelta =
          (date.getUTCFullYear() - currentStart.getUTCFullYear()) * 12 +
          (date.getUTCMonth() - currentStart.getUTCMonth());
        if (monthDelta < 0 || monthDelta >= 12) return -1;
        return monthDelta;
      },
    };
  }

  const config = {
    day: {
      bucketCount: 24,
      bucketMs: 60 * 60 * 1000,
      labelOf: formatHourLabelVN,
    },
    week: {
      bucketCount: 7,
      bucketMs: 24 * 60 * 60 * 1000,
      labelOf: formatWeekdayLabelVN,
    },
    month: {
      bucketCount: 30,
      bucketMs: 24 * 60 * 60 * 1000,
      labelOf: formatMonthDayLabelVN,
    },
  }[period] || {
    bucketCount: 24,
    bucketMs: 60 * 60 * 1000,
    labelOf: formatHourLabelVN,
  };

  const currentEnd = now;
  const currentStart = new Date(
    currentEnd.getTime() - config.bucketCount * config.bucketMs
  );
  const previousStart = new Date(
    currentStart.getTime() - config.bucketCount * config.bucketMs
  );

  const buckets = [];
  for (let i = 0; i < config.bucketCount; i += 1) {
    const bucketStart = new Date(currentStart.getTime() + i * config.bucketMs);
    buckets.push({
      label: config.labelOf(bucketStart),
      count: 0,
      start: bucketStart,
    });
  }

  return {
    period,
    buckets,
    currentStart,
    currentEnd,
    previousStart,
    previousEnd: currentStart,
    mapCurrentBucket(date) {
      const diff = date.getTime() - currentStart.getTime();
      if (diff < 0) return -1;
      const index = Math.floor(diff / config.bucketMs);
      if (index < 0 || index >= config.bucketCount) return -1;
      return index;
    },
  };
}

async function buildAuthSnapshot(currentStart, currentEnd, previousStart, previousEnd) {
  try {
    const authUsers = await listAllAuthUsers();
    let currentCount = 0;
    let previousCount = 0;

    for (const authUser of authUsers) {
      const lastSignIn = safeDateFromValue(authUser?.metadata?.lastSignInTime);
      if (!lastSignIn) continue;
      if (lastSignIn >= currentStart && lastSignIn < currentEnd) {
        currentCount += 1;
      } else if (lastSignIn >= previousStart && lastSignIn < previousEnd) {
        previousCount += 1;
      }
    }

    return {
      totalAuthUsers: authUsers.length,
      lastSignInInCurrentPeriod: currentCount,
      lastSignInInPreviousPeriod: previousCount,
    };
  } catch (error) {
    return { error: error.message || String(error) };
  }
}

async function writeUsageLog({ eventType, uid, tokens = 0, extra = {} }) {
  const numericTokens = Math.max(0, Math.floor(Number(tokens) || 0));
  const payload = {
    eventType,
    uid: uid || null,
    tokens: numericTokens,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...extra,
  };

  await db.collection("usage_logs").add(payload);

  if (uid && numericTokens > 0) {
    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          totalTokens: admin.firestore.FieldValue.increment(numericTokens),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }
}

router.post("/firebase-verify", async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ ok: false, message: "Missing idToken" });
  }

  try {
    const decodedFirebaseToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedFirebaseToken.uid;
    const email = decodedFirebaseToken.email || "";
    const provider = decodedFirebaseToken.firebase?.sign_in_provider || "unknown";

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    const userData = {
      id: uid,
      email,
      name: decodedFirebaseToken.name || "User",
      role: decodedFirebaseToken.admin === true ? "admin" : "user",
    };

    if (userDoc.exists) {
      const data = userDoc.data();
      userData.name = data.displayName || data.name || userData.name;
      if (decodedFirebaseToken.admin !== true) {
        userData.role = data.role || data.Role || "user";
      }

      await userRef.set(
        {
          email,
          displayName: userData.name,
          role: userData.role,
          lastLogin: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      await userRef.set({
        email,
        displayName: userData.name,
        role: userData.role,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await db.collection("login_events").add({
      uid,
      email,
      provider,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isAdmin: decodedFirebaseToken.admin === true,
    });

    const token = jwt.sign(userData, SECRET_KEY, { expiresIn: "7d" });
    console.log(`Login: ${email || uid} | Role: ${userData.role}`);

    return res.json({ ok: true, user: userData, token });
  } catch (error) {
    console.error("Verify Error:", error);
    return res.status(401).json({ ok: false, message: "Authentication failed" });
  }
});

router.get("/admin/users", verifyAdminJwt, async (req, res) => {
  try {
    const [firestoreUsersSnapshot, authUsers] = await Promise.all([
      db.collection("users").get(),
      listAllAuthUsers(),
    ]);

    const authMap = new Map(authUsers.map((u) => [u.uid, u]));
    const users = [];

    firestoreUsersSnapshot.forEach((doc) => {
      const data = doc.data() || {};
      const authUser = authMap.get(doc.id);
      const authClaims = authUser?.customClaims || {};
      const mergedRole = authClaims.admin === true ? "admin" : data.role || "user";

      users.push({
        id: doc.id,
        ...data,
        email: data.email || authUser?.email || "",
        displayName: data.displayName || data.name || authUser?.displayName || "",
        role: mergedRole,
        authCreationTime: authUser?.metadata?.creationTime || null,
        authLastSignInTime: authUser?.metadata?.lastSignInTime || null,
        authProviders: Array.isArray(authUser?.providerData)
          ? authUser.providerData.map((p) => p.providerId).filter(Boolean)
          : [],
      });

      authMap.delete(doc.id);
    });

    for (const [uid, authUser] of authMap.entries()) {
      const authClaims = authUser?.customClaims || {};
      users.push({
        id: uid,
        email: authUser?.email || "",
        displayName: authUser?.displayName || "",
        role: authClaims.admin === true ? "admin" : "user",
        authCreationTime: authUser?.metadata?.creationTime || null,
        authLastSignInTime: authUser?.metadata?.lastSignInTime || null,
        authProviders: Array.isArray(authUser?.providerData)
          ? authUser.providerData.map((p) => p.providerId).filter(Boolean)
          : [],
      });
    }

    return res.json({ ok: true, users });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to get users",
      detail: error.message,
    });
  }
});

router.put("/admin/users/:id", verifyAdminJwt, async (req, res) => {
  const { id } = req.params;
  const { role, displayName, email } = req.body || {};

  if (!role && !displayName && !email) {
    return res.status(400).json({ ok: false, message: "Nothing to update" });
  }

  try {
    const firestoreUpdates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const authUpdates = {};

    if (typeof displayName === "string") {
      firestoreUpdates.displayName = displayName.trim();
      authUpdates.displayName = displayName.trim();
    }

    if (typeof email === "string" && email.trim()) {
      firestoreUpdates.email = email.trim();
      authUpdates.email = email.trim();
    }

    let normalizedRole;
    if (typeof role === "string") {
      normalizedRole = role.toLowerCase() === "admin" ? "admin" : "user";
      firestoreUpdates.role = normalizedRole;
    }

    if (Object.keys(authUpdates).length > 0) {
      await admin.auth().updateUser(id, authUpdates);
    }

    if (normalizedRole) {
      const userRecord = await admin.auth().getUser(id);
      const nextClaims = {
        ...(userRecord.customClaims || {}),
        admin: normalizedRole === "admin",
      };
      await admin.auth().setCustomUserClaims(id, nextClaims);
    }

    await db.collection("users").doc(id).set(firestoreUpdates, { merge: true });

    return res.json({ ok: true, message: "Updated successfully" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Update failed",
      detail: error.message,
    });
  }
});

router.delete("/admin/users/:id", verifyAdminJwt, async (req, res) => {
  const { id } = req.params;

  try {
    const chatsCollection = db.collection("users").doc(id).collection("chats");
    const chatsSnapshot = await chatsCollection.get();
    await Promise.all(chatsSnapshot.docs.map((doc) => doc.ref.delete()));

    await Promise.allSettled([
      db.collection("users").doc(id).delete(),
      admin.auth().deleteUser(id),
    ]);

    return res.json({ ok: true, message: "User deleted" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Delete failed",
      detail: error.message,
    });
  }
});

router.post("/admin/users", verifyAdminJwt, async (req, res) => {
  const { email, password, role, displayName } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      ok: false,
      message: "email and password are required",
    });
  }

  const normalizedRole = typeof role === "string" && role.toLowerCase() === "admin"
    ? "admin"
    : "user";

  try {
    const authUser = await admin.auth().createUser({
      email: String(email).trim(),
      password: String(password),
      displayName: typeof displayName === "string" ? displayName.trim() : "",
    });

    if (normalizedRole === "admin") {
      await admin.auth().setCustomUserClaims(authUser.uid, { admin: true });
    }

    await db.collection("users").doc(authUser.uid).set({
      email: String(email).trim(),
      displayName: typeof displayName === "string" ? displayName.trim() : "",
      role: normalizedRole,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.authUser?.uid || null,
    });

    return res.json({ ok: true, id: authUser.uid });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Create user failed",
      detail: error.message,
    });
  }
});

router.get("/admin/stats", verifyAdminJwt, async (req, res) => {
  try {
    const [usersSnapshot, usageSnapshot] = await Promise.all([
      db.collection("users").get(),
      db.collection("usage_logs").get(),
    ]);

    let totalTokens = 0;
    let totalQuestions = 0;

    usageSnapshot.forEach((doc) => {
      const data = doc.data() || {};
      const tokens = Number(data.tokens) || 0;
      if (tokens > 0) {
        totalTokens += tokens;
      }
      if (data.eventType === "question_asked") {
        totalQuestions += 1;
      }
    });

    return res.json({
      ok: true,
      userCount: usersSnapshot.size,
      totalTokens,
      totalQuestions,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to load stats",
      detail: error.message,
    });
  }
});

router.get("/admin/stats/login-analytics", verifyAdminJwt, async (req, res) => {
  const period = ["day", "week", "month", "year"].includes(req.query.period)
    ? req.query.period
    : "day";

  try {
    const plan = buildLoginPlan(period);

    const loginSnapshot = await db
      .collection("login_events")
      .where("createdAt", ">=", plan.previousStart)
      .where("createdAt", "<", plan.currentEnd)
      .get();

    let previousTotal = 0;

    loginSnapshot.forEach((doc) => {
      const data = doc.data() || {};
      const eventDate =
        safeDateFromValue(data.createdAt) ||
        safeDateFromValue(data.timestamp) ||
        safeDateFromValue(data.ts);

      if (!eventDate) return;

      if (eventDate >= plan.currentStart && eventDate < plan.currentEnd) {
        const bucketIndex = plan.mapCurrentBucket(eventDate);
        if (bucketIndex >= 0) {
          plan.buckets[bucketIndex].count += 1;
        }
      } else if (eventDate >= plan.previousStart && eventDate < plan.previousEnd) {
        previousTotal += 1;
      }
    });

    const total = plan.buckets.reduce((acc, bucket) => acc + bucket.count, 0);
    const delta = total - previousTotal;
    const deltaPercent = previousTotal > 0
      ? Number(((delta / previousTotal) * 100).toFixed(2))
      : null;
    const activeBuckets = plan.buckets.filter((bucket) => bucket.count > 0);

    const authSnapshot = await buildAuthSnapshot(
      plan.currentStart,
      plan.currentEnd,
      plan.previousStart,
      plan.previousEnd
    );

    return res.json({
      ok: true,
      period,
      total,
      previousTotal,
      delta,
      deltaPercent,
      averagePerBucket: Number((total / plan.buckets.length).toFixed(2)),
      averageActiveBuckets: activeBuckets.length
        ? Number((total / activeBuckets.length).toFixed(2))
        : 0,
      buckets: plan.buckets.map(({ label, count }) => ({ label, count })),
      authSnapshot,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to build login analytics",
      detail: error.message,
    });
  }
});

router.get("/admin/stats/token-daily", verifyAdminJwt, async (req, res) => {
  const days = parsePositiveInt(req.query.days, 14, 1, 90);

  try {
    const now = new Date();
    const start = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    const usageSnapshot = await db
      .collection("usage_logs")
      .where("createdAt", ">=", start)
      .get();

    const totalsByDate = new Map();

    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      totalsByDate.set(formatDateKeyVN(date), 0);
    }

    usageSnapshot.forEach((doc) => {
      const data = doc.data() || {};
      const eventDate = safeDateFromValue(data.createdAt);
      if (!eventDate) return;

      const tokens = Number(data.tokens) || 0;
      if (tokens <= 0) return;

      const dateKey = formatDateKeyVN(eventDate);
      if (!totalsByDate.has(dateKey)) return;

      totalsByDate.set(dateKey, totalsByDate.get(dateKey) + tokens);
    });

    const rows = [];
    let previousValue = null;

    for (const [date, tokens] of totalsByDate.entries()) {
      const delta = previousValue == null ? null : tokens - previousValue;
      rows.push({ date, tokens, delta });
      previousValue = tokens;
    }

    return res.json({ ok: true, rows });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to load token daily",
      detail: error.message,
    });
  }
});

router.get("/admin/stats/ingest-daily", verifyAdminJwt, async (req, res) => {
  const days = parsePositiveInt(req.query.days, 14, 1, 120);

  try {
    const now = new Date();
    const start = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    const usageSnapshot = await db
      .collection("usage_logs")
      .where("createdAt", ">=", start)
      .get();

    const rowsMap = new Map();
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      rowsMap.set(formatDateKeyVN(date), {
        date: formatDateKeyVN(date),
        total: 0,
        pdf: 0,
        web: 0,
      });
    }

    usageSnapshot.forEach((doc) => {
      const data = doc.data() || {};
      const type = String(data.eventType || "");
      if (type !== "admin_ingest_pdf" && type !== "admin_ingest_web") return;

      const eventDate = safeDateFromValue(data.createdAt);
      if (!eventDate) return;

      const key = formatDateKeyVN(eventDate);
      const row = rowsMap.get(key);
      if (!row) return;

      row.total += 1;
      if (type === "admin_ingest_pdf") row.pdf += 1;
      if (type === "admin_ingest_web") row.web += 1;
    });

    const rows = Array.from(rowsMap.values());
    const summary = rows.reduce(
      (acc, row) => {
        acc.total += row.total;
        acc.pdf += row.pdf;
        acc.web += row.web;
        return acc;
      },
      { total: 0, pdf: 0, web: 0 }
    );

    return res.json({ ok: true, days, rows, summary });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to load ingest activity",
      detail: error.message,
    });
  }
});

router.get("/admin/users/:id/chats", verifyAdminJwt, async (req, res) => {
  const { id } = req.params;

  try {
    const chatsCollection = db.collection("users").doc(id).collection("chats");
    const snapshotDoc = await chatsCollection.doc("snapshot").get();

    if (snapshotDoc.exists) {
      return res.json({ ok: true, chats: snapshotDoc.data() });
    }

    const chatsDocs = await chatsCollection.get();
    const conversations = [];

    chatsDocs.forEach((doc) => {
      const data = doc.data() || {};
      if (Array.isArray(data.conversations)) {
        data.conversations.forEach((conversation, index) => {
          conversations.push({
            id: conversation.id || `${doc.id}-${index}`,
            ...conversation,
          });
        });
      } else {
        conversations.push({
          id: data.id || doc.id,
          title: data.title || "Chat",
          messages: Array.isArray(data.messages) ? data.messages : [],
        });
      }
    });

    return res.json({
      ok: true,
      chats: {
        conversations,
        activeId: null,
        updatedAt: null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to load user chats",
      detail: error.message,
    });
  }
});

router.post("/admin/users/:id/reset-password", verifyAdminJwt, async (req, res) => {
  const { id } = req.params;
  const requestedPassword = typeof req.body?.password === "string"
    ? req.body.password
    : "11111111";
  const newPassword = requestedPassword.trim() || "11111111";

  if (newPassword.length < 6) {
    return res.status(400).json({
      ok: false,
      message: "Password must be at least 6 characters",
    });
  }

  try {
    await admin.auth().updateUser(id, { password: newPassword });

    await db.collection("usage_logs").add({
      eventType: "password_reset",
      targetUid: id,
      performedBy: req.authUser?.uid || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ ok: true, message: "Password reset successfully" });
  } catch (error) {
    const statusCode = error?.code === "auth/user-not-found" ? 404 : 500;
    return res.status(statusCode).json({
      ok: false,
      message: "Reset password failed",
      detail: error.message,
    });
  }
});

router.post("/log-tokens", verifyUserJwt, async (req, res) => {
  const tokens = Math.max(0, Math.floor(Number(req.body?.tokens) || 0));
  if (tokens <= 0) {
    return res.status(400).json({ ok: false, message: "tokens must be > 0" });
  }

  try {
    const uid = req.firebaseUid || null;

    await writeUsageLog({
      eventType: "token_usage",
      uid,
      tokens,
      extra: {
        source: req.body?.source || "frontend",
      },
    });

    return res.json({ ok: true, tokens });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to log tokens",
      detail: error.message,
    });
  }
});

router.post("/log-question", verifyUserJwt, async (req, res) => {
  try {
    const uid = req.firebaseUid || null;

    await writeUsageLog({
      eventType: "question_asked",
      uid,
      tokens: 0,
      extra: {
        source: req.body?.source || "frontend",
      },
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to log question",
      detail: error.message,
    });
  }
});

router.post("/user/chats/sync", verifyUserJwt, async (req, res) => {
  try {
    const targetUid = req.firebaseUid;
    if (!targetUid) {
      return res.status(400).json({
        ok: false,
        message: "uid or userId is required",
      });
    }

    const payload = req.body?.chats && typeof req.body.chats === "object"
      ? req.body.chats
      : req.body;

    const conversations = Array.isArray(payload?.conversations)
      ? payload.conversations
      : [];

    const activeId =
      payload?.activeId == null
        ? null
        : String(payload.activeId);

    await db
      .collection("users")
      .doc(targetUid)
      .collection("chats")
      .doc("snapshot")
      .set(
        {
          conversations,
          activeId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          syncedBy: req.firebaseUid || null,
        },
        { merge: true }
      );

    await writeUsageLog({
      eventType: "chat_sync",
      uid: targetUid,
      tokens: 0,
      extra: {
        syncedBy: req.firebaseUid || null,
        conversationCount: conversations.length,
      },
    });

    return res.json({
      ok: true,
      chats: {
        conversations,
        activeId,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Failed to sync user chats",
      detail: error.message,
    });
  }
});

module.exports = { router, verifyAdminJwt };
