import { auth, db } from "../../firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById("registerForm");
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = form.querySelector("input[type=text]").value;
    const email = form.querySelector("input[type=email]").value;
    const password = form.querySelector("input[type=password]").value;

    console.log("Registering:", email); // TEST 

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            name,
            email,
            avatar: "",
            role: "user",
            createdAt: serverTimestamp()
        });

        alert("Đăng ký thành công");
        window.location.href = "../login/login.html";
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
});