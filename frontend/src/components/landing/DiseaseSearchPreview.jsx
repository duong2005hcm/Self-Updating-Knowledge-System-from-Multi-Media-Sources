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
    <section className="page-shell py-12">
      <div className="glass-panel p-8 sm:p-10">
        <SectionHeading
          kicker="Disease search"
          title="Bắt đầu từ tài liệu, không bắt đầu từ câu trả lời"
          description="Người dùng có thể thử nhanh các truy vấn sức khỏe phổ biến rồi chuyển sang trang search đầy đủ để xem kết quả, metadata và snippet."
        />

        <form onSubmit={submit} className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto]">
          <label className="rounded-[28px] border border-brand-100 bg-brand-50/60 p-2">
            <div className="flex items-center gap-3 rounded-[22px] bg-white px-4 py-3">
              <Search className="h-5 w-5 text-brand-600" />
              <input
                className="w-full border-0 bg-transparent p-0 text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Nhập tên bệnh, triệu chứng hoặc chủ đề sức khỏe…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </label>
          <button type="submit" className="btn-primary h-full px-7">
            Tra cứu ngay
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-3">
          {hotTopics.map((topic) => (
            <button
              key={topic}
              type="button"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-700"
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
