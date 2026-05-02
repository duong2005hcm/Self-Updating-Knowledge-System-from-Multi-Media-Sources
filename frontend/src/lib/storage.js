const CONVERSATION_KEY = "health_knowledge_conversation_id";

function createConversationId() {
  return typeof crypto?.randomUUID === "function"
    ? `convo_${crypto.randomUUID()}`
    : `convo_${Date.now()}`;
}

export function getOrCreateConversationId() {
  const existing = window.localStorage.getItem(CONVERSATION_KEY);
  if (existing) return existing;

  const nextValue = createConversationId();
  window.localStorage.setItem(CONVERSATION_KEY, nextValue);
  return nextValue;
}

export function createNewConversationId() {
  const nextValue = createConversationId();
  window.localStorage.setItem(CONVERSATION_KEY, nextValue);
  return nextValue;
}
