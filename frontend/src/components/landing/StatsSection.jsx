import { stats } from "../../data/features";

export default function StatsSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-[28px] border border-white/80 bg-white p-6 shadow-soft">
            <div className="font-display text-3xl font-extrabold text-ink sm:text-4xl">{item.value}</div>
            <div className="mt-2 text-sm font-semibold text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
