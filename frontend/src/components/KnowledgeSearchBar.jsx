import React from "react";

const SUGGESTIONS = [
  "quy trình đăng ký đề tài tốt nghiệp",
  "báo cáo tài chính 2024",
  "quy định thực tập",
];

export default function KnowledgeSearchBar({
  value,
  onChange,
  onSubmit,
  isLoading = false,
}) {
  return (
    <div className="landing-search-card">
      <div className="landing-search-copy">
        <span className="landing-section-kicker">Search entry</span>
        <h2>Bắt đầu từ truy vấn tri thức</h2>
        <p>
          Tìm kiếm tài liệu, quy định, báo cáo và nội dung liên quan trước khi
          đi vào hỏi AI.
        </p>
      </div>

      <form
        className="landing-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(value);
        }}
      >
        <label className="landing-search-input">
          <span className="sr-only">Tìm kiếm tài liệu</span>
          <input
            type="text"
            value={value}
            onChange={(event) => onChange?.(event.target.value)}
            placeholder="Tìm theo chủ đề, quy định, báo cáo hoặc câu hỏi nghiệp vụ"
          />
        </label>

        <button type="submit" className="landing-primary-btn" disabled={isLoading}>
          {isLoading ? "Đang tìm..." : "Tìm kiếm tài liệu"}
        </button>
      </form>

      <div className="landing-search-suggestions">
        {SUGGESTIONS.map((item) => (
          <button
            key={item}
            type="button"
            className="landing-suggestion-chip"
            onClick={() => {
              onChange?.(item);
              onSubmit?.(item);
            }}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
