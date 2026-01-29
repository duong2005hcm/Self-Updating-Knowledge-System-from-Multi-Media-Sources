const express = require("express");
const cors = require("cors");

const chatRoute = require("./routes/chatroute");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/chat", chatRoute);

app.get("/", (req, res) => {
    res.send("Backend AI Chatbot is running");
});

module.exports = app;