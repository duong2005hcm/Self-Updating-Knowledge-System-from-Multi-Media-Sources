function cleanText(text) {
    return text
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

module.exports = { cleanText };