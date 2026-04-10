// import React from "react";

// export default function ChatHeader() {
//   return (
//     <header className="chat-header">
//       <div className="header-left">
//         <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
//           <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" stroke="#2F80ED" strokeWidth="1.2" />
//         </svg>
//         <span className="model-name">OpenAI</span>
//         <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none">
//           <path d="M6 9l6 6 6-6" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//         </svg>
//       </div>
//     </header>
//   );
// }
import React from "react";

export default function ChatHeader({ user }) {
  return (
    <header className="chat-header">
      <div className="header-left">
        <div className="status-indicator">
          <span className="dot pulse"></span>
          <span className="model-label">RAG Engine v2.0</span>
        </div>
      </div>

      <div className="header-right">
        <div className="header-user-badge">
          <span className="welcome-text">Xin chào,</span>
          <span className="header-username">{user?.displayName || "Admin"}</span>
        </div>
      </div>
    </header>
  );
}