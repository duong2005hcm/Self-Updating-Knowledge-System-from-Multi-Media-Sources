const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

// 1. Khởi tạo Firebase Admin
if (!admin.apps.length) {
    try {
        let serviceAccount;
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            let rawJson = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
            serviceAccount = JSON.parse(rawJson);
            if (typeof serviceAccount.private_key === 'string') {
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            }
        } else {
            const path = require('path');
            const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
            serviceAccount = require(serviceAccountPath);
        }
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ [AUTH] Firebase Admin Ready!");
    } catch (error) {
        console.error("❌ [AUTH] Firebase Init Error:", error.message);
    }
}

const SECRET_KEY = process.env.JWT_SECRET || "ChuoiBiMatCuaBan123!";
const db = admin.firestore();

// --- MIDDLEWARE KIỂM TRA ADMIN ---
const verifyAdmin = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Không có quyền truy cập" });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decodedToken = jwt.verify(token, SECRET_KEY);

        const userDoc = await db.collection('users').doc(decodedToken.id).get();

        if (userDoc.exists && userDoc.data().role === 'admin') {
            return next();
        }

        return res.status(403).json({ ok: false, message: "Yêu cầu quyền Admin" });

    } catch (error) {
        return res.status(401).json({ message: "Token không hợp lệ" });
    }
};

// --- ROUTES ---

// 1. Xác thực Firebase Token & Trả về thông tin kèm Role
router.post('/firebase-verify', async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ ok: false, message: "Thiếu idToken" });

    try {
        const decodedFirebaseToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedFirebaseToken.uid;
        const email = decodedFirebaseToken.email;

        // Tìm user trong Firestore
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        let userData = {
            id: uid,
            email: email,
            name: decodedFirebaseToken.name || "User",
            role: "user"
        };

        if (userDoc.exists) {
            const data = userDoc.data();
            userData.role = data.role || data.Role || "user";
            userData.name = data.displayName || data.name || userData.name;
        }

        // BẢO HIỂM: Nếu là email admin, ép quyền admin bất kể Firestore nói gì
        if (userDoc.exists) {
            const data = userDoc.data();
            userData.role = data.role || "user";
            userData.name = data.displayName || data.name || userData.name;
        } else {
            // Nếu user chưa tồn tại → tạo mới với role user
            await userRef.set({
                email: email,
                displayName: userData.name,
                role: "user",
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        const token = jwt.sign(userData, SECRET_KEY, { expiresIn: "7d" });
        console.log(`🔑 Login: ${email} | Role: ${userData.role}`);
        return res.json({ ok: true, user: userData, token });

    } catch (error) {
        console.error("❌ Verify Error:", error);
        return res.status(401).json({ ok: false, message: "Xác thực thất bại" });
    }
});

// 2. Lấy danh sách toàn bộ người dùng (Dùng cho Admin Dashboard)
router.get('/admin/users', verifyAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('users').get();
        const users = [];
        snapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });
        res.json({ ok: true, users });
    } catch (error) {
        res.status(500).json({ ok: false, message: "Lỗi lấy danh sách" });
    }
});

// 3. Cập nhật người dùng (Đổi quyền/Tên)
router.put('/admin/users/:id', verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const { role, displayName } = req.body;
    try {
        await db.collection('users').doc(id).update({
            role: role.toLowerCase(), // Tốt, giữ nguyên cái này
            displayName: displayName || "",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        res.json({ ok: true, message: "Cập nhật thành công" });
    } catch (error) {
        res.status(500).json({ ok: false, message: "Lỗi cập nhật" });
    }
});

// 4. Xóa người dùng
router.delete('/admin/users/:id', verifyAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.collection('users').doc(id).delete();
        res.json({ ok: true, message: "Đã xóa người dùng" });
    } catch (error) {
        res.status(500).json({ ok: false, message: "Lỗi khi xóa" });
    }
});

// 5. Thêm user
router.post('/admin/users', verifyAdmin, async (req, res) => {
    const { email, role } = req.body;

    try {
        const newUser = {
            email,
            role: role || "user",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('users').add(newUser);

        res.json({ ok: true, id: docRef.id });
    } catch (error) {
        res.status(500).json({ ok: false, message: "Lỗi thêm user" });
    }
});

module.exports = router;