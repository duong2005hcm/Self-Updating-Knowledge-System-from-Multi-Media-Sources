const { searchData } = require("./dataservice");

function handleChat(message) {
    const result = searchData(message);

    if (result) {
        return result.content;
    }

    return "Xin lỗi, tôi chưa có thông tin về nội dung này.";
}

module.exports = {
    handleChat
};