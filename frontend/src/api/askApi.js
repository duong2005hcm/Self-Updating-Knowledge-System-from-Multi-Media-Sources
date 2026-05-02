import { apiRequest } from "./client";

export function askKnowledge(payload, token) {
  const body = {
    question: payload.question,
    user_id: payload.userId,
    conversation_id: payload.conversationId,
    stream: false,
  };

  if (payload.documentId) {
    body.document_id = payload.documentId;
  }

  if (payload.contextQuery) {
    body.context_query = payload.contextQuery;
  }

  if (payload.debug) {
    body.debug = true;
  }

  return apiRequest("/api/ask", {
    method: "POST",
    token,
    body,
  });
}

export function uploadChatPdf(file, conversationId, token) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest("/api/user/upload/pdf", {
    method: "POST",
    token,
    params: { conversation_id: conversationId },
    body: formData,
  });
}
