import { ExternalLink, ShieldAlert } from "lucide-react";
import { truncate } from "../../lib/utils";

export default function ExternalLinkCard({ item, showScore = false }) {
  return (
    <article className="glass-panel flex h-full flex-col p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-700">
          Link ngoài
        </span>
        {item.source_name ? <span>{item.source_name}</span> : null}
        {showScore && item.score !== undefined ? <span>Score {Number(item.score).toFixed(3)}</span> : null}
      </div>

      <h3 className="mt-4 font-display text-2xl font-semibold text-ink">{item.title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-500">
        {truncate(item.snippet || "", 220)}
      </p>

      {item.display_link ? (
        <div className="mt-4 text-xs font-medium text-slate-400">{item.display_link}</div>
      ) : null}

      <div className="mt-auto pt-5">
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
        >
          Mở nguồn
          <ExternalLink className="h-4 w-4" />
        </a>

        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
          <span className="inline-flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4" />
            Liên kết ngoài
          </span>
          <div className="mt-1">
            Các liên kết ngoài không thuộc hệ thống, người dùng cần tự kiểm chứng độ tin cậy của nguồn.
          </div>
        </div>
      </div>
    </article>
  );
}
