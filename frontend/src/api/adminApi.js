import { apiRequest } from "./client";

export function listSources(token) {
  return apiRequest("/api/sources", { token });
}

export function getSource(sourceId, token) {
  return apiRequest(`/api/sources/${sourceId}`, { token });
}

export function createSource(payload, token) {
  return apiRequest("/api/sources", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateSource(sourceId, payload, token) {
  return apiRequest(`/api/sources/${sourceId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export function toggleSource(sourceId, token) {
  return apiRequest(`/api/sources/${sourceId}/toggle`, {
    method: "PATCH",
    token,
  });
}

export function deleteSource(sourceId, token) {
  return apiRequest(`/api/sources/${sourceId}`, {
    method: "DELETE",
    token,
  });
}

export function ingestPdf(payload, token) {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("domain", payload.domain);
  formData.append("topic", payload.topic);
  formData.append("priority", payload.priority);
  formData.append("status", payload.status);
  formData.append("visibility", payload.visibility);
  formData.append("source_type", payload.sourceType);
  formData.append("created_by", payload.createdBy || "");
  if (payload.pdfUrl?.trim()) {
    formData.append("pdf_url", payload.pdfUrl.trim());
  }

  return apiRequest("/api/admin/ingest/pdf", {
    method: "POST",
    token,
    body: formData,
  });
}

export function ingestWeb(payload, token) {
  return apiRequest("/api/admin/ingest/web", {
    method: "POST",
    token,
    body: payload,
  });
}

export function saveDocumentSummary(documentId, payload, token) {
  return apiRequest(`/api/admin/documents/${documentId}/summary`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export function patchGovernance(documentId, action, token) {
  return apiRequest(`/api/admin/governance/documents/${documentId}/${action}`, {
    method: "PATCH",
    token,
  });
}

export function listPendingIngests(token, params = {}) {
  return apiRequest("/api/admin/pending-ingests", {
    token,
    params: {
      status: params.status,
      source_id: params.sourceId,
      corpus: params.corpus,
      content_subtype: params.contentSubtype,
      limit: params.limit || 50,
    },
  });
}

export function getPendingIngest(pendingId, token) {
  return apiRequest(`/api/admin/pending-ingests/${pendingId}`, { token });
}

export function approvePendingIngest(pendingId, token, payload = {}) {
  return apiRequest(`/api/admin/pending-ingests/${pendingId}/approve`, {
    method: "POST",
    token,
    body: payload,
  });
}

export function rejectPendingIngest(pendingId, token, payload = {}) {
  return apiRequest(`/api/admin/pending-ingests/${pendingId}/reject`, {
    method: "POST",
    token,
    body: payload,
  });
}

export function listPipelineJobs(token, params = {}) {
  return apiRequest("/api/pipeline/jobs", {
    token,
    params: {
      limit: params.limit || 50,
      status: params.status,
      source_id: params.sourceId,
    },
  });
}

export function getPipelineJob(jobId, token) {
  return apiRequest(`/api/pipeline/jobs/${jobId}`, { token });
}

export function ingestArticles(payload, token) {
  return apiRequest("/api/admin/articles/ingest", {
    method: "POST",
    token,
    body: payload,
  });
}

export function ingestMohArticles(token, overrides = {}) {
  return ingestArticles(
    {
      source_name: "moh",
      limit_per_source: 2,
      query: "health",
      topic: "Tin tức",
      tags: ["Tin tức", "Bộ Y tế", "Tin nổi bật"],
      ...overrides,
    },
    token
  );
}

export function listAdminArticles(token, params = {}) {
  return apiRequest("/api/admin/articles", {
    token,
    params: {
      limit: params.limit || 50,
      status: params.status,
      visibility: params.visibility,
      topic: params.topic,
      source_type: params.sourceType,
    },
  });
}

export function moderateArticle(articleId, action, token, body) {
  return apiRequest(`/api/admin/articles/${articleId}/${action}`, {
    method: "PATCH",
    token,
    body,
  });
}

export function approveArticle(articleId, token) {
  return moderateArticle(articleId, "approve", token, { status: "published" });
}

export function publishArticle(articleId, token) {
  return moderateArticle(articleId, "publish", token, { status: "published" });
}

export function rejectArticle(articleId, token) {
  return moderateArticle(articleId, "reject", token);
}

export function hideArticle(articleId, token) {
  return moderateArticle(articleId, "hide", token);
}

export function deleteArticle(articleId, token) {
  return apiRequest(`/api/admin/articles/${articleId}`, {
    method: "DELETE",
    token,
  });
}

export function createArticle(payload, token) {
  return apiRequest("/api/articles", {
    method: "POST",
    token,
    body: payload,
  });
}
