import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { NAV_ITEMS } from "../../constants/landingData";

const BRAND = "SIMLESI AI";

export default function LandingHeader({ onOpenContact }) {
  const [open, setOpen] = useState(false);

  const openConsultation = () => {
    onOpenContact?.("consultation");
    setOpen(false);
  };

  return (
    <header className="sticky top-3 z-40 px-4 pt-3 md:px-6">
      <div className="mx-auto max-w-7xl rounded-3xl border border-white/70 bg-white/85 px-4 py-3 shadow-soft backdrop-blur-md md:px-6">
        <div className="flex items-center justify-between gap-4">
          <a href="#" className="flex items-center gap-3 no-underline">
            <div className="h-11 w-11 overflow-hidden rounded-2xl bg-white ring-1 ring-blue-100 shadow-[0_14px_30px_rgba(37,99,235,0.22)]">
              <img src="/smilesi_ai.png" alt="SIMLESI AI logo" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="m-0 text-lg font-black tracking-tight text-slate-900">{BRAND}</p>
              <p className="m-0 text-xs font-semibold text-slate-500">Self-Updating Knowledge</p>
            </div>
          </a>

          <nav className="hidden items-center gap-2 lg:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 no-underline transition hover:bg-blue-50 hover:text-blue-700"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              to="/login"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 no-underline transition hover:border-blue-200 hover:text-blue-700"
            >
              Ðang nh?p
            </Link>
            <button
              type="button"
              onClick={openConsultation}
              className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 px-4 py-2 text-sm font-bold text-white no-underline shadow-[0_12px_30px_rgba(37,99,235,0.32)] transition hover:translate-y-[-1px] hover:shadow-[0_15px_34px_rgba(37,99,235,0.38)]"
            >
              Ðang ký
            </button>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 md:hidden"
            aria-label="M? menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {open && (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 md:hidden">
            <div className="grid grid-cols-2 gap-2">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-700 no-underline"
                >
                  {item.label}
                </a>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/login"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-bold text-slate-700 no-underline"
              >
                Ðang nh?p
              </Link>
              <button
                type="button"
                onClick={openConsultation}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 px-3 py-2 text-center text-sm font-bold text-white"
              >
                Ðang ký
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

