const { handleChat } = require("../services/chatservice");

exports.chat = (req, res) => {
    const { question } = req.body;
    if (!question) {
        return res.status(400).json({ message: "Question is required" });
    }
    const answer = handleChat(question);
    res.json({
        answer,
        sources: [
            { title: "Knowledge Base", url: "knowledge.json" }
        ]
    });
};
