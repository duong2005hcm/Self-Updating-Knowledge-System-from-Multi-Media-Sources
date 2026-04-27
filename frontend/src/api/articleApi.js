import { apiRequest } from "./client";

export function listArticles(params = {}, token) {
  return apiRequest("/api/articles", {
    token,
    params: {
      limit: params.limit || 20,
      status: params.status,
      visibility: params.visibility,
      topic: params.topic,
      source_name: params.sourceName,
      content_type: params.contentType,
    },
  });
}

export function listLatestArticles(limit = 6) {
  return listArticles({ limit });
}
