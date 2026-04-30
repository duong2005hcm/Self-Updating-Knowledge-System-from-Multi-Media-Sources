import { Search } from "lucide-react";
import { BLOG_FILTERS, SORT_OPTIONS } from "./blogOptions";

export default function ArticleFilters({
  query,
  topic,
  sort,
  onQueryChange,
  onTopicChange,
  onSortChange,
}) {
  return (
    <section className="mt-8 rounded-2xl border border-white/70 bg-white/90 p-4 shadow-soft">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <Search className="h-5 w-5 text-brand-600" />
          <input
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tìm bài viết…"
          />
        </label>

        <select
          className="input-base min-w-[180px]"
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {BLOG_FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              topic === item
                ? "bg-brand-600 text-white shadow-float"
                : "border border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700"
            }`}
            onClick={() => onTopicChange(item)}
          >
            {item === "all" ? "all" : item}
          </button>
        ))}
      </div>
    </section>
  );
}
