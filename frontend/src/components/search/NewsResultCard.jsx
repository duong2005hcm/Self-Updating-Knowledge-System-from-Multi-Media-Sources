import { ExternalLink, Newspaper } from "lucide-react";
import { Link } from "react-router-dom";
import SafeImage from "../common/SafeImage";
import { formatDate, truncate } from "../../lib/utils";

export default function NewsResultCard({ item, showScore = false }) {
  return (
    <article className="glass-panel flex h-full flex-col overflow-hidden p-0">
      <div className="relative h-48 w-full overflow-hidden bg-slate-100">
        <SafeImage
          src={item.image_url}
          alt={item.title}
          fallbackType="article"
          fallbackLabel={item.topic || "Tin tức y tế"}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
            Tin tức y tế
          </span>
          {item.source_name ? <span>{item.source_name}</span> : null}
          {showScore && item.score !== undefined ? <span>Score {Number(item.score).toFixed(3)}</span> : null}
        </div>

        <h3 className="mt-4 font-display text-2xl font-semibold text-ink">{item.title}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          {truncate(item.summary || item.snippet || "", 220)}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(item.tags || []).slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto pt-5">
          <div className="mb-4 text-sm text-slate-500">Đăng ngày: {formatDate(item.published_at)}</div>
          <div className="flex flex-wrap gap-3">
            <Link to={item.url || `/blog/${item.article_id}`} className="btn-secondary px-4 py-2.5">
              <Newspaper className="h-4 w-4" />
              Đọc thêm
            </Link>
            {item.source_url ? (
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                Nguồn gốc
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
