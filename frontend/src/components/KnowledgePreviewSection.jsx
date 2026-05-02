import React from "react";

const PREVIEW_DOCUMENTS = [
  {
    title: "Quy trình đăng ký đề tài tốt nghiệp",
    source: "Phòng đào tạo",
    domain: "education",
    updatedAt: "Cập nhật 22/04/2026",
    snippet:
      "Biểu mẫu, mốc thời gian và các điều kiện cần hoàn tất trước khi nộp đề tài.",
  },
  {
    title: "Quy định thực tập doanh nghiệp",
    source: "Khoa công nghệ thông tin",
    domain: "governance",
    updatedAt: "Cập nhật 19/04/2026",
    snippet:
      "Yêu cầu về thời lượng, nhật ký thực tập, đánh giá và nghiệm thu cuối kỳ.",
  },
  {
    title: "Báo cáo tài chính năm 2024",
    source: "Finance office",
    domain: "finance",
    updatedAt: "Cập nhật 17/04/2026",
    snippet:
      "Tổng quan doanh thu, chi phí, biến động ngân sách và các chỉ số nổi bật của năm.",
  },
];

const PREVIEW_SOURCES = [
  "PDF nội bộ đã được kiểm duyệt",
  "Văn bản quy định và hướng dẫn",
  "Báo cáo nghiệp vụ theo domain",
  "Nguồn web chính thức đã ingest",
];

export default function KnowledgePreviewSection() {
  return (
    <section className="landing-section" id="preview">
      <div className="landing-preview-layout">
        <div className="landing-preview-column">
          <div className="landing-section-head is-compact">
            <span className="landing-section-kicker">Preview</span>
            <h2>Tài liệu và tri thức nổi bật</h2>
            <p>
              Khu vực này mô phỏng các tài liệu mới cập nhật và kiểu metadata
              mà người dùng sẽ nhìn thấy trước khi đi vào hỏi AI.
            </p>
          </div>

          <div className="landing-preview-cards">
            {PREVIEW_DOCUMENTS.map((item) => (
              <article key={item.title} className="landing-doc-card">
                <div className="landing-doc-meta">
                  <span>{item.source}</span>
                  <span>{item.updatedAt}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.snippet}</p>
                <div className="landing-doc-tags">
                  <span>{item.domain}</span>
                  <span>document preview</span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="landing-preview-column">
          <div className="landing-source-panel">
            <span className="landing-section-kicker">Knowledge sources</span>
            <h3>Nguồn tri thức mà hệ thống đang khai thác</h3>
            <ul>
              {PREVIEW_SOURCES.map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ul>
          </div>

          <div className="landing-ai-note">
            <span className="landing-section-kicker">AI as support</span>
            <h3>AI không phải trung tâm duy nhất</h3>
            <p>
              AI chỉ phát huy hiệu quả sau khi knowledge layer đã có tài liệu,
              version, nguồn và context đủ rõ để người dùng khai thác an toàn.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
