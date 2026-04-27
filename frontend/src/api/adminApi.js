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

export function patchGovernance(documentId, action, token) {
  return apiRequest(`/api/admin/governance/documents/${documentId}/${action}`, {
    method: "PATCH",
    token,
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

export function createArticle(payload, token) {
  return apiRequest("/api/articles", {
    method: "POST",
    token,
    body: payload,
  });
}
