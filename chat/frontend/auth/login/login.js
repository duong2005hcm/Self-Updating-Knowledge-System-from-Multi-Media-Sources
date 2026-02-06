import { auth, db } from "../../firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById("loginForm");
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        const uid = userCredential.user.uid;

        const userDoc = await getDoc(doc(db, "users", uid));
        const userData = userDoc.exists() ? userDoc.data() : {};

        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("user", JSON.stringify({
            id: uid,
            email,
            ...userData
        }));

        alert("Đăng nhập thành công");
        window.location.href = "/frontend/index.html";
    } catch (err) {
        console.error(err);
        alert("Sai email hoặc mật khẩu");
    }
});

