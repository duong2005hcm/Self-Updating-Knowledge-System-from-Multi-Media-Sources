export async function checkHealth() {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

export async function askRAG(question) {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Ask RAG failed: " + err);
  }

  return res.json(); 
  // expect: { answer: string, sources?: [] }
}

export async function ingestDoc(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/ingest/doc", {
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
  const res = await fetch("/api/ingest/web", {
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
