import { cn } from "../../lib/utils";

function ChartCard({ title, description, children }) {
  return (
    <div className="glass-panel flex h-full flex-col p-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="mt-6 flex min-h-[18rem] flex-1">{children}</div>
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function DonutChart({ items = [], centerValue, centerLabel }) {
  const safeItems = items.filter((item) => Number(item.value) > 0);
  const total = safeItems.reduce((sum, item) => sum + Number(item.value || 0), 0);

  if (!total) {
    return null;
  }

  let offset = 0;
  const segments = safeItems.map((item) => {
    const portion = (Number(item.value || 0) / total) * 100;
    const segment = `${item.color} ${offset}% ${offset + portion}%`;
    offset += portion;
    return segment;
  });

  return (
    <div className="grid h-full w-full gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
      <div className="flex items-center justify-center">
        <div
          className="relative h-44 w-44 rounded-full"
          style={{ background: `conic-gradient(${segments.join(", ")})` }}
        >
          <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
            <div className="font-display text-3xl font-bold text-ink">{centerValue}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              {centerLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {safeItems.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate text-sm font-semibold text-slate-700">{item.label}</span>
              </div>
              <span className="text-sm font-bold text-ink">{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DocumentStatusChart({ items = [] }) {
  if (!items.length) {
    return (
      <ChartCard
        title="Trạng thái tài liệu"
        description="Tỷ trọng tài liệu theo trạng thái hiện có trong kho tri thức."
      >
        <EmptyChart message="Chưa có dữ liệu trạng thái tài liệu." />
      </ChartCard>
    );
  }

  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <ChartCard
      title="Trạng thái tài liệu"
      description="Tỷ trọng tài liệu theo trạng thái hiện có trong kho tri thức."
    >
      <DonutChart items={items} centerValue={total} centerLabel="documents" />
    </ChartCard>
  );
}

export function SourceTypeChart({ items = [] }) {
  if (!items.length) {
    return (
      <ChartCard
        title="Nguồn tri thức theo loại"
        description="Phân bố loại nguồn để admin nhìn nhanh cấu trúc dữ liệu hiện tại."
      >
        <EmptyChart message="Chưa có dữ liệu loại nguồn." />
      </ChartCard>
    );
  }

  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <ChartCard
      title="Nguồn tri thức theo loại"
      description="Phân bố loại nguồn để admin nhìn nhanh cấu trúc dữ liệu hiện tại."
    >
      <DonutChart items={items} centerValue={total} centerLabel="sources" />
    </ChartCard>
  );
}

function BarLegend({ items }) {
  return (
    <div className="mb-5 flex flex-wrap gap-3">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

export function IngestResultsChart({ items = [] }) {
  const series = [
    { key: "created", label: "Created", color: "#0ea5e9" },
    { key: "updated", label: "Updated", color: "#14b8a6" },
    { key: "skipped", label: "Skipped", color: "#f59e0b" },
    { key: "failed", label: "Failed", color: "#ef4444" },
  ];

  if (!items.length) {
    return (
      <ChartCard
        title="Kết quả ingest gần đây"
        description="Nhóm theo ngày để theo dõi số lượng tạo mới, cập nhật, bỏ qua và lỗi."
      >
        <EmptyChart message="Chưa có dữ liệu ingest gần đây." />
      </ChartCard>
    );
  }

  const maxValue = Math.max(
    1,
    ...items.flatMap((item) => series.map((entry) => Number(item[entry.key] || 0)))
  );

  return (
    <ChartCard
      title="Kết quả ingest gần đây"
      description="Nhóm theo ngày để theo dõi số lượng tạo mới, cập nhật, bỏ qua và lỗi."
    >
      <div className="flex h-full w-full flex-col">
        <BarLegend items={series} />
        <div className="grid h-full grid-cols-7 gap-3">
          {items.map((item) => (
            <div key={item.label} className="flex min-w-0 flex-col justify-end">
              <div className="flex h-full items-end justify-center gap-1 rounded-3xl border border-slate-100 bg-slate-50 px-2 py-4">
                {series.map((entry) => {
                  const value = Number(item[entry.key] || 0);
                  const height = `${Math.max((value / maxValue) * 100, value > 0 ? 8 : 0)}%`;
                  return (
                    <div key={entry.key} className="flex h-full items-end">
                      <div
                        title={`${item.fullLabel} - ${entry.label}: ${value}`}
                        className={cn(
                          "w-3 rounded-t-full transition-opacity hover:opacity-80 sm:w-4"
                        )}
                        style={{
                          height,
                          backgroundColor: entry.color,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
