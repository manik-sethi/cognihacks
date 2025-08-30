import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Bot, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';

// ---------------------------------------------------------------------------
// Extension bridge + optional downscale
// ---------------------------------------------------------------------------

// Ask the Chrome extension (via content script) to capture the *current tab*.
// Returns a PNG data URL. Requires your MV3 extension (content + background)
// to be installed and permissioned for your app's origin.

async function requestTabScreenshot(): Promise<string> {
  return new Promise((resolve, reject) => {
    function onMsg(e: MessageEvent) {
      const m = (e as MessageEvent<any>).data;
      if (!m || m.__from !== 'EXT' || m.type !== 'CAPTURE_RESULT') return;
      window.removeEventListener('message', onMsg);
      if (m.ok && m.dataUrl) resolve(m.dataUrl);
      else reject(new Error(m.error || 'Capture failed'));
    }
    window.addEventListener('message', onMsg);
    window.postMessage({ __from: 'APP', type: 'REQUEST_CAPTURE' }, '*');
  });
}

// Downscale a big screenshot to save bandwidth/tokens
async function downscaleDataUrl(dataUrl: string, maxW = 1400): Promise<string> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((r) => {
    img.onload = () => r();
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxW / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(img.width * scale);
  canvas.height = Math.floor(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

// Optional: normalize “almost-LaTeX” into $…$ / $$…$$
function normalizeMath(s: string): string {
  // [ \hat{\theta} = ... ]  ->  $$ ... $$
  s = s.replace(/^\s*\[\s*([^][\n]*\\[^][\n]*)\s*\]\s*$/gm, (_m, inner) => `\n$$\n${inner}\n$$\n`);
  // (\theta) -> $\theta$
  s = s.replace(/\(([^()\n]*\\[^()\n]*)\)/g, (_m, inner) => `$${inner}$`);
  return s;
}

interface Message {
  id: number;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

interface ChatBotProps {
  /** When true, the chatbot renders as an inline panel instead of a floating widget. */
  inline?: boolean;
  /** Optional: pass a live confusion value from your store/hook */
  confusion?: number;
  /** Optional: override threshold (default 0.75) */
  confusionThreshold?: number;
}

export const ChatBot = ({
  inline = false,
  confusion = 0.29,
  confusionThreshold = 0.30,
}: ChatBotProps) => {
  const [isOpen, setIsOpen] = useState(inline);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hi! I'm your AI learning assistant. I can help explain concepts without giving away solutions. What would you like to know?",
      isBot: true,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nextIdRef = useRef<number>(2);

  useEffect(() => {
    // auto-scroll to bottom whenever messages change
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const stopStreaming = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  };

  // This is the new function to handle automatic capture and API call
  const triggerAutomaticCapture = async () => {
    if (isStreaming) return; // Prevent multiple calls while streaming

    const systemPrompt = "You are a helpful learning assistant. Respond in Markdown. For math, use $...$ for inline and $$...$$ for display. Analyze the user's confusion based on the provided image and offer a tutoring-style explanation to guide them toward a solution without giving away the final answer. Avoid giving full solutions unless explicitly asked.";
    
    // Add a placeholder message for the user so the AI can respond
    const assistantMessageId = nextIdRef.current++;
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      text: 'My sensors detect you may be confused. Let me help.',
      isBot: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantPlaceholder]);
    
    try {
      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;

      let images: string[] = [];
      try {
        const raw = await requestTabScreenshot();
        const small = await downscaleDataUrl(raw, 1400);
        images = [small];
        console.log('[App] Screenshot captured successfully and will be sent to API.');
      } catch (e) {
        // Non-fatal: continue without an image
        console.warn('Screenshot capture failed:', e);
      }
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }],
          images,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setIsStreaming(false);
        const errText = await res.text().catch(() => '');
        throw new Error(errText || `Bad response: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let acc = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        
        const frames = buf.split('\n\n');
        buf = frames.pop() ?? '';
        
        for (const f of frames) {
          if (!f.startsWith('data:')) continue;
          const json = f.slice(5).trim();
          if (!json) continue;
          const evt = JSON.parse(json) as
            | { type: 'token'; content: string }
            | { type: 'done' }
            | { type: 'error'; message: string };
          
          if (evt.type === 'token') {
            acc += evt.content;
            setMessages((prev) => {
              const copy = [...prev];
              const idx = copy.findIndex((m) => m.id === assistantMessageId);
              if (idx !== -1) copy[idx] = { ...copy[idx], text: acc };
              return copy;
            });
          } else if (evt.type === 'error') {
            throw new Error(evt.message);
          } else if (evt.type === 'done') {
            setIsStreaming(false);
          }
        }
      }
    } catch (err: any) {
      setIsStreaming(false);
      setMessages((prev) => [
        ...prev,
        {
          id: nextIdRef.current++,
          text: `Error: ${err?.message || String(err)}`,
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      abortRef.current = null;
    }
  };

  // This is the new useEffect hook for the automatic trigger
  useEffect(() => {
    console.log('useEffect triggered. Current confusion:', confusion);
    // Only trigger if the confusion is high and we are not already streaming
    if (confusion >= confusionThreshold && !isStreaming) {
      console.log('[App] Auto-trigger: Confusion threshold met. Requesting screenshot...');
      triggerAutomaticCapture();
    }
  }, [confusion, confusionThreshold, isStreaming]); // Re-run this effect whenever confusion changes

  // The rest of your sendMessage function remains the same for manual chat
  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: nextIdRef.current++,
      text: input,
      isBot: false,
      timestamp: new Date(),
    };

    // placeholder assistant message we will stream into
    const assistantMessageId = nextIdRef.current++;
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      text: '',
      isBot: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInput('');

    // Build chat history for the model
    const history = [
      {
        role: 'system',
        content:
          'You are a helpful learning assistant. Respond in Markdown. For math, use $...$ for inline and $$...$$ for display. Avoid giving full solutions unless explicitly asked.',
      },
      ...messages.map((m) => ({
        role: m.isBot ? 'assistant' : 'user', 
        content: m.text,
      })),
      { role: 'user' as const, content: userMessage.text },
    ];

    try {
      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: history,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setIsStreaming(false);
        const errText = await res.text().catch(() => '');
        throw new Error(errText || `Bad response: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let acc = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // Parse SSE frames: each event is "data: {...}\n\n"
        const frames = buf.split('\n\n');
        buf = frames.pop() ?? '';

        for (const f of frames) {
          if (!f.startsWith('data:')) continue;
          const json = f.slice(5).trim();
          if (!json) continue;

          const evt = JSON.parse(json) as
            | { type: 'token'; content: string }
            | { type: 'done' }
            | { type: 'error'; message: string };

          if (evt.type === 'token') {
            acc += evt.content;
            // update the last assistant message with the accumulated text
            setMessages((prev) => {
              const copy = [...prev];
              const idx = copy.findIndex((m) => m.id === assistantMessageId);
              if (idx !== -1) copy[idx] = { ...copy[idx], text: acc };
              return copy;
            });
          } else if (evt.type === 'error') {
            throw new Error(evt.message);
          } else if (evt.type === 'done') {
            setIsStreaming(false);
          }
        }
      }
    } catch (err: any) {
      setIsStreaming(false);
      // Show a simple error bubble
      setMessages((prev) => [
        ...prev,
        {
          id: nextIdRef.current++,
          text: `Error: ${err?.message || String(err)}`,
          isBot: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      abortRef.current = null;
    }
  };

  const chatContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="font-medium">AI Assistant</h4>
            <p className="text-xs text-muted-foreground">
              {isStreaming ? 'Streaming' : 'Online'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <Button variant="ghost" size="sm" onClick={stopStreaming} title="Stop">
              <Square className="w-4 h-4" />
            </Button>
          )}
          {!inline && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                stopStreaming();
                setIsOpen(false);
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('flex', message.isBot ? 'justify-start' : 'justify-end')}
          >
            <div
              className={cn(
                'max-w-[80%] p-3 rounded-lg text-sm whitespace-pre-wrap',
                message.isBot
                  ? 'bg-muted/50 text-foreground'
                  : 'bg-primary text-primary-foreground'
              )}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeHighlight]}
              >
                {normalizeMath(message.text)}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for help..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            className="flex-1"
            disabled={isStreaming}
          />
          <Button onClick={sendMessage} size="sm" disabled={isStreaming || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );

  if (inline) {
    return (
      <div
        className="glass-card rounded-xl border border-border/50 
                    flex flex-col min-h-0 overflow-hidden
                    h-[70vh] max-h-[85vh]"
      >
        {chatContent}
      </div>
    );
  }

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full glow-primary neural-pulse"
        size="lg"
        title="Open chat"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 w-80 h-96 glass-card
                 rounded-xl border border-border/50 flex flex-col
                 min-h-0 overflow-hidden"
    >
      {chatContent}
    </div>
  );
};