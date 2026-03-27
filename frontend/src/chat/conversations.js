const KEY = "ragai_conversations_v1";

function now() {
  return Date.now();
}

export function newConversation() {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    title: "Chat mới",
    createdAt: now(),
    updatedAt: now(),
    messages: [],
  };
}

export function loadConversations() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.conversations || !Array.isArray(parsed.conversations)) return null;
    return {
      activeId: parsed.activeId ?? null,
      conversations: parsed.conversations,
    };
  } catch {
    return null;
  }
}

export function saveConversations({ conversations, activeId }) {
  localStorage.setItem(KEY, JSON.stringify({ conversations, activeId }));
}

export function computeTitle(messages) {
  const firstUser = messages.find((m) => m.role === "user" && (m.content || "").trim());
  const t = (firstUser?.content || "").trim();
  if (!t) return "Chat mới";
  return t.length > 36 ? `${t.slice(0, 36)}…` : t;
}

export function lastPreview(messages) {
  const last = [...messages].reverse().find((m) => (m.content || "").trim());
  const t = (last?.content || "").trim();
  if (!t) return "";
  return t.length > 44 ? `${t.slice(0, 44)}…` : t;
}

