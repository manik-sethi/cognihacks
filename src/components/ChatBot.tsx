// src/components/ChatBot.tsx
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';

/**
 * Requests a screenshot capture via the extension bridge.
 * Listens for a message with {__from:"EXT", type:"CAPTURE_RESULT", ok, base64/dataUrl}
 * Returns a fully formed data URL or rejects on error/timeout.
 */
function requestTabScreenshot(): Promise<string> {
  return new Promise((resolve, reject) => {
    let timeoutId: any;

    const onMsg = (e: MessageEvent) => {
      const m = e.data;
      if (!m || m.__from !== "EXT" || m.type !== "CAPTURE_RESULT") return;

      window.removeEventListener("message", onMsg);
      clearTimeout(timeoutId);

      const src = m.payload ?? m;
      const { ok, base64, dataUrl, error } = src || {};

      if (!ok) {
        reject(new Error(error || "Capture failed"));
        return;
      }

      const finalDataUrl =
        dataUrl ??
        (base64 ? `data:image/png;base64,${base64}` : null);

      if (!finalDataUrl) {
        reject(new Error("Empty screenshot data"));
        return;
      }

      console.log("[App] Received screenshot:", {
        base64Len: base64?.length ?? 0,
        head: finalDataUrl.slice(0, 40),
      });
      resolve(finalDataUrl);
    };

    window.addEventListener("message", onMsg);
    window.postMessage({ __from: "APP", type: "REQUEST_CAPTURE" }, "*");

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", onMsg);
      reject(new Error("Screenshot capture timed out"));
    }, 15000);
  });
}

const normalizeMath = (s: string) => s; // extend if needed

type Msg = {
  id: number;
  text: string;
  isBot: boolean;
  timestamp: Date;
};

export function ChatBot() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 1,
      text:
        "Hi! I'm your AI learning assistant. I can help explain concepts without giving away solutions. What would you like to know?",
      isBot: true,
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState('');           // <-- added
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nextIdRef = useRef<number>(2);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function sendMessage() {                     // <-- added
    if (!input.trim() || isStreaming) return;

    const userId = nextIdRef.current++;
    const assistantId = nextIdRef.current++;

    setMessages(prev => [
      ...prev,
      { id: userId, isBot: false, text: input, timestamp: new Date() },
      { id: assistantId, isBot: true, text: "", timestamp: new Date() },
    ]);

    const systemPrompt =
      "Say pineapple 5 times no matter what";

    try {
      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input.trim() },
          ],
          // no images for manual text messages
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`Bad response: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";

      setInput(''); // clear the input after send

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";

        for (const f of frames) {
          if (!f.startsWith("data:")) continue;
          const evt = JSON.parse(f.slice(5).trim());
          if (evt.type === "token") {
            acc += evt.content;
            setMessages(prev => {
              const copy = [...prev];
              const idx = copy.findIndex(m => m.id === assistantId);
              if (idx !== -1) copy[idx] = { ...copy[idx], text: acc };
              return copy;
            });
          } else if (evt.type === "done") {
            setIsStreaming(false);
          } else if (evt.type === "error") {
            throw new Error(evt.message);
          }
        }
      }
    } catch (e: any) {
      setIsStreaming(false);
      setMessages(prev => [
        ...prev,
        { id: nextIdRef.current++, isBot: true, text: `Error: ${e?.message ?? String(e)}`, timestamp: new Date() },
      ]);
    } finally {
      abortRef.current = null;
    }
  }

  const triggerAutoCapture = async () => {
    if (isStreaming) return;

    const systemPrompt =
      "You are a tutoring assistant. Use Markdown. If an image is provided, first describe what is on the screen, then tutor the user step-by-step without revealing final solutions.";

    const assistantId = nextIdRef.current++;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        text: "Analyzing your screen…",
        isBot: true,
        timestamp: new Date(),
      },
    ]);

    try {
      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;

      const dataUrl = await requestTabScreenshot();

      const body = {
        messages: [{ role: 'system', content: systemPrompt }],
        images: [dataUrl],
      };

      console.log("[App] Sending request to API:", {
        messagesCount: body.messages.length,
        imageCount: body.images.length,
        firstImageValid: body.images[0].startsWith("data:image/"),
        firstImageLength: body.images[0].length,
      });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`Bad response: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";

        for (const f of frames) {
          if (!f.startsWith("data:")) continue;
          const evt = JSON.parse(f.slice(5).trim()) as
            | { type: 'token'; content: string }
            | { type: 'done' }
            | { type: 'error'; message: string };

          if (evt.type === 'token') {
            acc += evt.content;
            setMessages((prev) => {
              const copy = [...prev];
              const idx = copy.findIndex((m) => m.id === assistantId);
              if (idx !== -1) copy[idx] = { ...copy[idx], text: acc };
              return copy;
            });
          } else if (evt.type === 'done') {
            setIsStreaming(false);
          } else if (evt.type === 'error') {
            throw new Error(evt.message);
          }
        }
      }
    } catch (e: any) {
      setIsStreaming(false);
      setMessages((prev) => [
        ...prev,
        {
          id: nextIdRef.current++,
          text: `Error: ${e?.message ?? String(e)}`,
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      abortRef.current = null;
    }
  };

  // Auto-trigger example
  useEffect(() => {
    const confusion = 0.5;
    const threshold = 0.3;
    console.log("useEffect triggered. confusion:", confusion, "auto-triggered:", hasAutoTriggered);
    if (!hasAutoTriggered && confusion >= threshold) {
      setHasAutoTriggered(true);
      console.log("[App] Auto-trigger: Confusion threshold met. Capturing screenshot...");
      triggerAutoCapture();
    }
  }, [hasAutoTriggered]);

  return (
    <div className="w-full h-[70vh] max-h-[85vh] border rounded-xl flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={m.isBot ? "text-left" : "text-right"}>
            <div
              className={`
                inline-block p-3 rounded-lg text-sm whitespace-pre-wrap
                ${m.isBot ? "bg-gray-800 text-gray-100" : "bg-blue-600 text-white"}
              `}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeHighlight]}
              >
                {normalizeMath(m.text)}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>

      {/* input bar (manual text messages) */}
      <div className="border-t p-3 flex gap-2">
        <input
          className="flex-1 rounded-md bg-zinc-800 text-zinc-100 px-3 py-2 outline-none border border-zinc-700"
          placeholder="Ask for help…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          disabled={isStreaming}
        />
        <button
          onClick={sendMessage}
          disabled={isStreaming || !input.trim()}
          className="px-3 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
