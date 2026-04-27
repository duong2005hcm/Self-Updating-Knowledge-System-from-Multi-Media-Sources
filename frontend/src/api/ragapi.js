import { ingestPdf, ingestWeb } from "./adminApi";
import { askKnowledge, uploadChatPdf } from "./askApi";
import { getBackendHealth } from "./publicApi";
import { searchDocuments } from "./searchApi";
import { getOrCreateConversationId } from "../lib/storage";

export function checkHealth() {
  return getBackendHealth();
}

export function searchKnowledge(query, options = {}) {
  return searchDocuments(query, options);
}

export async function askRAG(question, options = {}) {
  if (!options.token) {
    throw new Error("askRAG yêu cầu Firebase ID token thật.");
  }

  return askKnowledge(
    {
      question,
      userId: options.userId,
      conversationId: options.conversationId || getOrCreateConversationId(),
    },
    options.token
  );
}

export async function ingestDoc(file, options = {}) {
  if (!options.token) {
    throw new Error("ingestDoc yêu cầu Firebase admin token thật.");
  }

  return ingestPdf(
    {
      file,
      domain: options.domain || "general",
      topic: options.topic || "general",
      priority: options.priority || "normal",
      status: options.status || "active",
      visibility: options.visibility || "public",
      sourceType: options.sourceType || "PDF",
      createdBy: options.createdBy || "",
    },
    options.token
  );
}

export async function ingestWebContent(url, options = {}) {
  if (!options.token) {
    throw new Error("ingestWebContent yêu cầu Firebase admin token thật.");
  }

  return ingestWeb(
    {
      url,
      limit: options.limit || 5,
      domain: options.domain || "general",
      topic: options.topic || "general",
      priority: options.priority || "normal",
      status: options.status || "active",
      visibility: options.visibility || "public",
      source_type: options.sourceType || "Web",
      created_by: options.createdBy || undefined,
    },
    options.token
  );
}

export function uploadUserPDF(file, options = {}) {
  return uploadChatPdf(file, options.conversationId || getOrCreateConversationId());
}
