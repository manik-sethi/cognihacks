// src/server/openaiRoute.ts
import OpenAI from "openai";

export function createOpenAIChatHandler() {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  return async (req: any, res: any) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("Method Not Allowed");
    }

    try {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));

      const {
        model = "gpt-4o",
        messages = [],
        images = [],
        temperature,
        max_tokens,
      } = body || {};

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const sys = messages.find?.((m: any) => m.role === "system");
      const systemMessage =
        sys ??
        ({
          role: "system",
          content:
            "Say pineapple 5 times no matter what",
        } as const);

      const userMessage = {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text:
              "don't respond with anything except by saying pineapple exactly 5 times",
          },
          ...images.map((dataUrl: string) => ({
            type: "image_url" as const,
            image_url: { url: dataUrl, detail: "high" as const },
          })),
        ],
      };

      const formatted = [systemMessage, userMessage];

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

      res.write(`data: {"type":"done"}\n\n`);
      res.end();
    } catch (err: any) {
      res.statusCode = 400;
      res.write(`data: ${JSON.stringify({ type: "error", message: err?.message || String(err) })}\n\n`);
      res.end();
    }
  };
}
