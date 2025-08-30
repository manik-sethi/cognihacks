// src/server/openaiRoute.ts
import OpenAI from "openai";

/**
 * Returns a Node handler for SSE streaming at /api/chat
 * Reads { model, messages, temperature, max_tokens } from POST JSON.
 * Streams tokens as: data: {"type":"token","content":"..."}\n\n
 */
export function createOpenAIChatHandler() {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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

      // set SSE headers
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Stream with the Responses API (preferred going forward)
      const stream = await client.responses.stream({
        model,
        // You can also pass a single string. Using the whole chat array is fine too.
        input: messages,
        temperature,
        max_output_tokens: max_tokens ?? undefined,
      });

      for await (const event of stream) {
        // Token deltas arrive as "response.output_text.delta"
        if (event.type === "response.output_text.delta") {
          res.write(
            `data: ${JSON.stringify({ type: "token", content: event.delta })}\n\n`
          );
        }
        // You’ll also see response.completed when the model finishes
        if (event.type === "response.completed") {
          res.write(`data: {"type":"done"}\n\n`);
          res.end();
          return;
        }
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
