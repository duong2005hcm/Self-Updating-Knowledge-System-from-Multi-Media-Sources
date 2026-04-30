import { apiRequest } from "./client";

export function askKnowledge(payload, token) {
  return apiRequest("/api/ask", {
    method: "POST",
    token,
    body: {
      question: payload.question,
      user_id: payload.userId,
      conversation_id: payload.conversationId,
      stream: false,
    },
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
