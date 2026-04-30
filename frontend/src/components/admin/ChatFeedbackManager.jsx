import { CheckCircle2, EyeOff, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDateTime, truncate } from "../../lib/utils";

const filters = [
  { value: "all", label: "Tất cả" },
  { value: "helpful", label: "Hữu ích" },
  { value: "notHelpful", label: "Chưa hữu ích" },
  { value: "comment", label: "Có góp ý" },
  { value: "pending", label: "Chưa xử lý" },
  { value: "reviewed", label: "Đã xử lý" },
  { value: "hidden", label: "Đã ẩn" },
];

function statusOf(item) {
  return item.status || "active";
}

function matchesFilter(item, filter) {
  const status = statusOf(item);
  if (filter === "helpful") return item.helpful === true;
  if (filter === "notHelpful") return item.helpful === false;
  if (filter === "comment") return Boolean(String(item.comment || "").trim());
  if (filter === "pending") return status === "active";
  if (filter === "reviewed") return status === "reviewed";
  if (filter === "hidden") return status === "hidden";
  return true;
}

function matchesSearch(item, search) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return true;
  return [item.user_email, item.user_name, item.question, item.answer, item.comment, item.conversation_id]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

function StatusPill({ status }) {
  const normalized = status || "active";
  const tone =
    normalized === "hidden"
      ? "bg-slate-100 text-slate-600 ring-slate-200"
      : normalized === "reviewed"
        ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
        : "bg-amber-50 text-amber-700 ring-amber-100";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${tone}`}>
      {normalized}
    </span>
  );
}

function HelpfulBadge({ helpful }) {
  const Icon = helpful ? ThumbsUp : ThumbsDown;
  const tone = helpful
    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
    : "bg-rose-50 text-rose-700 ring-rose-100";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {helpful ? "Hữu ích" : "Chưa hữu ích"}
    </span>
  );
}

function ActionButtons({ item, busy, onUpdate }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="btn-ghost px-3 py-2 text-xs"
        disabled={busy}
        onClick={() => onUpdate(item, "reviewed")}
      >
        <CheckCircle2 className="h-4 w-4" />
        Đã xử lý
      </button>
      <button
        type="button"
        className="btn-ghost px-3 py-2 text-xs"
        disabled={busy}
        onClick={() => onUpdate(item, "hidden")}
      >
        <EyeOff className="h-4 w-4" />
        Ẩn
      </button>
      <button
        type="button"
        className="btn-ghost px-3 py-2 text-xs"
        disabled={busy}
        onClick={() => onUpdate(item, "active")}
      >
        <RotateCcw className="h-4 w-4" />
        Khôi phục
      </button>
    </div>
  );
}

export default function ChatFeedbackManager({
  items,
  filter,
  search,
  busy,
  onFilterChange,
  onSearchChange,
  onUpdate,
}) {
  const [expandedId, setExpandedId] = useState("");

  const visibleItems = useMemo(
    () => items.filter((item) => matchesFilter(item, filter) && matchesSearch(item, search)),
    [filter, items, search]
  );

  return (
    <div className="space-y-5">
      <div className="glass-panel grid gap-3 p-5 lg:grid-cols-[1fr_240px]">
        <input
          className="input-base"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Tìm theo email, câu hỏi, câu trả lời hoặc góp ý..."
        />
        <select
          className="input-base"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
        >
          {filters.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {visibleItems.length === 0 ? (
        <div className="glass-panel p-8 text-center text-sm text-slate-500">
          Chưa có feedback chatbox phù hợp bộ lọc.
        </div>
      ) : (
        <div className="grid gap-3">
          {visibleItems.map((item) => (
            <article key={item.id || item.feedback_id} className="glass-panel p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <HelpfulBadge helpful={item.helpful} />
                    <StatusPill status={statusOf(item)} />
                    <span className="text-xs font-semibold text-slate-500">
                      {formatDateTime(item.created_at || item.updated_at)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                    <span>{item.user_name || "Người dùng"}</span>
                    <span>{item.user_email || "Không có email"}</span>
                    <span>{item.contexts_count || 0} contexts</span>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
                        Question
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {truncate(item.question, expandedId === item.id ? 2000 : 220)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
                        Answer
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {truncate(item.answer, expandedId === item.id ? 3000 : 260)}
                      </p>
                    </div>
                  </div>

                  {item.comment ? (
                    <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-800">
                      <strong>Góp ý:</strong> {item.comment}
                    </div>
                  ) : null}

                  <div className="mt-3 text-xs text-slate-500">
                    Conversation: {item.conversation_id || "N/A"}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    type="button"
                    className="btn-secondary px-3 py-2 text-xs"
                    onClick={() => setExpandedId(expandedId === item.id ? "" : item.id)}
                  >
                    {expandedId === item.id ? "Thu gọn" : "Xem chi tiết"}
                  </button>
                  <ActionButtons item={item} busy={busy} onUpdate={onUpdate} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
