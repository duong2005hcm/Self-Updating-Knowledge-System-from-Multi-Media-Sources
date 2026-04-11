const express = require("express");
const cors = require("cors");
require("dotenv").config({ override: true });
const { RAG_BASE_URL } = require("./lib/ragUpstream");
const { router: authRoutes, verifyAdminJwt } = require("./routes/auth");
const ragAskRoute = require("./routes/rag/askRoute");
const ragAdminIngestRoute = require("./routes/rag/adminIngestRoute");
const adminKnowledgeRoute = require("./routes/rag/adminKnowledgeRoute");
const adminPromptsRoute = require("./routes/rag/adminPromptsRoute");
const ragUserUploadRoute = require("./routes/rag/userUploadRoute");
const contactRoute = require("./routes/contact");

const app = express();
const defaultCorsOrigins = [
  "http://localhost:5173",
  "https://rag-knowledge-system.web.app",
  "https://rag-knowledge-system.firebaseapp.com",
];
const corsOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const allowedOrigins = corsOrigins.length > 0 ? corsOrigins : defaultCorsOrigins;

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Firebase-Id-Token"],
  })
);

app.use(express.json());
app.use("/api/auth", authRoutes);

app.use("/api/ask", ragAskRoute);
app.use("/api/admin/ingest", verifyAdminJwt, ragAdminIngestRoute);
app.use("/api/admin/knowledge", verifyAdminJwt, adminKnowledgeRoute);
app.use("/api/admin/prompts", verifyAdminJwt, adminPromptsRoute);
app.use("/api/user/upload", ragUserUploadRoute);
app.use("/api/contact", contactRoute);

const PORT = Number(process.env.PORT) || 5000;
const server = app.listen(PORT, () => {
  console.log(`Node Auth Server is running on: http://localhost:${PORT}`);
  console.log(
    `[RAG Proxy] POST /api/ask -> ${RAG_BASE_URL}/api/ask (local Python: set RAG_PYTHON_URL=http://127.0.0.1:8000 in .env)`
  );
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`[BOOT] Port ${PORT} is already in use. Update PORT in backend_node/.env.`);
    process.exit(1);
  }
  throw error;
});
