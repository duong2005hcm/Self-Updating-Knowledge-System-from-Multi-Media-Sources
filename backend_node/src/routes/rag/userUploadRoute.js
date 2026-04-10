const express = require("express");
const multer = require("multer");
const FormData = require("form-data");
const {
  axios,
  RAG_BASE_URL,
  optionalAuthHeaders,
  log,
  mirrorPythonResponse,
  sendPythonOffline,
} = require("../../lib/ragUpstream");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post("/pdf", upload.single("file"), async (req, res) => {
  const tag = "POST /api/user/upload/pdf";
  if (!req.file) {
    return res.status(400).json({ message: "Thiếu file PDF (field: file)" });
  }

  log("→", tag, {
    filename: req.file.originalname,
    size: req.file.size,
  });

  try {
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype || "application/pdf",
    });

    const url = `${RAG_BASE_URL}/api/user/upload/pdf`;
    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        ...optionalAuthHeaders(req),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
      timeout: 300000,
    });

    return mirrorPythonResponse(res, response, tag);
  } catch (err) {
    return sendPythonOffline(res, err, tag);
  }
});

module.exports = router;
