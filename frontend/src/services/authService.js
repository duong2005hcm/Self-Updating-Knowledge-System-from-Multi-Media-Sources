import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    signInWithPhoneNumber,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, googleProvider, db } from "../auth/firebase";

const API_URL = "/api/auth";

/**
 * Hàm bổ trợ: Lưu thông tin User vào Firestore
 * Giúp dữ liệu hiển thị trong tab Database (Firestore) của Firebase Console
 */
const saveUserToFirestore = async (user, additionalData = {}) => {
    try {
        const userRef = doc(db, "users", user.uid);

        const existingDoc = await getDoc(userRef);
        const emailOrPhone = user.email || user.phoneNumber || "";

        // Nếu đã tồn tại → KHÔNG ghi đè role
        if (existingDoc.exists()) {
            await setDoc(userRef, {
                uid: user.uid,
                email: user.email ?? emailOrPhone,
                phone: user.phoneNumber || "",
                displayName: user.displayName || additionalData.name || "Người dùng RAG",
                photoURL: user.photoURL || "",
                lastLogin: serverTimestamp(),
            }, { merge: true });

        } else {
            // User mới → tạo với role user
            await setDoc(userRef, {
                uid: user.uid,
                email: user.email ?? emailOrPhone,
                phone: user.phoneNumber || "",
                displayName: user.displayName || additionalData.name || "Người dùng RAG",
                photoURL: user.photoURL || "",
                lastLogin: serverTimestamp(),
                createdAt: serverTimestamp(),
                role: "user"
            });
        }

    } catch (error) {
        console.error("Lỗi khi lưu dữ liệu vào Firestore:", error);
    }
};

/**
 * Xác thực với Backend Node.js
 * Gửi idToken lên server để tạo session hoặc lưu vào DB nội bộ
 */
const authenticateWithBackend = async (idToken) => {
    try {
        const res = await fetch(`${API_URL}/firebase-verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken })
        });

        const data = await res.json();

        if (data.ok && data.token) {
            localStorage.setItem("ragai_token", data.token);

            // FIX: đảm bảo luôn có role
            const safeUser = {
                ...data.user,
                role: data.user?.role || "user"
            };

            localStorage.setItem("ragai_user", JSON.stringify(safeUser));

            return { ok: true, user: safeUser };
        }

        return { ok: false, message: data.message || "Xác thực server thất bại" };
    } catch (error) {
        return { ok: false, message: "Không thể kết nối đến server Node.js" };
    }
};

// --- ĐĂNG NHẬP / ĐĂNG KÝ EMAIL ---

export const loginUser = async ({ email, password }) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        // Cập nhật thời gian đăng nhập vào Firestore
        await saveUserToFirestore(userCredential.user);

        const idToken = await userCredential.user.getIdToken();
        return await authenticateWithBackend(idToken);
    } catch (error) {
        return { ok: false, message: "Email hoặc mật khẩu không chính xác" };
    }
};

export const registerUser = async ({ name, email, password }) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        // 1. Cập nhật Profile trong Firebase Auth
        await updateProfile(userCredential.user, { displayName: name });

        // 2. Lưu thông tin người dùng vào Firestore Database
        await saveUserToFirestore(userCredential.user, { name });

        // 3. Xác thực với Backend
        const idToken = await userCredential.user.getIdToken();
        return await authenticateWithBackend(idToken);
    } catch (error) {
        let msg = "Đăng ký thất bại";
        if (error.code === 'auth/email-already-in-use') msg = "Email này đã được sử dụng";
        return { ok: false, message: msg };
    }
};

// --- ĐĂNG NHẬP MẠNG XÃ HỘI ---

import { signInWithPopup } from "firebase/auth";

export const loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);

        const user = result.user;

        // lưu Firestore
        await saveUserToFirestore(user);

        // lấy token
        const idToken = await user.getIdToken();

        // gọi backend
        return await authenticateWithBackend(idToken);

    } catch (error) {
        console.error("Google login error:", error);
        return { ok: false, message: "Đăng nhập Google thất bại" };
    }
};

// Hàm xử lý sau khi redirect quay lại
// export const handleGoogleRedirect = async () => {
//     try {
//         const result = await getRedirectResult(auth);
//         if (!result) return null;

//         await saveUserToFirestore(result.user);

//         const idToken = await result.user.getIdToken();
//         return await authenticateWithBackend(idToken);
//     } catch (error) {
//         return { ok: false, message: "Lỗi xử lý Google redirect" };
//     }
// };

// --- ĐĂNG NHẬP SỐ ĐIỆN THOẠI ---

export const loginWithPhone = async (phoneNumber) => {
    try {
        // Đảm bảo recaptcha-container tồn tại trong DOM của AuthPage.jsx
        const confirmation = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
        return { ok: true, confirmation };
    } catch (error) {
        return { ok: false, message: "Lỗi gửi mã OTP. Vui lòng kiểm tra lại số điện thoại" };
    }
};

export const verifyOTP = async (confirmation, code) => {
    try {
        const result = await confirmation.confirm(code);

        // Lưu thông tin phone user vào Firestore
        await saveUserToFirestore(result.user);

        const idToken = await result.user.getIdToken();
        return await authenticateWithBackend(idToken);
    } catch (error) {
        return { ok: false, message: "Mã OTP không đúng" };
    }
};

// --- ĐĂNG XUẤT ---

export const logoutUser = async () => {
    try {
        await auth.signOut();
        localStorage.removeItem("ragai_token");
        localStorage.removeItem("ragai_user");
        window.location.href = "/"; // Hoặc trang login của bạn
    } catch (error) {
        console.error("Lỗi đăng xuất:", error);
    }
};