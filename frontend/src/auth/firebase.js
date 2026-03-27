import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, RecaptchaVerifier } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Thêm dòng này

const firebaseConfig = {
    apiKey: "AIzaSyCdk85SaCArU_W-A4j4HWUTJOEQPCHz0zw",
    authDomain: "rag-knowledge-system.firebaseapp.com",
    projectId: "rag-knowledge-system",
    storageBucket: "rag-knowledge-system.firebasestorage.app",
    messagingSenderId: "433010686668",
    appId: "1:433010686668:web:3f4706a5321d3a6ce82069",
    measurementId: "G-1D8C89TQV4"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Cấu hình Recaptcha cho đăng nhập số điện thoại (bắt buộc)
export const setupRecaptcha = (containerId) => {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
            'size': 'invisible',
        });
    }
};