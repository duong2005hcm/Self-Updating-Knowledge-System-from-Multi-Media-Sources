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
                userId: user.id
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