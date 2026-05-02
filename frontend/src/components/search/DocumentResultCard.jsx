import { FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate, truncate } from "../../lib/utils";

function getDocumentBadge(sourceType = "") {
  const normalized = String(sourceType || "").toLowerCase();
  if (normalized.includes("web")) return "Web PDF";
  return "PDF";
}

export default function DocumentResultCard({ item, showScore = false }) {
  return (
    <article className="glass-panel flex h-full flex-col p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">
          {getDocumentBadge(item.source_type)}
        </span>
        {item.topic ? <span>{item.topic}</span> : null}
        {showScore && item.score !== undefined ? <span>Score {Number(item.score).toFixed(3)}</span> : null}
      </div>

      <h3 className="mt-4 font-display text-2xl font-semibold text-ink">{item.title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-500">
        {truncate(item.snippet || item.summary || "", 260)}
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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>Cập nhật: {formatDate(item.updated_at)}</span>
        <Link to={item.url || `/documents/${item.document_id}`} className="btn-secondary px-4 py-2.5">
          <FileText className="h-4 w-4" />
          Xem chi tiết
        </Link>
      </div>
    </article>
  );
}
