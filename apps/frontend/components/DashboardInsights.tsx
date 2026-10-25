'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, Globe2, Loader2, Sparkles, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { getLearnerDisplayName } from '@/lib/learners';
import { LANGUAGES } from '@/lib/i18n/translations';

interface Impact {
  learnersSupported: number;
  progressRecords: number;
  lessonPlans: number;
  supportPlans: number;
  parentLetters: number;
  visualSupports: number;
  aiRequests: number;
  languagesUsed: string[];
  hoursSaved: number;
  assumptions: Record<string, number>;
}

interface AttentionLearner {
  id: number;
  anonymous_id: string;
  profile_data: Record<string, unknown>;
  score: number;
  band: 'High' | 'Moderate' | 'Low';
  reasons: string[];
}

const languageName = (code: string) => LANGUAGES.find((l) => l.code === code)?.label ?? code;

export default function DashboardInsights({
  hasLearners,
  hasDemo,
  onChanged,
}: {
  hasLearners: boolean;
  hasDemo: boolean;
  onChanged: () => void;
}) {
  const [impact, setImpact] = useState<Impact | null>(null);
  const [attention, setAttention] = useState<AttentionLearner[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [impactData, attentionData] = await Promise.all([api.getImpactStats(), api.getAttentionList()]);
      setImpact(impactData);
      setAttention(attentionData.learners || []);
    } catch {
      // Insights are supplementary; the main dashboard shows its own load errors.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, hasLearners, hasDemo]);

  const toggleDemo = async () => {
    setBusy(true);
    setNotice('');
    try {
      const res = hasDemo ? await api.removeDemoClassroom() : await api.loadDemoClassroom();
      setNotice(res.message || 'Done.');
      onChanged();
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {(!hasLearners || hasDemo) && (
        <div className="flex flex-col gap-3 rounded-lg border border-violet-200 bg-violet-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-violet-900">
              {hasDemo ? 'Demo classroom loaded' : 'Try AllMinds with a demo classroom'}
            </p>
            <p className="text-sm text-violet-800">
              {hasDemo
                ? '10 synthetic learners with 8 weeks of progress. Remove them when you add your own class.'
                : 'Adds 10 clearly labelled synthetic learners with 8 weeks of progress, a schedule, a plan and a letter.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void toggleDemo()}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {hasDemo ? 'Remove demo data' : 'Load demo classroom'}
          </button>
        </div>
      )}
      {notice && <p role="status" className="text-sm text-slate-600">{notice}</p>}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Impact and attention">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-semibold text-slate-900">Your impact</h3>
          {impact ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" /> Hours saved</p>
                  <p className="text-2xl font-bold text-slate-900">{impact.hoursSaved}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-xs text-slate-500"><Users className="h-3.5 w-3.5" /> Learners</p>
                  <p className="text-2xl font-bold text-slate-900">{impact.learnersSupported}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">AI resources</p>
                  <p className="text-2xl font-bold text-slate-900">{impact.aiRequests}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-xs text-slate-500"><Globe2 className="h-3.5 w-3.5" /> Languages</p>
                  <p className="text-2xl font-bold text-slate-900">{impact.languagesUsed.length}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {impact.lessonPlans} lesson plans · {impact.supportPlans} support plans · {impact.parentLetters} parent letters ·{' '}
                {impact.visualSupports} visual supports
                {impact.languagesUsed.length > 0 && <> · in {impact.languagesUsed.map(languageName).join(', ')}</>}
              </p>
              <p className="mt-1 text-xs text-slate-400" title={Object.entries(impact.assumptions).map(([k, v]) => `${k}: ${v} min`).join(', ')}>
                Hours saved is an estimate (e.g. a lesson plan = {impact.assumptions.lesson} min, a parent letter = {impact.assumptions.parent} min).
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Loading…</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Who needs attention
          </h3>
          {attention.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Learners appear here once they have at least 3 progress records with engagement, completion or attendance.
            </p>
          ) : (
            <ol className="mt-3 space-y-2">
              {attention.map((learner) => (
                <li key={learner.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/dashboard/learnerAnalytics?learnerId=${learner.id}`}
                      className="font-medium text-slate-800 hover:text-[#087d8c]"
                    >
                      {getLearnerDisplayName(learner)}
                    </Link>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        learner.band === 'High'
                          ? 'bg-red-100 text-red-700'
                          : learner.band === 'Moderate'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {learner.band}
                    </span>
                  </div>
                  {learner.reasons.length > 0 && (
                    <p className="mt-1 text-xs text-slate-500">{learner.reasons.join(' · ')}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
