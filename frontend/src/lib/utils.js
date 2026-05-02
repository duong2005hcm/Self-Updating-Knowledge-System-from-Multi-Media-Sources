export function cn(...values) {
  return values.filter(Boolean).join(" ");
}

export function formatDate(value, locale = "vi-VN", options = {}) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  });
}

export function formatDateTime(value, locale = "vi-VN") {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatScore(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "N/A";
  return parsed.toFixed(3);
}

export function truncate(text, size = 160) {
  const normalized = String(text || "").trim();
  if (normalized.length <= size) return normalized;
  return `${normalized.slice(0, size).trim()}...`;
}

export function getTopicGradient(seed = "") {
  const gradients = [
    "from-brand-500 to-cyan-400",
    "from-mint-500 to-emerald-400",
    "from-sky-500 to-brand-300",
    "from-brand-700 to-mint-400",
  ];
  const index = Math.abs(
    Array.from(String(seed)).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  ) % gradients.length;
  return gradients[index];
}

export function getStatusTone(status = "") {
  const normalized = String(status).toLowerCase();

  if (["active", "approved", "success", "public"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["pending", "processing", "normal", "protected"].includes(normalized)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (["rejected", "failed", "deactivated", "inactive", "private"].includes(normalized)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function getArticleTopicLabel(article, fallback = "Tin tức") {
  const source = String(article?.source_name || article?.source || "").toLowerCase();
  if (source.includes("bộ y tế") || source === "moh") {
    return "Tin tức";
  }

  return article?.topic || article?.tags?.[0] || article?.content_type || fallback;
}
