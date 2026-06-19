import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { config } from "./config.js";

let client = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function healthUrl() {
  return config.mcpUrl.replace(/\/mcp\/?$/, "/health");
}

function createMcpClient() {
  return new MultiServerMCPClient({
    throwOnLoadError: true,
    prefixToolNameWithServerName: false,
    mcpServers: { news: { url: config.mcpUrl } },
  });
}

async function wakeMcp(maxAttempts = 10, delayMs = 15000) {
  const url = healthUrl();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (res.ok) {
        console.log(`news-mcp ready: ${url}`);
        await sleep(5000);
        return;
      }
      console.log(`news-mcp wake ${attempt}/${maxAttempts}: HTTP ${res.status}`);
    } catch (err) {
      console.log(`news-mcp wake ${attempt}/${maxAttempts}: ${err.message}`);
    }
    if (attempt < maxAttempts) await sleep(delayMs);
  }
  throw new Error(`news-mcp not reachable at ${url}. Open in browser, wait ~60s, redeploy.`);
}

export async function loadMcpTools() {
  await wakeMcp();

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      client = createMcpClient();
      const tools = await client.getTools();
      console.log(
        `MCP connected: ${config.mcpUrl} (${tools.map((t) => t.name).join(", ")})`
      );
      return tools;
    } catch (err) {
      if (client) {
        await client.close().catch(() => {});
        client = null;
      }
      console.log(`MCP connect ${attempt}/5 failed: ${err.message}`);
      if (attempt === 5) throw err;
      await sleep(10000);
    }
  }
  throw new Error("MCP connect failed");
}

export async function closeMcpClient() {
  if (client) {
    await client.close();
    client = null;
  }
}
