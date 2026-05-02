import { useState } from "react";
import { Link } from "react-router-dom";

const featureSlides = [
  {
    badge: "Tìm tài liệu",
    title: "Tìm kiếm dễ hiểu",
    description:
      "Nhập tên bệnh, triệu chứng hoặc chủ đề sức khỏe để tìm tài liệu liên quan nhanh hơn.",
    image: "/find.jpg",
  },
  {
    badge: "Nguồn tham khảo",
    title: "Có nguồn tham khảo",
    description:
      "Mỗi kết quả ưu tiên hiển thị nguồn gốc, thời gian cập nhật và đoạn nội dung liên quan để bạn tự đối chiếu.",
    image: "/link.webp",
  },
  {
    badge: "Tin tức y tế",
    title: "Tin tức y tế cập nhật",
    description:
      "Theo dõi tin nổi bật từ nguồn chính thống và các bài viết sức khỏe được chọn lọc.",
    image: "/tin.jpg",
  },
  {
    badge: "Hỏi AI tri thức",
    title: "Hỏi AI trên kho tri thức",
    description:
      "Sau khi tìm được tài liệu, bạn có thể hỏi AI để tóm tắt hoặc giải thích nội dung dễ hiểu hơn.",
    image: "/chatbox.webp",
  },
  {
    badge: "Lưu bài viết",
    title: "Lưu và quản lý bài viết",
    description:
      "Người dùng có thể đọc, theo dõi và đóng góp bài viết sức khỏe theo quy trình kiểm duyệt.",
    image: "/comment.png",
  },
  {
    badge: "Phản hồi",
    title: "Phản hồi chất lượng nội dung",
    description:
      "Cơ chế phản hồi giúp hệ thống cải thiện độ hữu ích và tính phù hợp của thông tin hiển thị.",
    image: "/feedback.jpg",
  },
];

function FeatureTile({ feature }) {
  const [imageError, setImageError] = useState(false);

  return (
    <article className="group relative h-36 w-44 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg backdrop-blur sm:h-40 sm:w-52">
      {!imageError ? (
        <img
          src={feature.image}
          alt={feature.title}
          className="absolute inset-0 h-full w-full object-cover opacity-65 transition duration-700 group-hover:scale-105 group-hover:opacity-75"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/30 via-cyan-400/20 to-emerald-400/20" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-slate-950/10" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200">
          {feature.badge}
        </p>
        <h3 className="mt-1 text-base font-bold leading-tight text-white">
          {feature.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-200 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {feature.description}
        </p>
      </div>
    </article>
  );
}

export default function FeatureCards() {
  const rowOne = [...featureSlides, ...featureSlides];
  const rowTwo = [...featureSlides].reverse().concat([...featureSlides].reverse());

  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-sky-950 to-emerald-950 px-6 py-14 shadow-2xl sm:px-10 lg:px-16">
          <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-10 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.12),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.10),transparent_24%)]" />

          <div className="relative mx-auto max-w-3xl text-center">
            <span className="inline-flex rounded-full border border-sky-300/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-sky-100 backdrop-blur">
              TÍNH NĂNG CHÍNH
            </span>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Tra cứu sức khỏe trong một trải nghiệm thống nhất
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Tìm tài liệu, đọc nguồn, theo dõi tin y tế và hỏi AI trên kho tri thức đã được tổ chức rõ ràng.
            </p>
          </div>

          <div className="feature-marquee-mask relative mt-12 space-y-4">
            <div className="feature-marquee-track feature-marquee-left flex w-max gap-4">
              {rowOne.map((feature, index) => (
                <FeatureTile key={`row-one-${feature.title}-${index}`} feature={feature} />
              ))}
            </div>
            <div className="feature-marquee-track feature-marquee-right hidden w-max gap-4 sm:flex">
              {rowTwo.map((feature, index) => (
                <FeatureTile key={`row-two-${feature.title}-${index}`} feature={feature} />
              ))}
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-slate-950 to-transparent sm:w-24" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-950 to-transparent sm:w-24" />
          </div>

          <div className="relative mt-12 text-center">
            <Link
              to="/search"
              className="inline-flex rounded-full bg-sky-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-400"
            >
              Khám phá tính năng
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
