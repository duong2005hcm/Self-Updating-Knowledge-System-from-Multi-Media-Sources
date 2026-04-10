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

const PROMPT_BASE_CANDIDATES = [
  `${RAG_BASE_URL}/api/admin/prompts`,
  `${RAG_BASE_URL}/admin/prompts`,
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

router.use(async (req, res) => {
  const tail = req.path && req.path !== "/" ? req.path : "";
  const query = getRawQuery(req);
  const tag = `${req.method} /api/admin/prompts${tail}${query}`;

  try {
    for (let i = 0; i < PROMPT_BASE_CANDIDATES.length; i += 1) {
      const upstreamUrl = `${PROMPT_BASE_CANDIDATES[i]}${tail}${query}`;
      log("->", tag, { upstreamUrl });

      const response = await axios({
        method: req.method,
        url: upstreamUrl,
        data: req.body,
        headers: {
          "Content-Type": "application/json",
          ...buildUpstreamAuthHeaders(req),
        },
        validateStatus: () => true,
        timeout: 120000,
      });

      if (response.status !== 404 || i === PROMPT_BASE_CANDIDATES.length - 1) {
        return mirrorPythonResponse(res, response, tag);
      }
    }
  } catch (error) {
    return sendPythonOffline(res, error, tag);
  }

  return res.status(500).json({ message: "Unexpected proxy flow in adminPromptsRoute" });
});

module.exports = router;
