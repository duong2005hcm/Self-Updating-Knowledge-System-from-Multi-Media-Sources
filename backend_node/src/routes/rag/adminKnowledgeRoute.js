const express = require("express");
const {
  axios,
  RAG_BASE_URL,
  optionalAuthHeaders,
  log,
  mirrorPythonResponse,
  sendPythonOffline,
} = require("../../lib/ragUpstream");

const router = express.Router();

const KNOWLEDGE_BASE_CANDIDATES = [
  `${RAG_BASE_URL}/admin/knowledge`,
  `${RAG_BASE_URL}/api/admin/knowledge`,
  `${RAG_BASE_URL}/api/knowledge`,
];

function getRawQuery(req) {
  const idx = req.originalUrl.indexOf("?");
  return idx >= 0 ? req.originalUrl.slice(idx) : "";
}

function buildUpstreamAuthHeaders(req) {
  const firebaseIdToken = String(req.headers["x-firebase-id-token"] || "").trim();
  if (firebaseIdToken) {
    return { Authorization: `Bearer ${firebaseIdToken}` };
  }
  return { ...optionalAuthHeaders(req) };
}

async function callKnowledgeUpstream(req, method, pathWithQuery, body, tag) {
  let lastResponse = null;

  for (let i = 0; i < KNOWLEDGE_BASE_CANDIDATES.length; i += 1) {
    const url = `${KNOWLEDGE_BASE_CANDIDATES[i]}${pathWithQuery}`;
    log("->", tag, { url, method });

    const response = await axios({
      method,
      url,
      data: body,
      headers: {
        "Content-Type": "application/json",
        ...buildUpstreamAuthHeaders(req),
      },
      validateStatus: () => true,
      timeout: 120000,
    });

    lastResponse = response;
    if (response.status !== 404 || i === KNOWLEDGE_BASE_CANDIDATES.length - 1) {
      return response;
    }
  }

  return lastResponse;
}

router.get("/collections", async (req, res) => {
  const tag = "GET /api/admin/knowledge/collections";
  try {
    const response = await callKnowledgeUpstream(req, "GET", "/collections", null, tag);
    return mirrorPythonResponse(res, response, tag);
  } catch (error) {
    return sendPythonOffline(res, error, tag);
  }
});

router.get("/:collectionName/chunks/:chunkId", async (req, res) => {
  const { collectionName, chunkId } = req.params;
  const query = getRawQuery(req);
  const pathWithQuery = `/${encodeURIComponent(collectionName)}/chunks/${encodeURIComponent(chunkId)}${query}`;
  const tag = `GET /api/admin/knowledge/${collectionName}/chunks/${chunkId}`;

  try {
    const response = await callKnowledgeUpstream(req, "GET", pathWithQuery, null, tag);
    return mirrorPythonResponse(res, response, tag);
  } catch (error) {
    return sendPythonOffline(res, error, tag);
  }
});

router.get("/:collectionName/chunks", async (req, res) => {
  const { collectionName } = req.params;
  const query = getRawQuery(req);
  const pathWithQuery = `/${encodeURIComponent(collectionName)}/chunks${query}`;
  const tag = `GET /api/admin/knowledge/${collectionName}/chunks`;

  try {
    const response = await callKnowledgeUpstream(req, "GET", pathWithQuery, null, tag);
    return mirrorPythonResponse(res, response, tag);
  } catch (error) {
    return sendPythonOffline(res, error, tag);
  }
});

router.get("/:collectionName/grouped", async (req, res) => {
  const { collectionName } = req.params;
  const query = getRawQuery(req);
  const pathWithQuery = `/${encodeURIComponent(collectionName)}/grouped${query}`;
  const tag = `GET /api/admin/knowledge/${collectionName}/grouped`;

  try {
    const response = await callKnowledgeUpstream(req, "GET", pathWithQuery, null, tag);
    return mirrorPythonResponse(res, response, tag);
  } catch (error) {
    return sendPythonOffline(res, error, tag);
  }
});

