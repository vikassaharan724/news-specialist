import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { initAgent, runAgent } from "./agent.js";
import { closeMcpClient } from "./mcp.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: config.corsOrigins.includes("*") ? true : config.corsOrigins,
    methods: ["GET", "POST", "OPTIONS"],
  })
);

let agentReady = false;
let agentError = null;

function requireApiKey(req, res, next) {
  if (!config.apiKey) return next();
  if (req.headers["x-api-key"] !== config.apiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({
    ok: agentReady,
    service: config.serviceName,
    mcpUrl: config.mcpUrl,
    agentReady,
    ...(agentError ? { error: agentError } : {}),
  });
});

app.post("/v1/chat", requireApiKey, async (req, res) => {
  if (!agentReady) {
    return res.status(503).json({
      error: "Agent still starting (connecting to news-mcp). Retry in 30–60s.",
      detail: agentError,
    });
  }
  try {
    const message = String(req.body?.message ?? "").trim();
    if (!message) return res.status(400).json({ error: "message is required" });
    const threadId = String(req.body?.threadId ?? randomUUID());
    res.json(await runAgent({ message, threadId }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const server = app.listen(config.port, () => {
  console.log(`${config.serviceName} listening on port ${config.port}`);
});

initAgent()
  .then(() => {
    agentReady = true;
    agentError = null;
    console.log(`${config.serviceName} agent ready`);
  })
  .catch((err) => {
    agentError = err.message;
    console.error(`${config.serviceName} agent init failed:`, err);
  });

async function shutdown() {
  server.close();
  await closeMcpClient();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
