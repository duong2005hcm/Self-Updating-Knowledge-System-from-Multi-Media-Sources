import React from "react";
import { Link } from "react-router-dom";
import LandingIllustration from "../LandingIllustration";
import { HERO_TAGS } from "../../data/landingData";

const TOPIC = "Hệ thống tri thức tự cập nhật từ đa nguồn đa phương tiện";

export default function HeroSection({ onOpenContact }) {
  return (
    <section className="scroll-mt-32 px-4 pt-6 md:px-6" id="hero">
      <div className="mx-auto max-w-7xl rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-soft backdrop-blur-md md:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_minmax(320px,0.9fr)]">
          <div>
            <p className="m-0 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-700">
              Đề tài · RAG & tri thức động
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-slate-900 md:text-5xl">
              {TOPIC}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
              Tích hợp tài liệu, web và nội dung đa phương tiện thành một kho kiến thức luôn được cập nhật.
              Hỏi đáp thông minh với trích dẫn nguồn rõ ràng và giao diện chat hiện đại.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onOpenContact?.("consultation")}
                className="rounded-full bg-gradient-to-r from-blue-700 to-indigo-600 px-6 py-3 text-sm font-extrabold text-white shadow-[0_16px_32px_rgba(29,78,216,0.32)] transition hover:translate-y-[-1px]"
              >
                Tìm hiểu thêm
              </button>
              <Link
                to="/login"
                className="rounded-full border border-blue-200 bg-white px-6 py-3 text-sm font-extrabold text-blue-700 no-underline transition hover:border-blue-300 hover:bg-blue-50"
              >
                Đã có tài khoản
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {HERO_TAGS.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-[420px]">
            <LandingIllustration />
          </div>
        </div>
      </div>
    </section>
  );
}
