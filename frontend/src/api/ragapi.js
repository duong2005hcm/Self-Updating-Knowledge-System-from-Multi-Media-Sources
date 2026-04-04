const BASE_URL = import.meta.env.VITE_API_URL;

// ====== ID helpers ======
function getUserId() {
  let userId = localStorage.getItem("user_id");

  if (!userId) {
    userId = "user_" + Math.random().toString(36).substring(2);
    localStorage.setItem("user_id", userId);
  }

  return userId;
}

function getConversationId() {
  let convoId = localStorage.getItem("conversation_id");

  if (!convoId) {
    convoId = "convo_" + Math.random().toString(36).substring(2);
    localStorage.setItem("conversation_id", convoId);
  }

  return convoId;
}

// ====== Health ======
export async function checkHealth() {
  const res = await fetch(`${BASE_URL}/api/health`);

  if (!res.ok) throw new Error("Health check failed");

  return res.json();
}

// ====== ASK RAG ======
export async function askRAG(question) {
  const user_id = getUserId();
  const conversation_id = getConversationId();

  const res = await fetch(`${BASE_URL}/api/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      user_id,
      conversation_id,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Ask RAG failed: " + err);
  }

  const data = await res.json();

  return {
    answer: data.answer,
    mode: data.mode,
    contexts: data.contexts || [],
  };
}

// ====== ADMIN INGEST PDF ======
export async function ingestDoc(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/api/admin/ingest/pdf`, {
    method: "POST",
    headers: {
      Authorization: "Bearer super_secret_admin",
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Ingest doc failed: " + err);
  }

  return res.json();
}

// ====== ADMIN INGEST WEB ======
export async function ingestWeb(url) {
  const res = await fetch(`${BASE_URL}/api/admin/ingest/web`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer super_secret_admin",
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Ingest web failed: " + err);
  }

  return res.json();
}

// ====== USER UPLOAD PDF (temporary context) ======
export async function uploadUserPDF(file) {
  const formData = new FormData();
  const conversation_id = getConversationId();

  formData.append("file", file);

  const res = await fetch(
    `${BASE_URL}/api/user/upload/pdf?conversation_id=${conversation_id}`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Upload user PDF failed: " + err);
  }

  return res.json();
}