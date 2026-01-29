fetch("/frontend/components/header/header.html")
    .then(res => res.text())
    .then(html => {
        document.getElementById("header").innerHTML = html;
        renderAuth();
    });

function renderAuth() {
    const authArea = document.getElementById("authArea");
    const user = JSON.parse(localStorage.getItem("user"));

    if (user) {
        authArea.innerHTML = `
            <div class="user-menu">
                <img src="${user.avatar || '/frontend/assets/default-avatar.png'}" 
                     style="width:32px;height:32px;border-radius:50%">
                <span class="user-name">${user.name}</span>
                <span class="menu-btn" onclick="toggleMenu()">⋮</span>

                <div class="dropdown" id="dropdownMenu">
                    <a href="/frontend/profile/profile.html">👤 Thông tin cá nhân</a>
                    <button onclick="logout()">🚪 Đăng xuất</button>
                </div>
            </div>
        `;
    } else {
        authArea.innerHTML = `
            <a class="btn login" href="/frontend/auth/login/login.html">Đăng nhập</a>
            <a class="btn register" href="/frontend/auth/register/register.html">Đăng ký</a>
        `;
    }
}

function toggleMenu() {
    const menu = document.getElementById("dropdownMenu");
    menu.style.display = menu.style.display === "flex" ? "none" : "flex";
}

function logout() {
    localStorage.clear();
    window.location.href = "/frontend/index.html";
}