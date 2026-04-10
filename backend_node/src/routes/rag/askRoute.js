const express = require("express");
const crypto = require("crypto");
const {
  axios,
  RAG_BASE_URL,
  optionalAuthHeaders,
  log,
  mirrorPythonResponse,
  sendPythonOffline,
} = require("../../lib/ragUpstream");
const { verifyUserJwt } = require("../../middleware/verifyUserJwt");

const router = express.Router();

const DEFAULT_SYSTEM_PROMPT =
  "Ban la tro ly AI cua SIMLESI. Tra loi ro rang, lich su va uu tien ngu canh tai lieu RAG.";

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .map((item) => {
      if (typeof item === "string") {
        const content = item.trim();
        return content ? content : null;
      }

      if (!item || typeof item !== "object") return null;

      const role = String(item.role ?? "").trim();
      const content = String(item.content ?? "").trim();
      if (!content) return null;

      return role ? { ...item, role, content } : { ...item, content };
    })
    .filter(Boolean);
}

/**
 * In từng mục detail[].loc khi FastAPI trả 422 (biết trường nào thiếu/sai).
 */
function logFastApi422DetailLocs(data, tag) {
  const detail = data?.detail;
  if (!Array.isArray(detail) || detail.length === 0) return;

  detail.forEach((item, i) => {
    if (item && Object.prototype.hasOwnProperty.call(item, "loc")) {
      console.error(`[${tag}] 422 detail[${i}].loc:`, item.loc, "| msg:", item?.msg ?? item?.type);
    }
  });

  if (detail[0]?.loc !== undefined) {
    console.error(`[${tag}] detail[0].loc (shortcut):`, detail[0].loc);
  }
}

/**
 * In body lỗi: chuỗi thuần (HTML/text) vs object JSON đã parse.
 */
function logRawErrorData(data, label = "Raw Error Data") {
  if (data === undefined || data === null) {
    console.log(`${label}: (empty)`);
    return;
  }
  if (typeof data === "string") {
    console.log(`${label}:`, data.slice(0, 500));
    return;
  }
  if (typeof data === "object" && !Buffer.isBuffer(data)) {
    try {
      console.log(`${label} (JSON slice):`, JSON.stringify(data).slice(0, 500));
    } catch {
      console.log(`${label}:`, String(data).slice(0, 500));
    }
    return;
  }
  console.log(`${label}:`, String(data).slice(0, 500));
}

function logPythonUpstreamFailure(tag, errOrAxiosResponse) {
  const res = errOrAxiosResponse?.response ?? errOrAxiosResponse;
  const headers = res?.headers;
  const data = res?.data;
  const status = res?.status;

  console.log(
    "--- SERVER TYPE ---",
    headers?.server ?? headers?.Server ?? headers?.["server"]
  );
  if (status != null) {
    console.log(`[${tag}] upstream HTTP status:`, status);
  }
  logRawErrorData(data, "Raw Error Data");
}

function hasOpenAiEmptyInputError(data) {
  const text =
    typeof data === "string"
      ? data
      : (() => {
          try {
            return JSON.stringify(data ?? "");
          } catch {
            return String(data ?? "");
          }
        })();
  const normalized = text.toLowerCase();
  return (
    normalized.includes("input[0]") &&
    normalized.includes("empty string")
  );
}

function isUpstreamEmptyInputResponse(response) {
  return response?.status >= 400 && hasOpenAiEmptyInputError(response?.data);
}

function buildFallbackBodies(baseBody) {
  const prompt = baseBody.system_prompt || DEFAULT_SYSTEM_PROMPT;
  const base = {
    question: baseBody.question,
    user_id: baseBody.user_id,
    session_id: baseBody.session_id,
    conversation_id: crypto.randomUUID(),
    system_prompt: prompt,
  };

  return [
    base,
    {
      ...base,
      systemPrompt: prompt,
      prompt,
      history: [{ role: "user", content: baseBody.question }],
    },
  ];
}

