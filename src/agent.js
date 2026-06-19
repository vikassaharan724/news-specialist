import { MemorySaver } from "@langchain/langgraph";
import { createAgent } from "langchain";
import { config } from "./config.js";
import { loadMcpTools } from "./mcp.js";

const checkpointer = new MemorySaver();
let agent = null;

export async function initAgent() {
  const tools = await loadMcpTools();
  agent = createAgent({
    model: config.model,
    tools,
    checkpointer,
    systemPrompt: `You are a tech news specialist. Use search_tech_news for keyword searches and get_top_stories for headlines. Be concise and cite sources from tool output.`,
  });
}

function lastAssistantText(result) {
  for (let i = result.messages.length - 1; i >= 0; i--) {
    const msg = result.messages[i];
    const type = msg._getType?.() ?? msg.type;
    if (type === "ai" || type === "AIMessage") {
      const c = msg.content;
      if (typeof c === "string" && c.trim()) return c;
    }
  }
  return "";
}

export async function runAgent({ message, threadId = "default" }) {
  const result = await agent.invoke(
    { messages: [{ role: "user", content: message }] },
    { configurable: { thread_id: threadId } }
  );
  return { reply: lastAssistantText(result), threadId, pattern: "news-specialist" };
}
