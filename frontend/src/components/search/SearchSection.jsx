import SearchEmptyState from "./SearchEmptyState";

export default function SearchSection({
  title,
  total = 0,
  items = [],
  emptyMessage,
  renderItem,
  showMoreLabel = "Xem thêm",
  onShowMore,
  compact = false,
}) {
  const visibleItems = compact ? items.slice(0, 3) : items;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{total} kết quả liên quan</p>
        </div>
        {compact && total > visibleItems.length ? (
          <button type="button" className="btn-secondary px-4 py-2" onClick={onShowMore}>
            {showMoreLabel}
          </button>
        ) : null}
      </div>

      {visibleItems.length === 0 ? (
        <SearchEmptyState message={emptyMessage} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleItems.map((item) => renderItem(item))}
        </div>
      )}
    </section>
  );
}
