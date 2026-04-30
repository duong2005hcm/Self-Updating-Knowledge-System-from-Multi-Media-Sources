import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { apiRequest } from "./client";
import { getFirebaseApp, isFirebaseConfigured } from "../auth/firebase";

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  return String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function fallbackSourceUrl(payload) {
  if (payload.source_url?.trim()) {
    return payload.source_url.trim();
  }

  const slug = String(payload.title || "community-article")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://healthknowledge.vn";
  return `${origin}/blog/community/${slug || Date.now()}`;
}

function toCreateArticleRequest(payload) {
  const publishedAt = payload.published_at ? new Date(payload.published_at).toISOString() : undefined;

  return {
    title: payload.title.trim(),
    summary: (payload.excerpt || payload.summary || "").trim(),
    content: payload.content.trim(),
    content_type: "community",
    source_type: "community",
    source_name: payload.source_name || "Cộng đồng",
    source_url: fallbackSourceUrl(payload),
    image_url: (payload.image_url || "").trim() || null,
    author_id: payload.author_id || null,
    author_name: payload.author_name || null,
    published_at: publishedAt,
    topic: payload.topic,
    tags: normalizeTags(payload.tags),
    status: payload.status || "pending",
    visibility: "public",
  };
}

export function getArticles(params = {}, token) {
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

export function listArticles(params = {}, token) {
  return getArticles(params, token);
}

export function getMyArticles(params = {}, token) {
  return apiRequest("/api/articles/mine", {
    token,
    params: {
      limit: params.limit || 50,
      status: params.status,
    },
  });
}

export async function getLatestArticles(params = {}) {
  const query = {
    limit: params.limit || 6,
    topic: params.topic,
    source_name: params.sourceName,
  };

  try {
    return await apiRequest("/api/articles/latest", {
      params: query,
    });
  } catch {
    return getArticles({
      limit: query.limit,
      topic: query.topic,
      sourceName: params.sourceName,
      visibility: "public",
    });
  }
}

export function listLatestArticles(limit = 6, params = {}) {
  return getLatestArticles({ ...params, limit });
}

export function getArticle(articleId) {
  return apiRequest(`/api/articles/${articleId}`);
}

export function canUploadArticleImages() {
  return Boolean(isFirebaseConfigured && import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);
}

export async function createArticle(payload, token) {
  if (!token) {
    throw new Error("Bạn cần đăng nhập để tạo bài viết.");
  }

  try {
    return await apiRequest("/api/articles", {
      method: "POST",
      token,
      body: toCreateArticleRequest(payload),
    });
  } catch (error) {
    if ([403, 404, 422, 500].includes(error.status)) {
      throw new Error("Backend chưa hỗ trợ tạo bài viết hoặc định dạng dữ liệu chưa khớp.");
    }
    throw error;
  }
}

export async function uploadArticleImage(file) {
  if (!file) return null;

  const app = getFirebaseApp();
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;

  // TODO: Replace local preview with real upload API or Firebase Storage.
  if (!canUploadArticleImages() || !app || !storageBucket) {
    return null;
  }

  const storage = getStorage(app);
  const extension = file.name.split(".").pop() || "jpg";
  const objectRef = ref(storage, `article-images/${crypto.randomUUID()}.${extension}`);
  await uploadBytes(objectRef, file, { contentType: file.type });
  return getDownloadURL(objectRef);
}
