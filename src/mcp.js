import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { config } from "./config.js";

let client = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function healthUrl() {
  return config.mcpUrl.replace(/\/mcp\/?$/, "/health");
}

async function wakeMcp() {
  for (let i = 1; i <= 8; i++) {
    try {
      const res = await fetch(healthUrl(), { signal: AbortSignal.timeout(60000) });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    if (i < 8) await sleep(15000);
  }
  throw new Error(`MCP not reachable: ${healthUrl()}`);
}

export async function loadMcpTools() {
  await wakeMcp();
  client = new MultiServerMCPClient({
    throwOnLoadError: true,
    prefixToolNameWithServerName: false,
    mcpServers: { news: { url: config.mcpUrl } },
  });
  const tools = await client.getTools();
  console.log(`MCP tools: ${tools.map((t) => t.name).join(", ")}`);
  return tools;
}

export async function closeMcpClient() {
  if (client) {
    await client.close();
    client = null;
  }
}
