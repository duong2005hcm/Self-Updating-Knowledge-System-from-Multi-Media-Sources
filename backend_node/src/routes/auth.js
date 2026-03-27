const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const path = require('path');

// 1. Khởi tạo Firebase Admin (Chỉ khởi tạo một lần)
const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');

if (!admin.apps.length) {
    try {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ Firebase Admin initialized successfully");
    } catch (error) {
        console.error("❌ Firebase Admin initialization error:", error.message);
    }
}

// Secret Key này phải khớp tuyệt đối với SECRET_KEY bên FastAPI (ask.py)
const SECRET_KEY = process.env.JWT_SECRET || "ChuoiBiMatCuaBan123!";

/**
 * @route   POST /api/auth/firebase-verify
 * @desc    Xác thực ID Token từ Firebase (dùng cho cả Email, Google, Phone)
 * @access  Public
 */
router.post('/firebase-verify', async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({
            ok: false,
            message: "Thiếu mã xác thực (idToken)"
        });
    }

    try {
        // 2. Dùng Firebase Admin để giải mã và kiểm tra ID Token từ Client gửi lên
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        // 3. Trích xuất thông tin người dùng
        const userData = {
            id: decodedToken.uid,
            email: decodedToken.email || "",
            name: decodedToken.name || decodedToken.display_name || "User",
            avatar: decodedToken.picture || "",
            auth_time: decodedToken.auth_time
        };

        // 4. Tạo JWT nội bộ của RAG AI System
        // Token này sẽ được Frontend lưu lại và gửi kèm trong header Authorization khi gọi FastAPI
        const token = jwt.sign(userData, SECRET_KEY, {
            expiresIn: "7d",
            algorithm: "HS256"
        });

        console.log(`[AUTH] User verified: ${userData.email || userData.id}`);

        return res.json({
            ok: true,
            user: userData,
            token: token
        });

    } catch (error) {
        console.error("❌ Firebase Verify Error:", error.message);

        // Trả về lỗi chi tiết hơn để Frontend dễ xử lý
        let msg = "Xác thực không hợp lệ";
        if (error.code === 'auth/id-token-expired') msg = "Phiên đăng nhập đã hết hạn";

        return res.status(401).json({
            ok: false,
            message: msg
        });
    }
});

module.exports = router;