import React from "react";

const FEATURES = [
  {
    title: "Tìm kiếm tri thức đa nguồn",
    description:
      "Tra cứu theo từ khóa hoặc ngữ nghĩa trên kho tài liệu đã được thu thập và chuẩn hóa.",
    badge: "Search first",
  },
  {
    title: "Xem tài liệu và nội dung liên quan",
    description:
      "Mỗi kết quả đều có nguồn, snippet, domain và version để người dùng hiểu ngữ cảnh tài liệu.",
    badge: "Document aware",
  },
  {
    title: "Hỏi AI dựa trên dữ liệu đã quản trị",
    description:
      "AI hoạt động như lớp hỗ trợ khai thác trên knowledge layer, không phải trung tâm duy nhất.",
    badge: "AI assisted",
  },
];

export default function KnowledgeFeatureCards() {
  return (
    <section className="landing-section" id="capabilities">
      <div className="landing-section-head">
        <span className="landing-section-kicker">Core capabilities</span>
        <h2>Năng lực chính của nền tảng</h2>
        <p>
          Giao diện này định hướng người dùng đi từ tìm kiếm sang đọc tài liệu,
          rồi mới hỏi AI khi đã có context tri thức.
        </p>
      </div>

      <div className="landing-feature-grid">
        {FEATURES.map((feature, index) => (
          <article key={feature.title} className="landing-feature-card">
            <div className="landing-feature-index">0{index + 1}</div>
            <span className="landing-feature-badge">{feature.badge}</span>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
