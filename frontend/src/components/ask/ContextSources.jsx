import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { formatScore, truncate } from "../../lib/utils";

export default function ContextSources({ contexts = [] }) {
  const [open, setOpen] = useState(false);
  if (!contexts.length) return null;

  return (
    <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-bold text-slate-600"
        onClick={() => setOpen((current) => !current)}
      >
        <span>Nguồn tham khảo ({contexts.length})</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="grid gap-3 border-t border-slate-100 p-3">
          {contexts.map((context, index) => {
            const metadata = context.metadata || {};
            return (
              <article key={`${metadata.document_id || metadata.url || "context"}-${index}`} className="rounded-xl border border-slate-100 bg-white p-3">
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  <span>{metadata.source_name || metadata.url || "context"}</span>
                  <span>{metadata.topic || "general"}</span>
                  <span>score {formatScore(context.score ?? metadata.score)}</span>
                </div>
                <div className="mt-2 text-sm font-bold text-ink">
                  {metadata.title || `Context ${index + 1}`}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-500">
                  {truncate(context.text || context.content || metadata.chunk || "", 260)}
                </p>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
