import "dotenv/config";

const required = ["OPENAI_API_KEY"];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

export const config = {
  port: Number(process.env.PORT ?? 3005),
  model: process.env.MODEL ?? "openai:gpt-4o-mini",
  mcpUrl: process.env.NEWS_MCP_URL ?? "",
  serviceName: "news-specialist",
  apiKey: process.env.API_KEY ?? "",
  corsOrigins: (process.env.CORS_ORIGINS ?? "*").split(",").map((s) => s.trim()),
};

if (!config.mcpUrl) {
  console.error("Missing NEWS_MCP_URL");
  process.exit(1);
}
