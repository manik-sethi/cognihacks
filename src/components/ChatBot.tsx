import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Bot, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Message {
  id: number;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

interface ChatBotProps {
  /** When true, the chatbot renders as an inline panel instead of a floating widget. */
  inline?: boolean;
}

export const ChatBot = ({ inline = false }: ChatBotProps) => {
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

    setMessages(prev => [...prev, userMessage, assistantPlaceholder]);
    setInput('');

    // Build chat history for the model
    const history = [
      { role: 'system', content: 'You are a helpful learning assistant. Give gentle hints and explanations. Avoid giving full solutions unless explicitly asked.' },
      ...messages.map(m => ({
        role: m.isBot ? 'assistant' as const : 'user' as const,
        content: m.text,
      })),
      { role: 'user' as const, content: userMessage.text },
    ];

    // Stream from /api/chat (Vite middleware using OpenAI JS SDK)
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
            setMessages(prev => {
              const copy = [...prev];
              const idx = copy.findIndex(m => m.id === assistantMessageId);
              if (idx !== -1) {
                copy[idx] = { ...copy[idx], text: acc };
              }
              return copy;
            });
          } else if (evt.type === 'error') {
            throw new Error(evt.message);
          } else if (evt.type === 'done') {
            // stream finished
            setIsStreaming(false);
          }
        }
      }
    } catch (err: any) {
      setIsStreaming(false);
      // Show a simple error bubble
      setMessages(prev => [
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
            <p className="text-xs text-muted-foreground">{isStreaming ? 'Streaming' : 'Online'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <Button variant="ghost" size="sm" onClick={stopStreaming} title="Stop">
              <Square className="w-4 h-4" />
            </Button>
          )}
          {!inline && (
            <Button variant="ghost" size="sm" onClick={() => { stopStreaming(); setIsOpen(false); }}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {messages.map(message => (
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
              {message.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask for help..."
            onKeyDown={e => {
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
      <div className="glass-card rounded-xl border border-border/50 
                      flex flex-col min-h-0 overflow-hidden
                      h-[70vh] max-h-[85vh]">
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
    <div className="fixed bottom-6 right-6 w-80 h-96 glass-card
                rounded-xl border border-border/50 flex flex-col
                min-h-0 overflow-hidden">
      {chatContent}
    </div>
  );
};
