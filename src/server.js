import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { initAgent, runAgent } from "./agent.js";
import { closeMcpClient } from "./mcp.js";

const STARTUP_VERSION = "2026-05-31-listen-first-v2";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
let initAttempts = 0;

function requireApiKey(req, res, next) {
  if (!config.apiKey) return next();
  if (req.headers["x-api-key"] !== config.apiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: config.serviceName,
    version: STARTUP_VERSION,
    mcpUrl: config.mcpUrl,
    agentReady,
    initAttempts,
    ...(agentError ? { lastError: agentError } : {}),
  });
});

app.post("/v1/chat", requireApiKey, async (req, res) => {
  if (!agentReady) {
    return res.status(503).json({
      error: "Agent still connecting to news-mcp. Retry in 30–60s.",
      agentReady,
      initAttempts,
      lastError: agentError,
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

console.log(`[startup] ${config.serviceName} ${STARTUP_VERSION}`);

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`[startup] listening on 0.0.0.0:${config.port}`);
});

async function startAgentWithRetry() {
  while (true) {
    initAttempts += 1;
    try {
      console.log(`[startup] MCP init attempt ${initAttempts}...`);
      await initAgent();
      agentReady = true;
      agentError = null;
      console.log(`[startup] agent ready after ${initAttempts} attempt(s)`);
      return;
    } catch (err) {
      agentReady = false;
      agentError = err.message;
      console.error(`[startup] attempt ${initAttempts} failed: ${err.message}`);
      await sleep(30000);
    }
  }
}

startAgentWithRetry();

async function shutdown() {
  server.close();
  await closeMcpClient();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
