const user = JSON.parse(localStorage.getItem("user"));
if (!user) location.href = "/frontend/auth/login/login.html";

document.getElementById("name").value = user.name;
document.getElementById("email").value = user.email;
document.getElementById("avatarPreview").src =
    user.avatar || "/frontend/assets/default-avatar.png";

document.getElementById("avatarInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        document.getElementById("avatarPreview").src = reader.result;
        user.avatar = reader.result;
    };
    reader.readAsDataURL(file);
});

function updateProfile() {
    user.name = document.getElementById("name").value;
    const pass = document.getElementById("password").value;
    if (pass) user.password = pass;

    localStorage.setItem("user", JSON.stringify(user));
    alert("Cập nhật thành công");
    location.reload();
}