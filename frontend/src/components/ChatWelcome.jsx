import React from "react";
import SuggestionPill from "./SuggestionPill";

export default function ChatWelcome() {
  return (
    <div className="welcome-wrap">
      <div className="welcome-content">
        <h1 className="welcome-title">Chào bạn, Tớ là SIMLESI AI!</h1>
        <p className="welcome-sub">
          <strong>admin</strong> ngoan xinh yêu ơi! Cứ hành tớ thoải mái nhé?
        </p>
        <p className="welcome-hint">(Hãy nhắn tin cho tớ để bắt đầu trò chuyện nào!)</p>

        <div className="suggestions-title">Vài loại câu hỏi tớ có thể trả lời:</div>

        <div className="suggestions-row">
          <SuggestionPill>Làm thế nào để có người yêu?</SuggestionPill>
          <SuggestionPill>Tại sao lập trình viên không thích deadline?</SuggestionPill>
          <SuggestionPill>Vì sao thứ 2 là ngày buồn nhất trong tuần?</SuggestionPill>
        </div>

        <div style={{height: 24}} />
      </div>
    </div>
  );
}
