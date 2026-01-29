const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../data/knowledge.json");

function loadData() {
    const rawData = fs.readFileSync(dataPath, "utf-8");
    return JSON.parse(rawData);
}

function searchData(question) {
    const data = loadData();
    const lowerQuestion = question.toLowerCase();

    return data.find(item =>
        item.keywords.some(keyword =>
            lowerQuestion.includes(keyword)
        )
    );
}

module.exports = {
    searchData
};