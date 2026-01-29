async function sendMessage() {
    const input = document.getElementById("question");
    const message = input.value.trim();
    if (!message) return;

    addMessage("user", message);
    input.value = "";

    try {
        const res = await fetch("http://localhost:3000/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: message })
        });

        const data = await res.json();
        addMessage("bot", data.answer, data.sources);
    } catch {
        addMessage("bot", "❌ Không thể kết nối server");
    }
}

function addMessage(type, text, sources = []) {
    const container = document.getElementById("chatMessages");

    const msg = document.createElement("div");
    msg.className = `message ${type}`;
    msg.innerText = text;
    container.appendChild(msg);

    if (sources.length) {
        const src = document.createElement("div");
        src.className = "source";
        src.innerHTML =
            "<b>Nguồn:</b><br>" +
            sources.map(s => `<a href="${s.url}" target="_blank">${s.title}</a>`).join("<br>");
        container.appendChild(src);
    }

    container.scrollTop = container.scrollHeight;
}

function handleEnter(e) {
    if (e.key === "Enter") sendMessage();
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