'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { Bot, X, Send, Loader2, ChevronDown } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AgentChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hi, I'm Thandi — your teaching companion for neurodivergent learners. Ask me anything: lesson ideas, behaviour strategies, visual supports, IEP wording, and more.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const threadId = (() => {
        if (typeof window === 'undefined') return 'default_user';
        try {
          const raw = localStorage.getItem('allminds_user');
          if (!raw) return 'default_user';
          const parsed = JSON.parse(raw) as { id?: unknown };
          return parsed?.id ? String(parsed.id) : 'default_user';
        } catch {
          return 'default_user';
        }
      })();
      const languagePref =
        (typeof window !== 'undefined' && localStorage.getItem('allminds_language')) ||
        'en';

      const result = await api.chatWithAgent(text, { thread_id: threadId, language_pref: languagePref });
      const reply: string = result?.response ?? result?.output ?? 'No response received.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open AI assistant"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {open ? <ChevronDown className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-blue-600 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Thandi</p>
                <p className="text-xs text-blue-100">AI Teaching Companion</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-blue-100 transition hover:bg-white/20"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex h-80 flex-col gap-3 overflow-y-auto p-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'rounded-br-sm bg-blue-600 text-white'
                      : 'rounded-bl-sm bg-slate-100 text-slate-800'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                  <span className="text-sm text-slate-500">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-end gap-2 border-t border-slate-200 p-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Thandi anything..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim() || loading}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
