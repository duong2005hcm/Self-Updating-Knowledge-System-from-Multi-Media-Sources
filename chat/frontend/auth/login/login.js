function login(event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    // MOCK login thành công
    const user = {
        id: Date.now(),
        name: email.split("@")[0],
        email
    };

    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("user", JSON.stringify(user));

    alert("Đăng nhập thành công");
    window.location.href = "/frontend/index.html";
}