const user = JSON.parse(localStorage.getItem("user"));
if (!user) location.href = "/frontend/auth/login/login.html";
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");
const avatarInput = document.getElementById("avatarInput");
const avatarPreview = document.getElementById("avatarPreview");
// load data
nameInput.value = user.name || "";
emailInput.value = user.email || "";
avatarPreview.src = user.avatar || "/frontend/assets/default-avatar.png";
// chọn avatar
avatarInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        avatarPreview.src = reader.result;
        user.avatar = reader.result;
        localStorage.setItem("user", JSON.stringify(user));
    };
    reader.readAsDataURL(file);
});
// cập nhật profile
function updateProfile() {
    user.name = nameInput.value;
    if (passInput.value) {
        user.password = passInput.value;
    }
    if (avatarInput.value) {
        user.avatar = avatarInput.value;
    }
    localStorage.setItem("user", JSON.stringify(user));
    alert("Cập nhật thành công");
}