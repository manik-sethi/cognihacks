// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import OpenAI from "openai";
import "dotenv/config";

/**
 * Inline backend for dev/preview.
 * Mounts /api/chat and streams SSE frames:
 *   data: {"type":"token","content":"..."}\n\n
 */
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
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  return async (req: any, res: any) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("Method Not Allowed");
    }

    try {
      // 1) Read JSON body
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));

      const {
        // Single source of truth: default model here
        model = "gpt-4o",
        messages = [],      // may include a system message
        images = [],        // full data URLs: data:image/...;base64,....
        temperature,
        max_tokens,
      } = body || {};

      // 2) SSE headers
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // 3) Build Chat Completions messages
      const sys = messages.find?.((m: any) => m.role === "system");
      const systemMessage =
        sys ??
        ({
          role: "system",
          content:
            "You are a helpful assistant who helps student learn concepts with kindness and compassionate. You teach using the socratic method, by asking questions instead of giving the solution. You refuse to give me the outright solution unless we are comparing final answers. Whenever you respond, you do so briefly, unless explicitly told to explain in long form",
        } as const);

      const userMessage = {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text:
              "I am struggling with this question, use the socratic method to help me understand, when you write latex, use $...$ or $$...$$, not square brackets. Do not reveal the entirety of the steps, guide me by askng me questions so I can get there. ALWAYS respond in less than 60 words",
          },
          ...images.map((dataUrl: string) => ({
            type: "image_url" as const,
            image_url: { url: dataUrl, detail: "high" as const },
          })),
        ],
      };

      const formatted = [systemMessage, userMessage];

      console.log("[/api/chat] Calling Chat Completions", {
        modelUsed: model,
        hasImage: userMessage.content.some((p) => p.type === "image_url"),
        parts: userMessage.content.length,
        imageHead: images[0]?.slice?.(0, 32),
      });

      // 4) Stream Chat Completions
      const stream = await client.chat.completions.create({
        model,
        messages: formatted,
        temperature,
        max_tokens: max_tokens ?? undefined,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) res.write(`data: ${JSON.stringify({ type: "token", content })}\n\n`);
        const finish = chunk.choices[0]?.finish_reason;
        if (finish) {
          res.write(`data: {"type":"done"}\n\n`);
          res.end();
          return;
        }
      }

      // Fallback end
      res.write(`data: {"type":"done"}\n\n`);
      res.end();
    } catch (err: any) {
      console.error("[/api/chat] Error:", err?.message);
      res.statusCode = 400;
      res.end(String(err?.message || err));
    }
  };
}

export default defineConfig(({ mode }) => ({
  server: { host: "::", port: 8080 },
  plugins: [react(), mode === "development" && componentTagger(), openaiChatStreamPlugin()].filter(
    Boolean
  ),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
