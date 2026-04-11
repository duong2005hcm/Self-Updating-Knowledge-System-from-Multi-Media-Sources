import React from "react";
import { CONTACT, FOOTER_LINKS } from "../../constants/landingData";

function FooterColumn({ title, items, onOpenContact }) {
  return (
    <div>
      <p className="m-0 text-sm font-black text-slate-900">{title}</p>
      <ul className="mt-3 list-none space-y-2 p-0">
        {items.map((item) => {
          const isContact = item === "Liên h? tu v?n";
          if (isContact) {
            return (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => onOpenContact?.("consultation")}
                  className="border-none bg-transparent p-0 text-left text-sm font-semibold text-slate-600 transition hover:text-blue-700"
                >
                  {item}
                </button>
              </li>
            );
          }

          return (
            <li key={item}>
              <a href="#hero" className="text-sm text-slate-600 no-underline transition hover:text-blue-700">
                {item}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function LandingFooter({ onOpenContact }) {
  return (
    <footer className="mt-14 border-t border-slate-200/70 bg-white/55 px-4 pb-10 pt-10 backdrop-blur-[2px] md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <img
                src="/smilesi_ai.png"
                alt="SIMLESI AI logo"
                className="h-10 w-10 rounded-xl border border-blue-100 object-cover shadow-sm"
              />
              <p className="m-0 text-xl font-black tracking-tight text-slate-900">SIMLESI AI</p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              N?n t?ng AI t? d?ng thu th?p và c?p nh?t tri th?c da ngu?n, t?i uu h?i dáp n?i b? theo mô hình RAG.
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p className="m-0">
                Ði?n tho?i:{" "}
                <a href={`tel:${CONTACT.phone}`} className="font-semibold text-blue-700 no-underline">
                  {CONTACT.phone}
                </a>
              </p>
              <p className="m-0">
                Email:{" "}
                <a href={`mailto:${CONTACT.email}`} className="font-semibold text-blue-700 no-underline">
                  {CONTACT.email}
                </a>
              </p>
              <p className="m-0">Ð?a ch?: {CONTACT.address}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <a
                href={CONTACT.facebook}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 no-underline transition hover:border-blue-200 hover:text-blue-700"
              >
                Facebook
              </a>
              <a
                href={CONTACT.github}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 no-underline transition hover:border-blue-200 hover:text-blue-700"
              >
                GitHub
              </a>
              <a
                href={CONTACT.linkedin}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 no-underline transition hover:border-blue-200 hover:text-blue-700"
              >
                LinkedIn
              </a>
            </div>
          </div>

          <FooterColumn title="S?n ph?m" items={FOOTER_LINKS.product} />
          <FooterColumn title="Gi?i pháp" items={FOOTER_LINKS.solution} />
          <FooterColumn
            title="Tài nguyên"
            items={FOOTER_LINKS.resources}
            onOpenContact={onOpenContact}
          />
        </div>

        <div className="mt-8 border-t border-slate-200 pt-4 text-xs font-semibold text-slate-500">
          © 2026 SIMLESI AI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

