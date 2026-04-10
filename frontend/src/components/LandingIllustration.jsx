import React from "react";

/**
 * Minh họa phẳng (điện thoại + chatbot) — tone xanh theo app, không phụ thuộc ảnh ngoài.
 */
export default function LandingIllustration() {
  return (
    <div className="landing-illustration" aria-hidden>
      <svg
        viewBox="0 0 420 360"
        className="landing-illustration-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="li-phone" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="li-bubble" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        {/* Decorative blobs */}
        <circle cx="72" cy="48" r="36" fill="rgba(37, 99, 235, 0.12)" />
        <circle cx="360" cy="280" r="48" fill="rgba(99, 102, 241, 0.1)" />
        <path
          d="M320 40c-8 18-4 38 8 52 6 7 14 12 22 14"
          fill="none"
          stroke="rgba(37, 99, 235, 0.2)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Phone body */}
        <rect
          x="118"
          y="52"
          width="184"
          height="320"
          rx="28"
          fill="url(#li-phone)"
          opacity="0.95"
        />
        <rect x="132" y="72" width="156" height="268" rx="12" fill="#f8fafc" />
        {/* Screen content: robot bubble */}
        <rect
          x="148"
          y="96"
          width="124"
          height="72"
          rx="16"
          fill="url(#li-bubble)"
          opacity="0.95"
        />
        <circle cx="188" cy="128" r="18" fill="#1e3a8a" opacity="0.9" />
        <circle cx="182" cy="124" r="4" fill="#fff" />
        <circle cx="194" cy="124" r="4" fill="#fff" />
        <circle cx="188" cy="134" r="4" fill="#fff" />
        {/* Chat lines */}
        <rect x="152" y="188" width="100" height="10" rx="4" fill="#cbd5e1" />
        <rect x="152" y="206" width="72" height="10" rx="4" fill="#e2e8f0" />
        <rect x="152" y="232" width="116" height="10" rx="4" fill="#cbd5e1" />
        <rect x="152" y="250" width="88" height="10" rx="4" fill="#e2e8f0" />
        {/* Person simplified */}
        <ellipse cx="300" cy="200" rx="22" ry="24" fill="#fbbf24" />
        <path
          d="M288 228c-4 28 8 52 24 64h-56c16-12 28-36 24-64z"
          fill="#2563eb"
        />
        <path d="M276 260l-12 48h24l-6-48z" fill="#1e40af" />
        <path d="M312 260l12 48h-24l6-48z" fill="#1e40af" />
        <rect x="268" y="216" width="64" height="56" rx="8" fill="#ef4444" opacity="0.9" />
        {/* Small gear */}
        <circle cx="88" cy="200" r="16" fill="none" stroke="rgba(99, 102, 241, 0.35)" strokeWidth="6" />
        <circle cx="88" cy="200" r="6" fill="rgba(99, 102, 241, 0.35)" />
      </svg>
    </div>
  );
}
