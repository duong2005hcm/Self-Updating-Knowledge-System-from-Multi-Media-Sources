import { apiRequest } from "./client";

export function getDocumentDetail(documentId, token) {
  return apiRequest(`/api/documents/${documentId}`, { token });
}

export function getDocumentChunks(documentId, options = {}) {
  return apiRequest(`/api/documents/${documentId}/chunks`, {
    token: options.token,
    params: {
      limit: options.limit || 5,
      preview_chars: options.previewChars || 500,
      include_content: options.includeContent ? "true" : undefined,
    },
  });
}

export function getDocumentPreview(documentId, options = {}) {
  return apiRequest(`/api/documents/${documentId}/preview`, {
    token: options.token,
    params: {
      q: options.query || undefined,
      limit: options.limit || 3,
      preview_chars: options.previewChars || 700,
    },
  });
}

export function listAdminDocuments(token, params = {}) {
  return apiRequest("/api/documents", {
    token,
    params: {
      limit: params.limit || 50,
      source_id: params.sourceId,
      status: params.status,
      domain: params.domain,
    },
  });
}

export function getDocumentVersions(documentId, token) {
  return apiRequest(`/api/documents/${documentId}/versions`, { token });
}

export async function openDocumentFile(documentId, options = {}) {
  const response = await apiRequest(`/api/documents/${documentId}/file`, {
    token: options.token,
    raw: true,
  });

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  if (options.mode === "download") {
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = options.fileName || `document-${documentId}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } else {
    window.open(blobUrl, "_blank", "noopener,noreferrer");
  }

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
