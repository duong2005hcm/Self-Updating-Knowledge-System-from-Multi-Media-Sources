// fetch("introduction.txt")
//     .then(response => response.text())
//     .then(text => {
//         document.getElementById("intro-text").innerText = text;
//     })
//     .catch(err => {
//         console.error("Không tải được nội dung:", err);
//     });

document.addEventListener("DOMContentLoaded", () => {
    fetch("introduction.txt")
        .then(res => {
            if (!res.ok) throw new Error("Không tìm thấy file");
            return res.text();
        })
        .then(text => {
            document.getElementById("intro-text").innerText = text;
        })
        .catch(err => {
            console.error(err);
            document.getElementById("intro-text").innerText =
                "Không tải được nội dung giới thiệu.";
        });
});