/**
 * POST /api/ask — chuyển tiếp toàn bộ object từ Frontend sang Python (JSON).
 */
router.post("/", verifyUserJwt, async (req, res) => {
  const tag = "POST /api/ask";

  console.log("Dữ liệu nhận từ Frontend:", req.body);

  const forwardBody =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? { ...req.body }
      : {};

  if (forwardBody.question != null) {
    forwardBody.question = String(forwardBody.question).trim();
  }

  if (
    forwardBody.question === undefined ||
    forwardBody.question === null ||
    forwardBody.question === ""
  ) {
    return res.status(400).json({
      detail: [
        {
          loc: ["body", "question"],
          msg: "question là bắt buộc (string không rỗng)",
          type: "value_error",
        },
      ],
    });
  }

  /** Đồng bộ user_id / session_id với JWT (Firebase uid) — chống giả mạo */
  forwardBody.user_id = req.firebaseUid;
  forwardBody.session_id = req.firebaseUid;

  const cleanHistory = sanitizeHistory(forwardBody.history);
  if (cleanHistory.length > 0) {
    forwardBody.history = cleanHistory;
  } else {
    delete forwardBody.history;
  }

  const systemPrompt =
    forwardBody.system_prompt == null
      ? ""
      : String(forwardBody.system_prompt).trim();
  forwardBody.system_prompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

  if (
    forwardBody.conversation_id == null ||
    String(forwardBody.conversation_id).trim() === ""
  ) {
    forwardBody.conversation_id = crypto.randomUUID();
  } else {
    forwardBody.conversation_id = String(forwardBody.conversation_id).trim();
  }

  const pythonUrl = `${RAG_BASE_URL}/api/ask`;
  log("→", tag, { pythonUrl, forwardBody });

  try {
    const callPython = (body) =>
      axios.post(pythonUrl, body, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...optionalAuthHeaders(req),
        },
        validateStatus: () => true,
        timeout: 120000,
      });

    let response = await callPython(forwardBody);

    if (isUpstreamEmptyInputResponse(response)) {
      const fallbackBodies = buildFallbackBodies(forwardBody);
      for (let i = 0; i < fallbackBodies.length; i += 1) {
        const retryBody = fallbackBodies[i];
        console.warn(
          `[${tag}] Upstream empty input detected, retry attempt ${i + 1}/${fallbackBodies.length}.`
        );
        log("→", `${tag} retry`, { pythonUrl, retryBody });
        response = await callPython(retryBody);
        if (!isUpstreamEmptyInputResponse(response)) {
          break;
        }
      }
    }

    if (isUpstreamEmptyInputResponse(response)) {
      return res.status(502).json({
        code: "RAG_UPSTREAM_EMPTY_INPUT",
        message:
          "RAG Python đang lỗi xử lý dữ liệu đầu vào rỗng ở upstream. Vui lòng kiểm tra/deploy lại backend Python.",
        upstreamStatus: response.status,
      });
    }

    if (response.status === 422) {
      logFastApi422DetailLocs(response.data, tag);
    }

    if (response.status >= 500) {
      logPythonUpstreamFailure(tag, response);
    }

    if (response.status >= 400) {
      console.error(
        "[POST /api/ask] Python trả lỗi HTTP",
        response.status,
        "— error.response.data:",
        response.data
      );
    }

    return mirrorPythonResponse(res, response, tag);
  } catch (err) {
    console.error("[POST /api/ask] Catch — message:", err.message);
    logPythonUpstreamFailure(tag, err);
    if (err.response?.data) {
      logFastApi422DetailLocs(err.response.data, tag);
    }
    console.error(
      "[POST /api/ask] Python Error Detail (error.response?.data):",
      err.response?.data
    );
    return sendPythonOffline(res, err, tag);
  }
});

module.exports = router;
