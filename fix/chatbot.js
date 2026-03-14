// ====== n8n session ======
const user = JSON.parse(localStorage.getItem("user"));
const SESSION_ID = user?.id || crypto.randomUUID(); // fallback nếu chưa login

const isLoggedIn = localStorage.getItem("isLoggedIn");
if (!isLoggedIn) {
    alert("Vui lòng đăng nhập để sử dụng chatbot");
    window.location.href = "/frontend/auth/login/login.html";
}

async function sendMessage() {
    const input = document.getElementById("question"); // ĐÚNG ID
    const message = input.value.trim();
    if (!message) return;
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
        alert("Vui lòng đăng nhập để sử dụng chatbot");
        window.location.href = "/frontend/auth/login/login.html";
        return;
    }
    // User message
    addMessage("user", message, user.name);
    input.value = "";
    scrollToBottom();
    try {
        const response = await fetch("http://localhost:3000/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question: message,
                userId: user.id,
                session_id: SESSION_ID
            })
        });
        const data = await response.json();
        addMessage("bot", data.answer || "Xin lỗi, tôi chưa có câu trả lời phù hợp.");
        scrollToBottom();
    } catch (err) {
        console.error(err);
        addMessage("bot", "Lỗi kết nối server.");
    }
}
function addMessage(type, text, username = "") {
    const chatBox = document.getElementById("chatMessages"); // ĐÚNG ID
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", type);
    if (type === "user") {
        messageDiv.innerHTML = `
            <div class="bubble user-bubble">
                <strong>${username}</strong><br/>
                ${text}
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="bubble bot-bubble">
                ${text}
            </div>
        `;
    }
    chatBox.appendChild(messageDiv);
}
function handleEnter(e) {
    if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
    }
}
function createWorkspace() {
    const name = prompt("Nhập tên folder:");
    if (!name) return;
    const select = document.getElementById("workspaceSelect");
    const option = document.createElement("option");
    option.textContent = "📁 " + name;
    select.appendChild(option);
}
function uploadData() {
    const files = document.getElementById("fileInput").files;
    if (!files.length) {
        alert("Chọn ít nhất 1 file");
        return;
    }
    alert(`Đã tải ${files.length} file (mock UI)`);
}
document.getElementById("mediaInput").addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;
    addMessage("user", `📎 Đã gửi file: ${file.name}`);
});
function scrollToBottom() {
    const chatBox = document.getElementById("chatMessages");
    chatBox.scrollTop = chatBox.scrollHeight;
}

/* =========================================
   🔥 ADD-ON: CONNECT N8N WEBHOOK (KHÔNG PHÁ CODE CŨ)
   Paste xuống CUỐI FILE chatbot.js
========================================= */

// 👉 đổi URL khi deploy
const N8N_WEBHOOK_URL = "http://localhost:5678/webhook/chat";

// tự tạo session nếu chưa login
function getSessionId() {
    let sid = localStorage.getItem("chat_session");

    if (!sid) {
        sid = crypto.randomUUID();
        localStorage.setItem("chat_session", sid);
    }

    return sid;
}

// gọi n8n
async function askN8n(message) {
    try {
        const res = await fetch(N8N_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                session_id: getSessionId()
            })
        });

        const text = await res.text();

        try {
            const json = JSON.parse(text);
            return json.message || json.output || json.text || text;
        } catch {
            return text;
        }

    } catch (e) {
        console.error(e);
        return "❌ Không kết nối được server AI";
    }
}


/* =========================================
   🔥 AUTO HOOK VÀO FORM CŨ (KHÔNG ĐỤNG LOGIC CŨ)
   - chỉ lắng nghe nút gửi + input Enter
   - không sửa function teammate
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const input =
        document.querySelector("#messageInput") ||
        document.querySelector("input");

    const sendBtn =
        document.querySelector("#sendBtn") ||
        document.querySelector("button");

    const chatBox =
        document.querySelector(".chat-messages") ||
        document.querySelector("#messages");

    if (!input || !sendBtn || !chatBox) return;

    function addBotMsg(text) {
        const div = document.createElement("div");
        div.className = "msg bot";
        div.innerText = text;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    async function handleSend() {
        const msg = input.value.trim();
        if (!msg) return;

        input.value = "";

        addBotMsg("Đang suy nghĩ...");

        const reply = await askN8n(msg);

        chatBox.lastChild.remove();
        addBotMsg(reply);
    }

    sendBtn.addEventListener("click", handleSend);
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") handleSend();
    });

});
