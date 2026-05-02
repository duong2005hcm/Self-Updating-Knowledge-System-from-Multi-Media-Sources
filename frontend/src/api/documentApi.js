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

function normalizeDocumentFileError(error) {
  const message = error?.message || "";
  if (
    error?.status === 404 ||
    /Document file is not available|browser-accessible storage/i.test(message)
  ) {
    error.message =
      "Không tìm thấy URL PDF có thể mở trên trình duyệt. Hãy re-ingest tài liệu với Firebase Storage/GCS đã cấu hình.";
  }
  if (error?.status === 502) {
    error.message =
      "Backend không tạo được URL xem PDF từ storage. Kiểm tra bucket Firebase/GCS, quyền service account và file PDF đã upload.";
  }
  return error;
}

export function getDocumentFileUrl(documentId, options = {}) {
  return apiRequest(`/api/documents/${documentId}/file`, {
    token: options.token,
    params: {
      disposition: options.mode === "download" ? "attachment" : "inline",
    },
  });
}

export async function openDocumentFile(documentId, options = {}) {
  let response;
  try {
    response = await getDocumentFileUrl(documentId, {
      token: options.token,
      mode: options.mode,
    });
  } catch (error) {
    throw normalizeDocumentFileError(error);
  }

  const fileUrl = response?.file_url;
  if (!fileUrl) {
    throw new Error("Backend chưa trả về URL PDF hợp lệ.");
  }

  if (options.mode === "download") {
    const anchor = document.createElement("a");
    anchor.href = fileUrl;
    anchor.download = response.filename || options.fileName || `document-${documentId}.pdf`;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } else {
    if (options.targetWindow && !options.targetWindow.closed) {
      options.targetWindow.location.href = fileUrl;
    } else {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
    }
  }
}
