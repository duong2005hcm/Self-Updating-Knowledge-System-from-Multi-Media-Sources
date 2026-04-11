import React from "react";
import { Link } from "react-router-dom";
import LandingIllustration from "../LandingIllustration";
import { HERO_TAGS } from "../../constants/landingData";

const TOPIC = "H? th?ng tri th?c t? c?p nh?t t? da ngu?n da phuong ti?n";

export default function HeroSection({ onOpenContact }) {
  return (
    <section className="scroll-mt-32 px-4 pt-6 md:px-6" id="hero">
      <div className="mx-auto max-w-7xl rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-soft backdrop-blur-md md:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_minmax(320px,0.9fr)]">
          <div>
            <p className="m-0 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-700">
              Ð? tài · RAG & tri th?c d?ng
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-slate-900 md:text-5xl">
              {TOPIC}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
              Tích h?p tài li?u, web và n?i dung da phuong ti?n thành m?t kho ki?n th?c luôn du?c c?p nh?t.
              H?i dáp thông minh v?i trích d?n ngu?n rõ ràng và giao di?n chat hi?n d?i.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onOpenContact?.("consultation")}
                className="rounded-full bg-gradient-to-r from-blue-700 to-indigo-600 px-6 py-3 text-sm font-extrabold text-white shadow-[0_16px_32px_rgba(29,78,216,0.32)] transition hover:translate-y-[-1px]"
              >
                Tìm hi?u thêm
              </button>
              <Link
                to="/login"
                className="rounded-full border border-blue-200 bg-white px-6 py-3 text-sm font-extrabold text-blue-700 no-underline transition hover:border-blue-300 hover:bg-blue-50"
              >
                Ðã có tài kho?n
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

