'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BookOpen,
  Bus,
  Calculator,
  Clock3,
  Home,
  Loader2,
  Music,
  Palette,
  Printer,
  Sparkles,
  Sun,
  Users,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { LearnerScheduleItem } from '@/types/database';

// Picks a picture for each activity so the learner can read the schedule without text.
const ICON_RULES: { match: RegExp; icon: LucideIcon; color: string }[] = [
  { match: /arriv|greet|morning|welcome/i, icon: Sun, color: 'bg-amber-100 text-amber-700' },
  { match: /read|story|book|phonic|literacy/i, icon: BookOpen, color: 'bg-blue-100 text-blue-700' },
  { match: /math|number|count|fraction/i, icon: Calculator, color: 'bg-emerald-100 text-emerald-700' },
  { match: /break|movement|play|sport|outside|pe\b/i, icon: Activity, color: 'bg-orange-100 text-orange-700' },
  { match: /lunch|snack|eat|meal/i, icon: Utensils, color: 'bg-rose-100 text-rose-700' },
  { match: /circle|group|together|assembly/i, icon: Users, color: 'bg-violet-100 text-violet-700' },
  { match: /music|song|sing/i, icon: Music, color: 'bg-pink-100 text-pink-700' },
  { match: /art|draw|paint|craft/i, icon: Palette, color: 'bg-fuchsia-100 text-fuchsia-700' },
  { match: /home|pack|dismiss|end of day/i, icon: Home, color: 'bg-teal-100 text-teal-700' },
  { match: /bus|transport|pickup/i, icon: Bus, color: 'bg-yellow-100 text-yellow-700' },
];

const iconFor = (title: string) =>
  ICON_RULES.find((rule) => rule.match.test(title)) ?? { icon: Clock3, color: 'bg-slate-100 text-slate-700' };

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
};

const nowMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

export default function VisualSchedule({
  items,
  learnerName,
}: {
  items: LearnerScheduleItem[];
  learnerName: string;
}) {
  const [minutes, setMinutes] = useState(nowMinutes);
  const [ideas, setIdeas] = useState('');
  const [ideaImages, setIdeaImages] = useState<{ label: string; url: string }[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [ideasError, setIdeasError] = useState('');

  // Keep now/next current while the page is open.
  useEffect(() => {
    const timer = window.setInterval(() => setMinutes(nowMinutes()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const sorted = useMemo(
    () => [...items].sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time)),
    [items],
  );
  const currentIndex = sorted.reduce((found, item, index) => (toMinutes(item.start_time) <= minutes ? index : found), -1);
  const current = currentIndex >= 0 ? sorted[currentIndex] : null;
  const next = sorted[currentIndex + 1] ?? null;

  const getIdeas = async () => {
    setLoadingIdeas(true);
    setIdeasError('');
    try {
      const routine = sorted.map((item) => `${item.start_time} ${item.title}`).join('; ');
      const res = await api.chatWithAgent(
        `Visual supports for this daily routine (now/next board, transition cues, picture cards): ${routine}`,
        { tool_hint: 'visual', language_pref: localStorage.getItem('allminds_language') || 'en' },
      );
      setIdeas(res.response || '');
      setIdeaImages(Array.isArray(res.image_aids) ? res.image_aids : []);
    } catch (err) {
      setIdeasError(err instanceof Error ? err.message : 'Could not get visual support ideas.');
    } finally {
      setLoadingIdeas(false);
    }
  };

  if (sorted.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="print-area space-y-4">
        <h3 className="text-xl font-bold text-slate-800">{learnerName}&apos;s day</h3>
        <div className="grid grid-cols-2 gap-3" aria-live="polite">
          <div className="rounded-xl border-2 border-green-400 bg-green-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Now</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{current ? current.title : 'Not started yet'}</p>
          </div>
          <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Next</p>
            <p className="mt-1 text-lg font-bold text-slate-800">
              {next ? `${next.title} at ${next.start_time}` : 'Home time'}
            </p>
          </div>
        </div>
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sorted.map((item, index) => {
            const { icon: Icon, color } = iconFor(item.title);
            const state = index < currentIndex ? 'done' : index === currentIndex ? 'now' : 'later';
            return (
              <li
                key={item.id}
                className={`flex flex-col items-center rounded-xl border p-4 text-center ${
                  state === 'now' ? 'border-green-500 ring-2 ring-green-300' : 'border-slate-200'
                } ${state === 'done' ? 'opacity-50' : ''}`}
              >
                <span className={`flex h-14 w-14 items-center justify-center rounded-full ${color}`}>
                  <Icon className="h-8 w-8" aria-hidden="true" />
                </span>
                <span className="mt-2 text-sm font-semibold text-slate-500">{item.start_time}</span>
                <span className="text-base font-semibold text-slate-800">{item.title}</span>
                {state === 'done' && <span className="text-xs text-slate-500">Done</span>}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          <Printer className="h-4 w-4" /> Print schedule
        </button>
        <button
          type="button"
          onClick={() => void getIdeas()}
          disabled={loadingIdeas}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {loadingIdeas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loadingIdeas ? 'Creating ideas (about 20 s)…' : 'Get visual support ideas'}
        </button>
      </div>
      {ideasError && <p role="alert" className="no-print text-sm text-red-700">{ideasError}</p>}
      {ideas && (
        <div className="no-print rounded-xl border border-violet-200 bg-violet-50/40 p-4">
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{ideas}</p>
          {ideaImages.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ideaImages.map((image) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={image.label} src={image.url} alt={image.label} className="rounded-lg border border-slate-200" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
