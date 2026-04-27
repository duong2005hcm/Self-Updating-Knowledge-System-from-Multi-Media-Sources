import { apiRequest } from "./client";

export function searchDocuments(query, options = {}) {
  const normalizedQuery = String(query || "").trim();

  if (!normalizedQuery) {
    return Promise.resolve({
      status: "ok",
      items: [],
      total: 0,
      matched_total: 0,
      offset: 0,
      limit: 0,
    });
  }

  return apiRequest("/api/search", {
    params: {
      q: normalizedQuery,
      search_mode: options.searchMode || "hybrid",
      limit: Math.min(Number(options.limit || 10), 10),
      offset: options.offset || 0,
      domain: options.domain,
    },
  });
}
