// // script.js – dùng cho trang chủ hoặc logic chung
console.log("Trang chủ loaded");



// const input = document.getElementById("searchInput");
// const resultsBox = document.getElementById("searchResults");

// input.addEventListener("input", async () => {
//     const q = input.value.trim();
//     if (q.length < 2) {
//         resultsBox.innerHTML = "";
//         return;
//     }

//     const res = await fetch(`http://localhost:3000/api/search?q=${q}`);
//     const data = await res.json();

//     resultsBox.innerHTML = data.map(item => `
//         <div class="result-item" onclick="goToChat('${item.title}')">
//             <strong>${item.title}</strong>
//             <p>${item.content.slice(0, 80)}...</p>
//         </div>
//     `).join("");
// });

// function goToChat(title) {
//     localStorage.setItem("chatQuestion", title);
//     window.location.href = "/chatbot/chatbot.html";
// }