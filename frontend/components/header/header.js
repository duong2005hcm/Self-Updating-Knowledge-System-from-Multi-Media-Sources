fetch("/frontend/components/header/header.html")
    .then(res => res.text())
    .then(html => {
        document.getElementById("header").innerHTML = html;

        // document.querySelector(".login").onclick = () =>
        //     alert("Chức năng đăng nhập sẽ phát triển sau");

        // document.querySelector(".register").onclick = () =>
        //     alert("Chức năng đăng ký sẽ phát triển sau");
    });