router.get("/:collectionName/sources", async (req, res) => {
  const { collectionName } = req.params;
  const query = getRawQuery(req);
  const pathWithQuery = `/${encodeURIComponent(collectionName)}/sources${query}`;
  const tag = `GET /api/admin/knowledge/${collectionName}/sources`;

  try {
    const response = await callKnowledgeUpstream(req, "GET", pathWithQuery, null, tag);
    return mirrorPythonResponse(res, response, tag);
  } catch (error) {
    return sendPythonOffline(res, error, tag);
  }
});

function normalizeSourcesToDocuments(collectionName, items) {
  return items.map((item, index) => {
    const sourceName = String(item?.source_name || "").trim() || `(unknown-${index})`;
    const sourceId = `${collectionName}:${sourceName}`;

    const createdBy = String(item?.created_by || "unknown");
    const workflowMatch = createdBy.match(/^n8n\s*[:\-]\s*(.+)$/i);

    return {
      id: sourceId,
      source_id: sourceId,
      collection_name: collectionName,
      name: sourceName,
      source_name: sourceName,
      source_type: item?.source_type || "Web",
      topic: item?.topic || "general",
      domain: item?.domain || "general",
      priority: item?.priority || "normal",
      status: item?.status || "active",
      created_by: createdBy,
      workflow_name: workflowMatch ? workflowMatch[1].trim() : null,
      total_chunks: Number(item?.total_chunks || 0),
      created_at: item?.last_crawled_at || null,
      last_crawled_at: item?.last_crawled_at || null,
      source_reliability: item?.source_reliability || "medium",
      update_frequency: item?.update_frequency || "manual",
      sample_ids: Array.isArray(item?.sample_ids) ? item.sample_ids : [],
      actions: Array.isArray(item?.actions) ? item.actions : [],
      mutable: false,
    };
  });
}

router.get("/list", async (req, res) => {
  const tag = "GET /api/admin/knowledge/list";

  try {
    const collectionsResp = await callKnowledgeUpstream(req, "GET", "/collections", null, tag);
    if (!collectionsResp || collectionsResp.status >= 400) {
      return mirrorPythonResponse(res, collectionsResp, tag);
    }

    const collections = Array.isArray(collectionsResp.data?.collections)
      ? collectionsResp.data.collections
      : [];

    const documents = [];

    for (const collection of collections) {
      const collectionName = String(collection?.name || "").trim();
      if (!collectionName) continue;

      const sourcesPath = `/${encodeURIComponent(collectionName)}/sources?batch_size=500&max_scan=20000`;
      const sourcesResp = await callKnowledgeUpstream(
        req,
        "GET",
        sourcesPath,
        null,
        `${tag} sources:${collectionName}`
      );

      if (!sourcesResp || sourcesResp.status >= 400) {
        continue;
      }

      const sourceItems = Array.isArray(sourcesResp.data?.items) ? sourcesResp.data.items : [];
      documents.push(...normalizeSourcesToDocuments(collectionName, sourceItems));
    }

    return res.json({ ok: true, source: "admin_knowledge_sources", collections, documents });
  } catch (error) {
    return sendPythonOffline(res, error, tag);
  }
});

function mutationNotSupported(req, res, method, routeTag) {
  const id = String(req.params.id || "").trim();
  if (!id) {
    return res.status(400).json({ ok: false, message: "Missing document id" });
  }

  return res.status(405).json({
    ok: false,
    message:
      `Method ${method} is not supported by current admin_knowledge API. ` +
      "Use /admin/ingest/pdf or /admin/ingest/web to add new knowledge.",
    id,
    route: routeTag,
  });
}

router.delete("/delete/:id", async (req, res) => {
  return mutationNotSupported(req, res, "DELETE", "DELETE /api/admin/knowledge/delete/:id");
});

router.delete("/:id", async (req, res) => {
  return mutationNotSupported(req, res, "DELETE", "DELETE /api/admin/knowledge/:id");
});

router.put("/update/:id", async (req, res) => {
  return mutationNotSupported(req, res, "PUT", "PUT /api/admin/knowledge/update/:id");
});

router.post("/update/:id", async (req, res) => {
  return mutationNotSupported(req, res, "POST", "POST /api/admin/knowledge/update/:id");
});

module.exports = router;
