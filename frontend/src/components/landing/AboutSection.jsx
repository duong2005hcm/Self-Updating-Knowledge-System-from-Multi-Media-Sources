import SectionHeading from "../common/SectionHeading";

export default function AboutSection() {
  return (
    <section className="page-shell py-12">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-panel p-8">
          <SectionHeading
            kicker="About"
            title="Kho tri thức dành cho nhu cầu tra cứu sức khỏe có nguồn"
            description="Thực trạng phổ biến hiện nay là người dùng đọc tin rời rạc, khó đối chiếu nguồn và thiếu lớp tìm kiếm nhất quán giữa tài liệu học thuật với tin tức y tế."
          />
        </div>
        <div className="glass-panel p-8">
          <div className="space-y-5 text-sm leading-8 text-slate-600">
            <p>
              Hệ thống này giải quyết vấn đề bằng cách gom nguồn dữ liệu vào một kiến
              trúc ingest, phân loại theo domain và topic, sau đó cho phép người dùng
              tìm kiếm tài liệu, xem metadata, đọc snippet và chỉ dùng AI như lớp hỗ
              trợ sau retrieval.
            </p>
            <p>
              Giá trị cốt lõi là minh bạch nguồn, cập nhật có quản trị, giảm phụ thuộc
              vào câu trả lời một phát và tăng khả năng kiểm tra ngược lại tài liệu
              gốc.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
