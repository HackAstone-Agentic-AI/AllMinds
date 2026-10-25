'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { getLearnerDisplayName } from '@/lib/learners';
import {
  Bot,
  CalendarPlus,
  ChevronDown,
  Loader2,
  Mic,
  MicOff,
  Send,
  Square,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';

interface Source {
  document: string;
  page: number | null;
  excerpt: string;
}

interface PendingEvent {
  type: 'calendar_event';
  title: string;
  date: string;
  start_time: string;
  duration_minutes: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  pendingEvent?: PendingEvent | null;
  eventStatus?: 'added' | 'cancelled' | 'error';
  eventNote?: string;
}

interface LearnerOption {
  id: number;
  label: string;
  profile: Record<string, any>;
}

const GREETING: Message = {
  role: 'assistant',
  content:
    "Hi, I'm Thandi, your teaching companion for neurodivergent learners. Ask me anything: lesson ideas, behaviour strategies, visual supports, IEP wording and more. Say 'remember that ...' and I'll keep it in mind.",
};

// Speech recognition / synthesis locales for the app's language codes.
const SPEECH_LOCALES: Record<string, string> = {
  en: 'en-ZA', af: 'af-ZA', zu: 'zu-ZA', xh: 'xh-ZA', nso: 'nso-ZA', st: 'st-ZA',
  tn: 'tn-ZA', ss: 'ss-ZA', ve: 've-ZA', ts: 'ts-ZA', nr: 'nr-ZA',
};

const languagePref = () =>
  (typeof window !== 'undefined' && localStorage.getItem('allminds_language')) || 'en';

export default function AgentChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [learners, setLearners] = useState<LearnerOption[]>([]);
  const [learnerId, setLearnerId] = useState('');
  const [listening, setListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);

  const speechSupported =
    typeof window !== 'undefined' &&
    Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  // Restore the conversation and learner list the first time the chat opens.
  const loadContext = useCallback(async () => {
    try {
      const memory = await api.getAgentMemory();
      if (memory.turns.length > 0) {
        setMessages([GREETING, ...memory.turns.map((t) => ({ role: t.role, content: t.content }))]);
      }
    } catch {
      // History is a convenience; the chat still works without it.
    }
    try {
      const rows = await api.getLearners();
      setLearners(
        (rows as any[]).map((row) => ({
          id: row.id,
          label: getLearnerDisplayName(row),
          profile: row.profile_data || {},
        })),
      );
    } catch {
      setLearners([]);
    }
    setHistoryLoaded(true);
  }, []);

  useEffect(() => {
    if (open && !historyLoaded) void loadContext();
  }, [open, historyLoaded, loadContext]);

  const updateLast = (patch: Partial<Message>) =>
    setMessages((prev) => {
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], ...patch };
      return next;
    });

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setLoading(true);

    const learner = learners.find((l) => String(l.id) === learnerId);
    const context = learner
      ? {
          learner_name: learner.label,
          request_context: {
            learner: {
              grade: learner.profile.grade,
              supportNeeds: learner.profile.supportNeeds || learner.profile.support_needs,
              strengths: learner.profile.strengths,
              neurotypeTags: learner.profile.neurotypeTags,
            },
          },
        }
      : {};

    const controller = new AbortController();
    abortRef.current = controller;
    let streamed = '';
    try {
      const result = await api.streamChatWithAgent(
        text,
        { language_pref: languagePref(), ...context },
        (token) => {
          streamed += token;
          updateLast({ content: streamed });
        },
        controller.signal,
      );
      updateLast({
        content: result.response || streamed || 'No response received.',
        sources: Array.isArray(result.sources) ? result.sources : [],
        pendingEvent: result.pending_action?.type === 'calendar_event' ? result.pending_action : null,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        updateLast({ content: streamed ? `${streamed}\n\n(stopped)` : 'Stopped.' });
      } else {
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        updateLast({ content: `Error: ${msg}` });
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  const confirmEvent = async (index: number, event: PendingEvent) => {
    try {
      await api.createCalendarEvent({
        title: event.title,
        start_time: event.start_time,
        date: event.date,
        duration_minutes: event.duration_minutes,
      });
      setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, eventStatus: 'added', eventNote: 'Added to your Google Calendar.' } : m)));
    } catch (err: any) {
      const note =
        err?.code === 'not_connected' || err?.code === 'reconnect_required'
          ? 'Connect Google Calendar in Settings first, then confirm again.'
          : err?.message || 'Could not add the event.';
      setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, eventStatus: 'error', eventNote: note } : m)));
    }
  };

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = SPEECH_LOCALES[languagePref()] || 'en-ZA';
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      setInput(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const readAloud = (index: number, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LOCALES[languagePref()] || 'en-ZA';
    utterance.onend = () => setSpeakingIndex(null);
    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  const clearMemory = async () => {
    if (!window.confirm('Delete your chat history and everything Thandi remembers about you?')) return;
    try {
      await api.clearAgentMemory();
      setMessages([GREETING]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: err instanceof Error ? err.message : 'Could not clear memory.' }]);
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
            <div className="flex items-center gap-1">
              <button
                onClick={() => void clearMemory()}
                className="rounded-lg p-1 text-blue-100 transition hover:bg-white/20"
                aria-label="Delete chat history and memory"
                title="Delete chat history and memory"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-blue-100 transition hover:bg-white/20"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {learners.length > 0 && (
            <div className="border-b border-slate-200 px-3 py-2">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                About learner:
                <select
                  value={learnerId}
                  onChange={(e) => setLearnerId(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                >
                  <option value="">No specific learner</option>
                  {learners.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* Messages */}
          <div className="flex h-80 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] space-y-2">
                  <div
                    className={`rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'rounded-br-sm bg-blue-600 text-white'
                        : 'rounded-bl-sm bg-slate-100 text-slate-800'
                    }`}
                  >
                    {msg.content || (loading && i === messages.length - 1 ? (
                      <span className="flex items-center gap-2 text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
                      </span>
                    ) : null)}
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {msg.sources.map((src) => (
                        <span
                          key={`${src.document}-${src.page}`}
                          title={src.excerpt}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800"
                        >
                          {src.document}
                          {src.page ? ` p. ${src.page}` : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  {msg.pendingEvent && !msg.eventStatus && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => void confirmEvent(i, msg.pendingEvent as PendingEvent)}
                        className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1 text-xs font-medium text-white hover:bg-teal-700"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" /> Confirm
                      </button>
                      <button
                        onClick={() =>
                          setMessages((prev) => prev.map((m, idx) => (idx === i ? { ...m, eventStatus: 'cancelled', eventNote: 'Not added.' } : m)))
                        }
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {msg.eventNote && <p className="text-xs text-slate-500">{msg.eventNote}</p>}

                  {msg.role === 'assistant' && msg.content && i > 0 && (
                    <button
                      onClick={() => readAloud(i, msg.content)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700"
                      aria-label={speakingIndex === i ? 'Stop reading' : 'Read aloud'}
                    >
                      <Volume2 className="h-3.5 w-3.5" /> {speakingIndex === i ? 'Stop' : 'Read aloud'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-end gap-2 border-t border-slate-200 p-3">
            {speechSupported && (
              <button
                onClick={toggleListening}
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border transition ${
                  listening ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
                aria-label={listening ? 'Stop voice input' : 'Speak your question'}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
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
            {loading ? (
              <button
                onClick={() => abortRef.current?.abort()}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-700 text-white transition hover:bg-slate-800"
                aria-label="Stop generating"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => void sendMessage()}
                disabled={!input.trim()}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
