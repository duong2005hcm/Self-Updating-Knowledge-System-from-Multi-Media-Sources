import { stats } from "../../data/features";

export default function StatsSection() {
  return (
    <section className="page-shell pb-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="glass-panel p-6">
            <div className="font-display text-3xl font-extrabold text-ink">{item.value}</div>
            <div className="mt-2 text-sm font-medium text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
