import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import OpenAI from "openai";
import "dotenv/config";

// Inline handler so you don't need a separate server file.
// Streams SSE frames: data: {"type":"token","content":"..."}\n\n
function openaiChatStreamPlugin() {
  return {
    name: "openai-chat-stream",
    configureServer(server: any) {
      server.middlewares.use("/api/chat", createHandler());
    },
    configurePreviewServer(server: any) {
      server.middlewares.use("/api/chat", createHandler());
    },
  };
}

function createHandler() {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  return async (req: any, res: any) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("Method Not Allowed");
    }

    try {
      // read JSON body
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const { model, messages, temperature, max_tokens } = JSON.parse(
        Buffer.concat(chunks).toString("utf8")
      );

      // SSE headers
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Stream via OpenAI Responses API
      // Event types include: response.output_text.delta, response.completed, etc.
      const stream = await client.responses.stream({
        model,
        input: messages, // you can pass a string or your chat array
        temperature,
        max_output_tokens: max_tokens ?? undefined,
      });

      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          res.write(
            `data: ${JSON.stringify({ type: "token", content: event.delta })}\n\n`
          );
        } else if (event.type === "response.completed") {
          res.write(`data: {"type":"done"}\n\n`);
          res.end();
          return;
        }
        // ignore other event types for brevity
      }

      // Fallback end
      res.write(`data: {"type":"done"}\n\n`);
      res.end();
    } catch (err: any) {
      res.statusCode = 400;
      res.end(String(err?.message || err));
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    openaiChatStreamPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
