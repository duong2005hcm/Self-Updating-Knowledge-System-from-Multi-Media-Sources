import { ChevronDown, ExternalLink, FileText, Globe, Rows3 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatScore, truncate } from "../../lib/utils";

function getContextKey(context, index) {
  const metadata = context.metadata || {};
  return [
    context.document_id || metadata.document_id || "context",
    context.chunk_id || metadata.chunk_id || index,
    context.collection || metadata.collection || "collection",
  ].join("-");
}

function getCollectionLabel(context) {
  const metadata = context.metadata || {};
  const collection = String(context.collection || metadata.collection || "").trim();
  if (collection === "rag_web_pdf") {
    return "Web/PDF";
  }
  if (collection === "rag_pdf") {
    return "PDF";
  }
  return collection || "Nguồn";
}

function getCollectionTone(context) {
  const metadata = context.metadata || {};
  const collection = String(context.collection || metadata.collection || "").trim();
  if (collection === "rag_web_pdf") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export default function ContextSources({ contexts = [] }) {
  const [open, setOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState({});
  const items = useMemo(() => contexts.filter(Boolean), [contexts]);

  if (!items.length) return null;

  return (
    <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-bold text-slate-600"
        onClick={() => setOpen((current) => !current)}
      >
        <span>Nguồn tham khảo đã dùng ({items.length})</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="grid gap-3 border-t border-slate-100 p-3">
          {items.map((context, index) => {
            const metadata = context.metadata || {};
            const key = getContextKey(context, index);
            const expanded = expandedKeys[key] === true;
            const title = context.title || metadata.title || `Context ${index + 1}`;
            const page = context.page || metadata.page_numbers || metadata.page_start;
            const sourceUrl = context.source_url || metadata.source_url || metadata.url || "";
            const documentId = context.document_id || metadata.document_id || "";
            const snippet = context.content || context.text || "";

            return (
              <article
                key={key}
                className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  <span className={`rounded-full border px-2.5 py-1 ${getCollectionTone(context)}`}>
                    {getCollectionLabel(context)}
                  </span>
                  {page ? <span>Trang {page}</span> : null}
                  <span>Độ liên quan {formatScore(context.score ?? metadata.score)}</span>
                </div>

                <div className="mt-3 text-sm font-bold text-ink">{title}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {metadata.topic || context.topic || metadata.source_name || "Kho tri thức sức khỏe"}
                </div>

                <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-500">
                  {expanded ? snippet : truncate(snippet, 220)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {documentId ? (
                    <Link
                      to={`/documents/${documentId}`}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Xem tài liệu
                    </Link>
                  ) : null}
                  {sourceUrl ? (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Mở nguồn
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  {snippet ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
                      onClick={() =>
                        setExpandedKeys((current) => ({ ...current, [key]: !expanded }))
                      }
                    >
                      <Rows3 className="h-3.5 w-3.5" />
                      {expanded ? "Thu gọn đoạn nguồn" : "Xem đoạn nguồn"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
