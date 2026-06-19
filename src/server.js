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

function requireApiKey(req, res, next) {
  if (!config.apiKey) return next();
  if (req.headers["x-api-key"] !== config.apiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: config.serviceName, mcpUrl: config.mcpUrl });
});

app.post("/v1/chat", requireApiKey, async (req, res) => {
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

await initAgent();
app.listen(config.port, () => console.log(`${config.serviceName} on port ${config.port}`));

process.on("SIGTERM", async () => {
  await closeMcpClient();
  process.exit(0);
});
