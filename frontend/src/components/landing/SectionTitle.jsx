import React from "react";

export default function SectionTitle({ badge, title, desc }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
        {badge}
      </span>
      <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-slate-900 md:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-base leading-relaxed text-slate-600 md:text-lg">{desc}</p>
    </div>
  );
}
