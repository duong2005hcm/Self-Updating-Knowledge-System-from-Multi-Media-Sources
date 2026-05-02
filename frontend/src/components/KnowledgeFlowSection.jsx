import React from "react";

const STEPS = [
  {
    title: "Bước 1 - Tìm kiếm",
    description:
      "Người dùng bắt đầu bằng truy vấn tài liệu, chính sách, báo cáo hoặc chủ đề cần tra cứu.",
  },
  {
    title: "Bước 2 - Mở tài liệu",
    description:
      "Từ kết quả tìm kiếm, người dùng đọc metadata, version, snippet và các đoạn nội dung liên quan.",
  },
  {
    title: "Bước 3 - Hỏi AI",
    description:
      "Khi đã có context, AI hỗ trợ tóm tắt, so sánh hoặc gợi ý hành động tiếp theo dựa trên tri thức đã quản trị.",
  },
];

export default function KnowledgeFlowSection() {
  return (
    <section className="landing-section" id="how-it-works">
      <div className="landing-section-head">
        <span className="landing-section-kicker">Usage flow</span>
        <h2>Luồng sử dụng đúng của sản phẩm</h2>
        <p>
          Sản phẩm không mở đầu bằng một hộp chat trống. Luồng chuẩn là
          search, sau đó document detail, cuối cùng mới đến AI support.
        </p>
      </div>

      <div className="landing-flow-grid">
        {STEPS.map((step) => (
          <article key={step.title} className="landing-flow-card">
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
