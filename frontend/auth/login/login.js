function login(event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    console.log("LOGIN:", email, password);

    alert("Đăng nhập thành công (demo)");
}