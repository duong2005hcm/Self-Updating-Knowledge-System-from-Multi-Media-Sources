const BASE_URL = import.meta.env.VITE_API_URL;

function getSessionId() {
  let sessionId = localStorage.getItem("session_id");

  if (!sessionId) {
    sessionId = "session_" + Math.random().toString(36).substring(2);
    localStorage.setItem("session_id", sessionId);
  }

  return sessionId;
}

export async function checkHealth() {
  const res = await fetch(`${BASE_URL}/api/health`);

  if (!res.ok) throw new Error("Health check failed");

  return res.json();
}

export async function askRAG(question) {
  const session_id = getSessionId();

  const res = await fetch(`${BASE_URL}/api/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      session_id,
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

export async function ingestDoc(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/api/ingest/pdf`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Ingest doc failed: " + err);
  }

  return res.json();
}

export async function ingestWeb(url) {
  const res = await fetch(`${BASE_URL}/api/ingest/web`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Ingest web failed: " + err);
  }

  return res.json();
}