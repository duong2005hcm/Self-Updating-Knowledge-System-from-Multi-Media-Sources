const express = require("express");
const multer = require("multer");
const FormData = require("form-data");
const admin = require("firebase-admin");
const {
  axios,
  RAG_BASE_URL,
  optionalAuthHeaders,
  log,
  mirrorPythonResponse,
  sendPythonOffline,
} = require("../../lib/ragUpstream");

const router = express.Router();
const db = admin.apps.length ? admin.firestore() : null;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const PDF_ENDPOINT_CANDIDATES = [
  `${RAG_BASE_URL}/admin/ingest/pdf`,
  `${RAG_BASE_URL}/api/admin/ingest/pdf`,
  `${RAG_BASE_URL}/api/ingest/pdf`,
  `${RAG_BASE_URL}/ingest/pdf`,
];

const WEB_ENDPOINT_CANDIDATES = [
  `${RAG_BASE_URL}/admin/ingest/web`,
  `${RAG_BASE_URL}/api/admin/ingest/web`,
  `${RAG_BASE_URL}/api/ingest/web`,
  `${RAG_BASE_URL}/ingest/web`,
];

function buildUpstreamAuthHeaders(req) {
  const firebaseIdToken = String(req.headers["x-firebase-id-token"] || "").trim();
  if (firebaseIdToken) {
    return { Authorization: `Bearer ${firebaseIdToken}` };
  }
  return { ...optionalAuthHeaders(req) };
}

function asSafeText(value, fallback) {
  const text = String(value == null ? "" : value).trim();
  return text || fallback;
}

function normalizeIngestMetadata(body = {}) {
  const workflowName = asSafeText(
    body.n8n_workflow || body.workflow_name || body.workflow || body.n8nWorkflow,
    ""
  );
  const createdBy = asSafeText(body.created_by || body.createdBy, "");

  return {
    domain: asSafeText(body.domain, "general"),
    topic: asSafeText(body.topic, "general"),
    priority: asSafeText(body.priority, "normal"),
    status: asSafeText(body.status, "active"),
    source_type: asSafeText(body.source_type || body.sourceType, "Web"),
    created_by: createdBy,
    workflow_name: workflowName,
  };
}

async function logIngestUsage(req, eventType, metadata, payload, upstreamData) {
  if (!db) return;

  try {
    const actor =
      String(metadata.created_by || "").trim() ||
      String(req.authUser?.name || "").trim() ||
      String(req.authUser?.email || "").trim() ||
      String(req.authUser?.uid || "").trim() ||
      "admin";

    const workflowFromActor = (() => {
      const raw = String(actor);
      const match = raw.match(/^n8n\s*[:\-]\s*(.+)$/i);
      return match ? match[1].trim() : "";
    })();

    const workflowName =
      String(metadata.workflow_name || "").trim() ||
      String(payload?.workflow_name || "").trim() ||
      String(req.headers["x-n8n-workflow"] || "").trim() ||
      workflowFromActor ||
      null;

    await db.collection("usage_logs").add({
      eventType,
      tokens: 0,
      uid: req.authUser?.uid || null,
      actor,
      sourceType: metadata.source_type || null,
      domain: metadata.domain || null,
      topic: metadata.topic || null,
      priority: metadata.priority || null,
      status: metadata.status || null,
      workflowName,
      fileName: req.file?.originalname || null,
      url: payload?.url || null,
      limit: payload?.limit || null,
      chunksInserted: Number(upstreamData?.chunks_inserted || 0),
      filesProcessed: Number(upstreamData?.files_processed || 0),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    log("<-", "INGEST_USAGE_LOG", { message: error.message || String(error) });
  }
}

async function postToCandidates(candidates, configFactory, tag) {
  let lastResponse = null;

  for (let i = 0; i < candidates.length; i += 1) {
    const url = candidates[i];
    log("->", tag, { url });

    const response = await axios({
      method: "POST",
      url,
      ...configFactory(url),
      validateStatus: () => true,
      timeout: 300000,
    });

    lastResponse = response;
    if (response.status !== 404 || i === candidates.length - 1) {
      return response;
    }
  }

  return lastResponse;
}

router.post("/pdf", upload.single("file"), async (req, res) => {
  const tag = "POST /api/admin/ingest/pdf";
  if (!req.file) {
    return res.status(400).json({ message: "Thieu file PDF (field: file)" });
  }

  const metadata = normalizeIngestMetadata(req.body || {});
  const headerWorkflowName = asSafeText(req.headers["x-n8n-workflow"], "");
  if (!metadata.workflow_name && headerWorkflowName) {
    metadata.workflow_name = headerWorkflowName;
  }
  if (!metadata.created_by && metadata.workflow_name) {
    metadata.created_by = `n8n:${metadata.workflow_name}`;
  }
  metadata.source_type = asSafeText(metadata.source_type, "PDF");

  log("->", tag, {
    filename: req.file.originalname,
    size: req.file.size,
    metadata,
  });

  try {
    const response = await postToCandidates(
      PDF_ENDPOINT_CANDIDATES,
      () => {
        const form = new FormData();
        form.append("file", req.file.buffer, {
          filename: req.file.originalname,
          contentType: req.file.mimetype || "application/pdf",
        });

        form.append("domain", metadata.domain);
        form.append("topic", metadata.topic);
        form.append("priority", metadata.priority);
        form.append("status", metadata.status);
        form.append("source_type", metadata.source_type);
        if (metadata.created_by) {
          form.append("created_by", metadata.created_by);
        }
        if (metadata.workflow_name) {
          form.append("workflow_name", metadata.workflow_name);
        }

        return {
          data: form,
          headers: {
            ...form.getHeaders(),
            ...buildUpstreamAuthHeaders(req),
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        };
      },
      tag
    );

    if (response?.status >= 200 && response?.status < 300) {
      await logIngestUsage(req, "admin_ingest_pdf", metadata, null, response.data);
    }

    return mirrorPythonResponse(res, response, tag);
  } catch (err) {
    return sendPythonOffline(res, err, tag);
  }
});

router.post("/web", async (req, res) => {
  const tag = "POST /api/admin/ingest/web";
  const metadata = normalizeIngestMetadata(req.body || {});
  const headerWorkflowName = asSafeText(req.headers["x-n8n-workflow"], "");
  if (!metadata.workflow_name && headerWorkflowName) {
    metadata.workflow_name = headerWorkflowName;
  }
  if (!metadata.created_by && metadata.workflow_name) {
    metadata.created_by = `n8n:${metadata.workflow_name}`;
  }
  const payload = {
    url: String(req.body?.url || "").trim(),
    limit: Number(req.body?.limit) || 5,
    domain: metadata.domain,
    topic: metadata.topic,
    priority: metadata.priority,
    status: metadata.status,
    source_type: metadata.source_type,
    workflow_name: metadata.workflow_name || undefined,
  };

  if (metadata.created_by) {
    payload.created_by = metadata.created_by;
  }

  if (!payload.url) {
    return res.status(400).json({ ok: false, message: "Missing url" });
  }

  log("->", tag, { body: payload });

  try {
    const response = await postToCandidates(
      WEB_ENDPOINT_CANDIDATES,
      () => ({
        data: payload,
        headers: {
          "Content-Type": "application/json",
          ...buildUpstreamAuthHeaders(req),
        },
      }),
      tag
    );

    if (response?.status >= 200 && response?.status < 300) {
      await logIngestUsage(req, "admin_ingest_web", metadata, payload, response.data);
    }

    return mirrorPythonResponse(res, response, tag);
  } catch (err) {
    return sendPythonOffline(res, err, tag);
  }
});

module.exports = router;
