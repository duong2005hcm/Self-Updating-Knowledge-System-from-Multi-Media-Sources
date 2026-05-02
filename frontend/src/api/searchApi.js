import { apiRequest } from "./client";

export function searchDocuments(query, options = {}) {
  const normalizedQuery = String(query || "").trim();
  const normalizedLimit = Number(options.limit || 10);
  const normalizedMode = options.searchMode || "hybrid";
  const defaultMinScore =
    options.minScore !== undefined
      ? options.minScore
      : normalizedMode === "keyword"
        ? 0
        : 0.35;

  if (!normalizedQuery) {
    return Promise.resolve({
      status: "ok",
      items: [],
      total: 0,
      matched_total: 0,
      offset: 0,
      limit: 0,
      message: "",
    });
  }

  return apiRequest("/api/search", {
    params: {
      q: normalizedQuery,
      search_mode: normalizedMode,
      min_score: defaultMinScore,
      debug: options.debug ? "true" : undefined,
      limit: Math.min(normalizedLimit, 10),
      offset: options.offset || 0,
      domain: options.domain,
    },
  });
}
