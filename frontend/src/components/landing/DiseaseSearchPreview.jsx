import { Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { hotTopics } from "../../data/features";
import SectionHeading from "../common/SectionHeading";

export default function DiseaseSearchPreview() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const submit = (event, nextQuery = query) => {
    event?.preventDefault?.();
    const normalizedQuery = String(nextQuery || "").trim();
    if (!normalizedQuery) return;
    navigate(`/search?q=${encodeURIComponent(normalizedQuery)}&search_mode=hybrid`);
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="rounded-[32px] border border-sky-100 bg-white p-6 shadow-soft sm:p-8 lg:p-10">
        <SectionHeading
          kicker="Tra cứu nhanh"
          title="Bạn muốn tìm tài liệu về vấn đề sức khỏe nào?"
          description="Nhập tên bệnh, triệu chứng hoặc chủ đề để xem tài liệu, bài viết và nguồn tham khảo liên quan."
        />

        <form onSubmit={submit} className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto]">
          <label className="rounded-[28px] border border-brand-100 bg-brand-50/60 p-2">
            <div className="flex items-center gap-3 rounded-[22px] bg-white px-4 py-4">
              <Search className="h-5 w-5 text-brand-600" />
              <input
                className="w-full border-0 bg-transparent p-0 text-base text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Nhập tên bệnh, triệu chứng hoặc chủ đề…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </label>
          <button type="submit" className="btn-primary h-14 px-8 text-base">
            Tra cứu ngay
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-3">
          {hotTopics.map((topic) => (
            <button
              key={topic}
              type="button"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              onClick={(event) => submit(event, topic)}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
