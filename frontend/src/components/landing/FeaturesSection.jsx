import React from "react";
import {
  BrainCircuit,
  DatabaseZap,
  Globe2,
  Layers3,
  MessageSquareMore,
  Quote,
} from "lucide-react";
import { FEATURES } from "../../data/landingData";
import SectionTitle from "./SectionTitle";
import SectionReveal from "./SectionReveal";

const ICON_MAP = {
  DatabaseZap,
  Globe2,
  Quote,
  Layers3,
  BrainCircuit,
  MessageSquareMore,
};

export default function FeaturesSection() {
  return (
    <section id="tinh-nang" className="scroll-mt-28 px-4 py-20 md:px-6">
      <div className="mx-auto max-w-7xl">
        <SectionReveal>
          <SectionTitle
            badge="Tính năng"
            title="Các năng lực nổi bật của SIMLESI AI"
            desc="Tập trung vào khả năng triển khai thực tế, truy xuất chính xác và mở rộng linh hoạt."
          />
        </SectionReveal>

        <SectionReveal className="mt-10">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((item) => {
              const Icon = ICON_MAP[item.icon];
              return (
                <article
                  key={item.title}
                  className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 transition hover:-translate-y-0.5 hover:border-blue-200"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    {Icon ? <Icon size={19} /> : null}
                  </div>
                  <h3 className="mt-4 text-base font-black text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
                </article>
              );
            })}
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
