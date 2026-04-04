import React, { useEffect, useState } from "react";
import {
  DEFAULT_SYSTEM_PROMPT,
  getSystemPrompt,
  PROMPT_PRESETS,
  resetSystemPrompt,
  setSystemPrompt,
} from "../chat/systemPrompt";
import "../styles/system-prompt.css";

/**
 * Form chỉnh prompt hệ thống (localStorage → gửi kèm /api/ask).
 * Dùng trong trang quản trị.
 */
export default function SystemPromptEditor() {
  const [draft, setDraft] = useState("");
  const [baseline, setBaseline] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const cur = getSystemPrompt();
    setDraft(cur);
    setBaseline(cur);
  }, []);

  const len = draft.length;
  const dirty = draft !== baseline;

  const handleSave = () => {
    setSystemPrompt(draft);
    setBaseline(draft);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const handleReset = () => {
    if (
      !window.confirm(
        "Đặt lại về prompt mặc định? Nội dung hiện tại sẽ mất nếu bạn chưa sao chép."
      )
    ) {
      return;
    }
    resetSystemPrompt();
    const d = DEFAULT_SYSTEM_PROMPT;
    setDraft(d);
    setBaseline(d);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  return (
    <div className="sp-embedded">
      <div className="sp-panel-head">
        <h2 className="sp-panel-title" id="admin-sp-title">
          Prompt hệ thống
        </h2>
        <p className="sp-panel-sub">
          Chỉ định cách chatbot suy nghĩ và trả lời (vai trò, giọng điệu, độ dài, quy tắc RAG). Lưu trong
          trình duyệt của phiên admin; mỗi lần người dùng hỏi trên cùng trình duyệt sẽ gửi kèm tới API{" "}
          <code>/api/ask</code> (trường <code>system_prompt</code>).
        </p>
      </div>

      <div className="sp-panel-body">
        <div>
          <div className="sp-label">Gợi ý nhanh</div>
          <div className="sp-presets">
            {PROMPT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="sp-preset-chip"
                onClick={() => setDraft(p.text)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="sp-label">Nội dung prompt</div>
          <div className="sp-textarea-wrap">
            <textarea
              className="sp-textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Nhập hướng dẫn cho mô hình..."
              spellCheck={false}
            />
          </div>
          <div className="sp-meta">
            <span>{len.toLocaleString("vi-VN")} ký tự</span>
            {savedFlash ? (
              <span style={{ color: "#15803d", fontWeight: 700 }}>Đã lưu</span>
            ) : dirty ? (
              <span style={{ color: "#b45309", fontWeight: 600 }}>Chưa lưu</span>
            ) : (
              <span style={{ color: "#64748b" }}>Đã lưu cục bộ</span>
            )}
          </div>
        </div>

        <p className="sp-hint">
          Backend FastAPI cần nhận <code>system_prompt</code> trong body (cùng <code>question</code>). Nếu
          chưa cấu hình phía server, hãy thêm vào endpoint <code>/api/ask</code>.
        </p>
      </div>

      <div className="sp-panel-foot sp-panel-foot--embedded">
        <button type="button" className="sp-btn sp-btn-ghost" onClick={handleReset}>
          Về mặc định
        </button>
        <button
          type="button"
          className="sp-btn sp-btn-primary"
          onClick={handleSave}
          disabled={!dirty}
        >
          {dirty ? "Lưu prompt" : "Không có thay đổi"}
        </button>
      </div>
    </div>
  );
}
