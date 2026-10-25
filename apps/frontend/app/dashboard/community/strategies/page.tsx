'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import LoadError from '@/components/LoadError';
import { ArrowLeft, Lightbulb, Plus, ThumbsUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { findPii, piiMessage } from '@/lib/pii';

interface Strategy {
  id: number;
  title: string;
  challenge_type: string | null;
  description: string;
  grade_level: string | null;
  materials_needed: string | null;
  helpful_count: number;
  author_name: string;
  is_approved: boolean;
  is_mine: boolean | null;
  user_voted: boolean;
}

const CHALLENGES = [
  ['all', 'All challenges'],
  ['transitions', 'Transitions'],
  ['sensory', 'Sensory'],
  ['attention', 'Attention'],
  ['communication', 'Communication'],
  ['literacy', 'Literacy'],
  ['numeracy', 'Numeracy'],
  ['behaviour', 'Behaviour'],
  ['social', 'Social'],
  ['other', 'Other'],
] as const;

export default function StrategyLibraryPage() {
  const router = useRouter();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [challenge, setChallenge] = useState('all');
  const [sort, setSort] = useState<'popular' | 'recent'>('popular');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', challenge_type: 'transitions', grade_level: '', materials_needed: '', description: '' });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.getStrategies({ challenge_type: challenge, sort });
      setStrategies(data.strategies || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [challenge, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const vote = async (strategy: Strategy) => {
    try {
      const res = await api.voteStrategy(strategy.id);
      setStrategies((prev) =>
        prev.map((s) => (s.id === strategy.id ? { ...s, user_voted: true, helpful_count: res.helpful_count } : s)),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not record your vote.');
    }
  };

  const submit = async () => {
    const pii = findPii(`${form.title}\n${form.description}\n${form.materials_needed}`);
    if (pii.length) {
      setMessage(piiMessage(pii));
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const res = await api.createStrategy(form);
      setMessage(res.message || 'Strategy submitted.');
      setForm({ title: '', challenge_type: 'transitions', grade_level: '', materials_needed: '', description: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not submit the strategy.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout activeTab="community">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/community')} className="rounded-lg p-2 transition hover:bg-slate-100" aria-label="Back to community">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-slate-800">Strategy Library</h2>
            <p className="mt-1 text-slate-600">Practical strategies shared by teachers. Vote for the ones that helped you.</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-600"
          >
            <Plus className="h-4 w-4" /> Share a strategy
          </button>
        </div>

        {showForm && (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-white p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={150}
                placeholder="Strategy title"
                className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
              />
              <select
                value={form.challenge_type}
                onChange={(e) => setForm({ ...form, challenge_type: e.target.value })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                {CHALLENGES.filter(([v]) => v !== 'all').map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                value={form.grade_level}
                onChange={(e) => setForm({ ...form, grade_level: e.target.value })}
                maxLength={50}
                placeholder="Grades (e.g. Grade R-3)"
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                value={form.materials_needed}
                onChange={(e) => setForm({ ...form, materials_needed: e.target.value })}
                maxLength={500}
                placeholder="Materials needed"
                className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
              />
            </div>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={3000}
              rows={4}
              placeholder="What do you do, and why does it help? (no learner names)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <button
              onClick={() => void submit()}
              disabled={saving || !form.title.trim() || !form.description.trim()}
              className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {saving ? 'Submitting…' : 'Submit for review'}
            </button>
          </div>
        )}

        {message && <p role="status" className="rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-700">{message}</p>}

        <div className="flex flex-wrap gap-3">
          <select value={challenge} onChange={(e) => setChallenge(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" aria-label="Filter by challenge">
            {CHALLENGES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as 'popular' | 'recent')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" aria-label="Sort">
            <option value="popular">Most helpful</option>
            <option value="recent">Newest</option>
          </select>
        </div>

        <LoadError message={loadError} onRetry={() => void load()} />

        {loading ? (
          <p className="text-sm text-slate-500">Loading strategies…</p>
        ) : strategies.length === 0 && !loadError ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No strategies for this challenge yet. Be the first to share one.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {strategies.map((strategy) => (
              <article key={strategy.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-600">
                      {strategy.challenge_type || 'other'}
                      {strategy.grade_level ? ` · ${strategy.grade_level}` : ''}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-800">{strategy.title}</h3>
                  </div>
                  <Lightbulb className="h-5 w-5 flex-none text-amber-400" />
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{strategy.description}</p>
                {strategy.materials_needed && (
                  <p className="mt-2 text-xs text-slate-500">Materials: {strategy.materials_needed}</p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {strategy.author_name}
                    {!strategy.is_approved && strategy.is_mine && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Waiting for review</span>
                    )}
                  </p>
                  <button
                    onClick={() => void vote(strategy)}
                    disabled={strategy.user_voted || !strategy.is_approved}
                    className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-sm ${
                      strategy.user_voted ? 'border-green-300 bg-green-50 text-green-700' : 'border-slate-300 hover:bg-slate-50'
                    } disabled:cursor-default`}
                    aria-label={strategy.user_voted ? 'You found this helpful' : 'Mark as helpful'}
                  >
                    <ThumbsUp className="h-4 w-4" /> {strategy.helpful_count}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
