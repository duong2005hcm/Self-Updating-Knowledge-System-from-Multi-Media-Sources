import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyBnXipZCQEnbvz03kDQObB-6Ggo5au-5hE",
    authDomain: "ragpython-f0661.firebaseapp.com",
    projectId: "ragpython-f0661",
    storageBucket: "ragpython-f0661.firebasestorage.app",
    messagingSenderId: "838526562767",
    appId: "1:838526562767:web:4f5b414e2a9c35f5dfe2ba",
    measurementId: "G-RJLX535N5C"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
