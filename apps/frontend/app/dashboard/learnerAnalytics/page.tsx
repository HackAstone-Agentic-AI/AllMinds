'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import LoadError from '@/components/LoadError';
import { api } from '@/lib/api';
import { getLearnerDisplayName } from '@/lib/learners';
import {
  BarChart3,
  Brain,
  Users,
  AlertTriangle,
  Network,
  RefreshCw,
  UserRound,
  TrendingUp,
  ClipboardList,
} from 'lucide-react';

type LearnerProfileRow = {
  id: number;
  anonymous_id: string;
  profile_data: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

type LearnerProgressRow = {
  id: number;
  progress_data: Record<string, any> | null;
  recorded_at: string;
};

type LearnerProfile = {
  id: string;
  anonymousId: string;
  pseudonym?: string;
  fullName?: string;
  grade?: string;
  neurotypeTags?: string[];
  supportNeeds?: string[];
  strengths?: string[];
  recentNotes?: string;
  updatedAt?: string;
};

type SupportRequestType =
  | 'multi-agent-coordination'
  | 'support-planning'
  | 'assessment-adjustment'
  | 'progress-review'
  | 'attendance-support';

type ProgressAnalytics = {
  engagementAverage: number;
  taskCompletionAverage: number;
  attendanceRate: number;
  progressEntries: number;
  latestLearningArea: string;
  latestProgressLevel: string;
  latestAchievements: string;
  supportPriorityScore: number;
  supportPriorityBand: 'Low' | 'Moderate' | 'High' | 'Not enough data';
};

type AgentAnalytics = {
  summary?: {
    records?: number;
    average_mark?: number | null;
    average_behavior?: number;
    average_progress?: number;
    overall_trend?: string;
    behavior_trend?: string;
  };
  risk_flags?: string[];
  narrative?: string;
};

// Trends and bands from fewer records than this are shown as provisional.
const MIN_RECORDS_FOR_TREND = 3;

// Teacher-chosen progress level used as the academic signal for the agent (0-100).
const LEVEL_TO_MARK: Record<string, number> = {
  Excellent: 90,
  Good: 75,
  Moderate: 55,
  'Needs Support': 35,
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)
  );
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function likertToPercent(value: number) {
  return clampPercent((value / 5) * 100);
}

// Older imports stored list fields as "a; b" strings; the page needs arrays.
function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function mapLearnerRow(row: LearnerProfileRow): LearnerProfile {
  const profile = row.profile_data ?? {};
  const displayName = getLearnerDisplayName({
    anonymous_id: row.anonymous_id,
    profile_data: profile,
  });

  return {
    id: String(row.id),
    anonymousId: row.anonymous_id,
    pseudonym: displayName,
    fullName: displayName,
    grade:
      profile.grade ||
      profile.gradeLevel ||
      profile.grade_level ||
      profile.classGrade ||
      '',
    neurotypeTags: toList(
      profile.neurotypeTags || profile.neurotype_tags || profile.neurodivergent_conditions
    ),
    supportNeeds: toList(
      profile.supportNeeds || profile.support_needs || profile.learning_support_needs
    ),
    strengths: toList(profile.strengths || profile.learner_strengths),
    recentNotes:
      profile.recentNotes || profile.recent_notes || profile.notes || '',
    updatedAt: row.updated_at,
  };
}

function getLearnerLabel(learner: LearnerProfile) {
  return (
    learner.pseudonym ||
    learner.fullName ||
    learner.anonymousId ||
    `Learner ${learner.id}`
  );
}

function getRequestedCapabilities(requestType: SupportRequestType) {
  switch (requestType) {
    case 'assessment-adjustment':
      return [
        'assessment adaptation',
        'differentiated planning',
        'task redesign',
      ];
    case 'progress-review':
      return [
        'progress interpretation',
        'pattern identification',
        'learner support review',
      ];
    case 'attendance-support':
      return [
        'attendance follow-up',
        'support continuity planning',
        'schedule-sensitive intervention',
      ];
    case 'support-planning':
      return [
        'integrated support planning',
        'targeted learner recommendations',
      ];
    case 'multi-agent-coordination':
    default:
      return [
        'cross-agent orchestration',
        'integrated learner analytics',
        'progress-informed support design',
      ];
  }
}

function getRiskBand(score: number): 'Low' | 'Moderate' | 'High' {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Moderate';
  return 'Low';
}

function mapProgressToAgentRecords(records: LearnerProgressRow[]) {
  return records.map((record) => {
    const data = record.progress_data ?? {};
    const attendance = String(data.attendance || '').toLowerCase();
    return {
      date: record.recorded_at,
      subject: data.area || 'General',
      // Only send a mark when the teacher chose a level; missing is "not assessed".
      ...(LEVEL_TO_MARK[data.level] !== undefined ? { mark: LEVEL_TO_MARK[data.level] } : {}),
      behavior: {
        attention: Number(data.engagementLevel) || 0,
        participation: Number(data.taskCompletionLevel) || 0,
        homework_completion: Number(data.taskCompletionLevel) || 0,
        attendance: attendance === 'present' ? 5 : attendance === 'not present' ? 1 : 0,
      },
    };
  });
}

function getProgressAnalytics(
  records: LearnerProgressRow[]
): ProgressAnalytics {
  if (records.length === 0) {
    return {
      engagementAverage: 0,
      taskCompletionAverage: 0,
      attendanceRate: 0,
      progressEntries: 0,
      latestLearningArea: 'No records yet',
      latestProgressLevel: 'No records yet',
      latestAchievements: 'No achievements logged yet',
      supportPriorityScore: 0,
      supportPriorityBand: 'Not enough data',
    };
  }

  const engagementValues = records
    .map((record) => Number(record.progress_data?.engagementLevel))
    .filter((value) => !Number.isNaN(value) && value > 0);

  const taskCompletionValues = records
    .map((record) => Number(record.progress_data?.taskCompletionLevel))
    .filter((value) => !Number.isNaN(value) && value > 0);

  const attendanceValues = records
    .map((record): number | null => {
      const attendance = String(
        record.progress_data?.attendance || ''
      ).toLowerCase();
      return attendance === 'present'
        ? 1
        : attendance === 'not present'
        ? 0
        : null;
    })
    .filter((value): value is number => value !== null);

  const engagementAverage = average(engagementValues);
  const taskCompletionAverage = average(taskCompletionValues);
  const attendanceRate =
    attendanceValues.length > 0
      ? Number(
          (
            (attendanceValues.reduce((sum, value) => sum + value, 0) /
              attendanceValues.length) *
            100
          ).toFixed(1)
        )
      : 0;

  const latest = records[0];
  const latestLearningArea = latest.progress_data?.area || 'Not recorded';
  const latestProgressLevel = latest.progress_data?.level || 'Not recorded';
  const latestAchievements =
    latest.progress_data?.achievements || 'No achievements logged yet';

  const engagementPercent = likertToPercent(engagementAverage);
  const taskCompletionPercent = likertToPercent(taskCompletionAverage);

  // Build support priority calculation only from available dimensions
  const components: number[] = [];
  if (engagementValues.length > 0) components.push(100 - engagementPercent);
  if (taskCompletionValues.length > 0)
    components.push(100 - taskCompletionPercent);
  if (attendanceValues.length > 0) components.push(100 - attendanceRate);

  const supportPriorityScore = components.length
    ? Number((components.reduce((a, b) => a + b, 0) / components.length).toFixed(1))
    : 0;

  return {
    engagementAverage,
    taskCompletionAverage,
    attendanceRate,
    progressEntries: records.length,
    latestLearningArea,
    latestProgressLevel,
    latestAchievements,
    supportPriorityScore,
    supportPriorityBand: components.length ? getRiskBand(supportPriorityScore) : 'Not enough data',
  };
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{title}</p>
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-800 mt-3">{value}</p>
      <p className="text-xs text-slate-500 mt-2 leading-5">{subtitle}</p>
    </div>
  );
}

function SimpleBarGraph({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number; displayValue: string }[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h4 className="font-semibold text-slate-800 mb-4">{title}</h4>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">{item.label}</p>
              <p className="text-sm font-medium text-slate-800">
                {item.displayValue}
              </p>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all"
                style={{ width: `${clampPercent(item.value)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LearnerAnalyticsPage() {
  type SensoryLogRow = {
    id: number;
    log_data: Record<string, any> | null;
    logged_at: string;
  };

  const [learnerProfiles, setLearnerProfiles] = useState<LearnerProfile[]>([]);
  const [loadError, setLoadError] = useState('');
  const [selectedLearnerProgress, setSelectedLearnerProgress] = useState<LearnerProgressRow[]>([]);
  const [selectedSensoryLogs, setSelectedSensoryLogs] = useState<SensoryLogRow[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>('');
  const [loadingLearners, setLoadingLearners] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [agentAnalysis, setAgentAnalysis] = useState('');
  const [agentAnalytics, setAgentAnalytics] = useState<AgentAnalytics | null>(null);
  const [supportPlan, setSupportPlan] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState('');

  const [requestType, setRequestType] = useState<SupportRequestType>(
    'multi-agent-coordination'
  );
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');
  const [requestGoal, setRequestGoal] = useState('');
  const [requestStatusMessage, setRequestStatusMessage] = useState('');
  const [requestStatusTone, setRequestStatusTone] = useState<'success' | 'error' | 'info'>('info');
  const [includeProfile, setIncludeProfile] = useState(true);
  const [includeSupportNeeds, setIncludeSupportNeeds] = useState(true);
  const [includeStrengths, setIncludeStrengths] = useState(true);
  const [includeAnalytics, setIncludeAnalytics] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);

  useEffect(() => {
    loadLearnerList();
  }, []);

  useEffect(() => {
    if (!selectedLearnerId) {
      setSelectedLearnerProgress([]);
      setSelectedSensoryLogs([]);
      setAgentAnalysis('');
      setAgentError('');
      return;
    }
    loadLearnerProgress(selectedLearnerId);
    loadSensoryLogs(selectedLearnerId);
    setAgentAnalysis('');
    setAgentAnalytics(null);
    setSupportPlan('');
    setAgentError('');
  }, [selectedLearnerId]);

  const loadLearnerList = async () => {
    setLoadError('');
    setLoadingLearners(true);
    try {
      const rows = (await api.getLearners()) as LearnerProfileRow[];
      const learners = rows.map(mapLearnerRow);
      setLearnerProfiles(learners);
      if (learners.length > 0) {
        // Deep links from the dashboard's attention list: ?learnerId=123
        const requested = new URLSearchParams(window.location.search).get('learnerId');
        setSelectedLearnerId((prev) =>
          requested && learners.some((l) => l.id === requested)
            ? requested
            : learners.some((l) => l.id === prev) ? prev : learners[0].id
        );
      } else {
        setSelectedLearnerId('');
      }
    } catch (err) {
      console.error('Failed to load learner profiles:', err);
      setLoadError(err instanceof Error ? err.message : 'Please try again.');
      setLearnerProfiles([]);
      setSelectedLearnerId('');
    } finally {
      setLoadingLearners(false);
    }
  };

  const loadLearnerProgress = async (learnerId: string) => {
    setLoadingProgress(true);
    try {
      const rows = (await api.getProgress(Number(learnerId))) as LearnerProgressRow[];
      setSelectedLearnerProgress(rows ?? []);
    } catch (err) {
      console.error('Failed to load learner progress:', err);
      setSelectedLearnerProgress([]);
    } finally {
      setLoadingProgress(false);
    }
  };

  const loadSensoryLogs = async (learnerId: string) => {
    try {
      const rows = (await api.getSensoryLogs(Number(learnerId))) as SensoryLogRow[];
      setSelectedSensoryLogs(rows ?? []);
    } catch (err) {
      console.error('Failed to load sensory logs:', err);
      setSelectedSensoryLogs([]);
    }
  };

  const selectedLearner =
    learnerProfiles.find((learner) => learner.id === selectedLearnerId) ?? null;

  const progressAnalytics = useMemo(
    () => getProgressAnalytics(selectedLearnerProgress),
    [selectedLearnerProgress]
  );

  const requestedCapabilities = useMemo(
    () => getRequestedCapabilities(requestType),
    [requestType]
  );

  const analyticsNarrative = useMemo(() => {
    if (!selectedLearner || selectedLearnerProgress.length === 0) {
      return [
        'No learner progress records are available yet for this learner.',
        'Once progress entries are logged, engagement, task completion, and attendance trends will appear here as numerical analytics.',
      ];
    }

    const lines: string[] = [];

    if (progressAnalytics.supportPriorityScore >= 70) {
      lines.push(
        'The current progress records suggest a high support priority. Engagement, attendance, and task completion patterns indicate that closer coordination may be needed.'
      );
    } else if (progressAnalytics.supportPriorityScore >= 40) {
      lines.push(
        'The current progress records suggest a moderate support priority. There may be useful opportunities for targeted support and follow-up.'
      );
    } else {
      lines.push(
        'The current progress records suggest a lower support priority at the moment, although ongoing monitoring remains important.'
      );
    }

    if (progressAnalytics.engagementAverage <= 2) {
      lines.push(
        'Engagement is trending low across the logged progress records, which may indicate a need for stronger scaffolding or adjustments to task design.'
      );
    } else if (progressAnalytics.engagementAverage <= 3.5) {
      lines.push(
        'Engagement is moderate, suggesting that participation may improve with clearer supports and sustained monitoring.'
      );
    } else {
      lines.push(
        'Engagement is relatively strong across the logged progress records.'
      );
    }

    if (progressAnalytics.taskCompletionAverage <= 2) {
      lines.push(
        'Task completion is currently low, which may suggest that tasks need more chunking, guidance, or reduction in load.'
      );
    } else if (progressAnalytics.taskCompletionAverage <= 3.5) {
      lines.push(
        'Task completion is moderate and may benefit from more structured checkpoints.'
      );
    } else {
      lines.push(
        'Task completion is relatively strong in the available progress records.'
      );
    }

    if (progressAnalytics.attendanceRate < 60) {
      lines.push(
        'Attendance is inconsistent, which may affect continuity of support and learning progression.'
      );
    } else if (progressAnalytics.attendanceRate < 85) {
      lines.push(
        'Attendance is moderate and should continue to be monitored alongside progress outcomes.'
      );
    } else {
      lines.push('Attendance is relatively strong in the logged records.');
    }

    return lines;
  }, [selectedLearner, selectedLearnerProgress, progressAnalytics]);

  const handleAnalyseWithAgent = async () => {
    if (!selectedLearner || selectedLearnerProgress.length === 0) return;
    setAgentLoading(true);
    setAgentError('');
    try {
      const result = await api.chatWithAgent(
        `Analyse this learner's progress and provide a narrative with risk flags.`,
        {
          tool_hint: 'analytics',
          learner_name: getLearnerLabel(selectedLearner),
          records: mapProgressToAgentRecords(selectedLearnerProgress),
          language_pref: localStorage.getItem('allminds_language') || 'en',
        }
      ) as Record<string, any>;
      setAgentAnalysis(result.response || result.output || '');
      setAgentAnalytics((result.analytics as AgentAnalytics) || null);
    } catch (err: any) {
      setAgentError(err?.message || 'Agent request failed. Please try again.');
    } finally {
      setAgentLoading(false);
    }
  };

  const handleCreateSupportRequest = async () => {
    if (!selectedLearner) return;
    if (!requestGoal.trim()) return;

    const trimmedGoal = requestGoal.trim();
    const contextPayload = {
      learnerProfile: includeProfile
        ? {
            id: selectedLearner.id,
            anonymousId: selectedLearner.anonymousId,
            label: getLearnerLabel(selectedLearner),
            grade: selectedLearner.grade ?? null,
            neurotypeTags: selectedLearner.neurotypeTags ?? [],
          }
        : null,
      supportNeeds: includeSupportNeeds ? selectedLearner.supportNeeds ?? [] : [],
      strengths: includeStrengths ? selectedLearner.strengths ?? [] : [],
      analytics: includeAnalytics
        ? {
            engagementAverage: progressAnalytics.engagementAverage,
            taskCompletionAverage: progressAnalytics.taskCompletionAverage,
            attendanceRate: progressAnalytics.attendanceRate,
            progressEntries: progressAnalytics.progressEntries,
            latestLearningArea: progressAnalytics.latestLearningArea,
            latestProgressLevel: progressAnalytics.latestProgressLevel,
            latestAchievements: progressAnalytics.latestAchievements,
            supportPriorityScore: progressAnalytics.supportPriorityScore,
            supportPriorityBand: progressAnalytics.supportPriorityBand,
          }
        : null,
      recentNotes: includeNotes ? selectedLearner.recentNotes ?? '' : '',
    };

    setRequestStatusTone('info');
    setRequestStatusMessage('Building a support plan. This usually takes 10-20 seconds...');
    setSupportSending(true);
    setSupportPlan('');

    try {
      const result = (await api.chatWithAgent(trimmedGoal, {
        tool_hint: 'support',
        learner_name: getLearnerLabel(selectedLearner),
        records: includeAnalytics ? mapProgressToAgentRecords(selectedLearnerProgress) : [],
        request_type: requestType,
        urgency,
        request_context: { ...contextPayload, requestedCapabilities },
        language_pref: localStorage.getItem('allminds_language') || 'en',
      })) as Record<string, any>;
      const plan: string = result.response || '';
      if (!plan) throw new Error('No support plan was returned. Please try again.');
      setSupportPlan(plan);
      setRequestGoal('');
      setRequestStatusTone('success');
      setRequestStatusMessage('Support plan ready - see below.');
    } catch (err: any) {
      setRequestStatusTone('error');
      setRequestStatusMessage(err?.message || 'Support request failed. Please try again.');
    } finally {
      setSupportSending(false);
    }
  };

  return (
    <DashboardLayout activeTab="learner-analytics">
      <div className="space-y-6">
        <LoadError message={loadError} onRetry={() => void loadLearnerList()} />
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-medium text-blue-600">
            <Brain className="w-4 h-4" />
            AI-assisted learning analytics
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mt-2">
            Learner Analytics
          </h2>
          <p className="text-slate-600 mt-1 max-w-4xl">
            Track engagement, task completion, attendance, and support needs from
            the learner progress records already in your workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-slate-500" />
              <h3 className="text-lg font-semibold text-slate-800">
                Uploaded Learners
              </h3>
            </div>

            {loadingLearners ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 leading-6">
                Loading learner profiles...
              </div>
            ) : learnerProfiles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 leading-6">
                No uploaded learner profiles were found yet.
              </div>
            ) : (
              <div className="space-y-3">
                {learnerProfiles.map((learner) => {
                  const isSelected = selectedLearnerId === learner.id;

                  return (
                    <button
                      key={learner.id}
                      onClick={() => setSelectedLearnerId(learner.id)}
                      className={`w-full text-left rounded-xl border p-4 transition ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-800">
                            {getLearnerLabel(learner)}
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            {learner.grade || 'Grade not available'}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {learner.anonymousId}
                          </p>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                          <UserRound className="w-4 h-4 text-slate-500" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="xl:col-span-3 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <MetricCard
                title="Engagement Average"
                value={`${progressAnalytics.engagementAverage}/5`}
                subtitle="Average from progress logs"
                icon={TrendingUp}
              />
              <MetricCard
                title="Task Completion"
                value={`${progressAnalytics.taskCompletionAverage}/5`}
                subtitle="Average from progress logs"
                icon={ClipboardList}
              />
              <MetricCard
                title="Attendance Rate"
                value={`${progressAnalytics.attendanceRate}%`}
                subtitle="Present vs not present"
                icon={BarChart3}
              />
              <MetricCard
                title="Support Priority"
                value={progressAnalytics.supportPriorityBand}
                subtitle={`${progressAnalytics.supportPriorityScore} score`}
                icon={AlertTriangle}
              />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-slate-500" />
                <h3 className="text-lg font-semibold text-slate-800">
                  Learner Analytics Overview
                </h3>
              </div>

              {!selectedLearner ? (
                <p className="text-sm text-slate-500">
                  Select an uploaded learner profile to view analytics.
                </p>
              ) : loadingProgress ? (
                <p className="text-sm text-slate-500">Loading progress records…</p>
              ) : (
                <div className="space-y-5">
                  {progressAnalytics.progressEntries < MIN_RECORDS_FOR_TREND && (
                    <p role="status" className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                      {progressAnalytics.progressEntries === 0
                        ? 'No progress records yet. Add records with engagement, task completion and attendance to see analytics.'
                        : `Only ${progressAnalytics.progressEntries} record(s) so far. Scores are provisional until there are at least ${MIN_RECORDS_FOR_TREND}.`}
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-sm text-slate-500">Learner</p>
                      <p className="font-semibold text-slate-800 mt-1">
                        {getLearnerLabel(selectedLearner)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-sm text-slate-500">Progress Entries</p>
                      <p className="font-semibold text-slate-800 mt-1">
                        {progressAnalytics.progressEntries}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-sm text-slate-500">
                        Latest Learning Area
                      </p>
                      <p className="font-semibold text-slate-800 mt-1">
                        {progressAnalytics.latestLearningArea}
                      </p>
                    </div>
                  </div>

                  <SimpleBarGraph
                    title="Progress Dimensions"
                    items={[
                      {
                        label: 'Engagement',
                        value: likertToPercent(
                          progressAnalytics.engagementAverage
                        ),
                        displayValue: `${progressAnalytics.engagementAverage}/5`,
                      },
                      {
                        label: 'Task Completion',
                        value: likertToPercent(
                          progressAnalytics.taskCompletionAverage
                        ),
                        displayValue: `${progressAnalytics.taskCompletionAverage}/5`,
                      },
                      {
                        label: 'Attendance',
                        value: progressAnalytics.attendanceRate,
                        displayValue: `${progressAnalytics.attendanceRate}%`,
                      },
                    ]}
                  />

                  <div className="rounded-xl border border-slate-200 p-4">
                    <h4 className="font-semibold text-slate-800 mb-3">
                      Progress Interpretation
                    </h4>
                    <div className="space-y-3 text-sm text-slate-700 leading-6">
                      {analyticsNarrative.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h4 className="font-semibold text-slate-800">AI Analytics Insight</h4>
                      <button
                        onClick={handleAnalyseWithAgent}
                        disabled={selectedLearnerProgress.length === 0 || agentLoading}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        <RefreshCw className={`w-4 h-4 ${agentLoading ? 'animate-spin' : ''}`} />
                        {agentLoading ? 'Analysing…' : 'Analyse with AI'}
                      </button>
                    </div>
                    {agentError && (
                      <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{agentError}</p>
                    )}
                    {agentAnalysis ? (
                      <div className="space-y-3">
                        <p className="text-sm text-slate-700 leading-6 whitespace-pre-wrap">{agentAnalysis}</p>
                        {agentAnalytics?.narrative && (
                          <p className="text-sm text-slate-700 leading-6 bg-slate-50 rounded-lg p-3">{agentAnalytics.narrative}</p>
                        )}
                        {agentAnalytics?.summary?.overall_trend && (
                          <p className="text-xs text-slate-500">
                            Overall trend: <span className="font-medium text-slate-700">{agentAnalytics.summary.overall_trend}</span>
                            {agentAnalytics.summary.behavior_trend && <> · Behaviour trend: <span className="font-medium text-slate-700">{agentAnalytics.summary.behavior_trend}</span></>}
                          </p>
                        )}
                        {(agentAnalytics?.risk_flags ?? []).length > 0 && (
                          <ul className="space-y-1">
                            {agentAnalytics?.risk_flags?.map((flag) => (
                              <li key={flag} className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                {flag}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : !agentLoading && !agentError ? (
                      <p className="text-sm text-slate-400">Click &quot;Analyse with AI&quot; to get a detailed AI-generated narrative and risk flags for this learner.</p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-sm text-slate-500 mb-2">Strengths</p>
                      <div className="flex flex-wrap gap-2">
                        {(selectedLearner.strengths ?? []).length > 0 ? (
                          selectedLearner.strengths?.map((item) => (
                            <span
                              key={item}
                              className="text-xs px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200"
                            >
                              {item}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-400">
                            No strengths recorded
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-sm text-slate-500 mb-2">
                        Support Needs
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(selectedLearner.supportNeeds ?? []).length > 0 ? (
                          selectedLearner.supportNeeds?.map((item) => (
                            <span
                              key={item}
                              className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                            >
                              {item}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-400">
                            No support needs recorded
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">
                      Latest Achievement Snapshot
                    </p>
                    <p className="text-slate-700 mt-2 leading-6">
                      {progressAnalytics.latestAchievements}
                    </p>
                  </div>

                  {/* TC-BEH-005: Behaviour & Sensory Observations */}
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h4 className="font-semibold text-slate-800 mb-3">
                      Behaviour &amp; Sensory Observations
                    </h4>
                    {selectedSensoryLogs.length === 0 ? (
                      <p className="text-sm text-slate-400">No behaviour or sensory observations logged yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedSensoryLogs.slice(0, 5).map((log) => (
                          <div key={log.id} className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                              {log.log_data?.behavior && (
                                <div><span className="font-medium text-amber-800">Behaviour:</span> <span className="text-slate-700">{log.log_data.behavior}</span></div>
                              )}
                              {log.log_data?.trigger && (
                                <div><span className="font-medium text-amber-800">Trigger:</span> <span className="text-slate-700">{log.log_data.trigger}</span></div>
                              )}
                              {log.log_data?.response && (
                                <div><span className="font-medium text-amber-800">Response:</span> <span className="text-slate-700">{log.log_data.response}</span></div>
                              )}
                              {log.log_data?.notes && (
                                <div className="md:col-span-2"><span className="font-medium text-amber-800">Notes:</span> <span className="text-slate-700">{log.log_data.notes}</span></div>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                              {new Date(log.logged_at).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                        {selectedSensoryLogs.length > 5 && (
                          <p className="text-xs text-slate-400">
                            Showing 5 most recent of {selectedSensoryLogs.length} observations.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Recent Notes</p>
                    <p className="text-slate-700 mt-2 leading-6">
                      {selectedLearner.recentNotes ||
                        'No recent notes available.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Network className="w-5 h-5 text-slate-500" />
                <h3 className="text-lg font-semibold text-slate-800">
                  Learner Support Request
                </h3>
              </div>

              <p className="text-sm text-slate-600 mb-5 leading-6">
                Send a structured support request using this learner&apos;s progress,
                attendance, strengths, and support context.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Request Category
                  </label>
                  <select
                    value={requestType}
                    onChange={(e) =>
                      setRequestType(e.target.value as SupportRequestType)
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  >
                    <option value="multi-agent-coordination">
                      Coordinated Support Plan
                    </option>
                    <option value="support-planning">Support Planning</option>
                    <option value="assessment-adjustment">
                      Assessment Adjustment
                    </option>
                    <option value="progress-review">Progress Review</option>
                    <option value="attendance-support">
                      Attendance Support
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Urgency
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) =>
                      setUrgency(e.target.value as 'low' | 'medium' | 'high')
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Request Goal
                </label>
                <textarea
                  value={requestGoal}
                  onChange={(e) => setRequestGoal(e.target.value)}
                  rows={4}
                  placeholder="Describe the progress-related support need for this learner."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none"
                />
              </div>

              <div className="mt-5">
                <p className="text-sm font-medium text-slate-700 mb-3">
                  Include Context
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <label className="flex items-center gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeProfile}
                      onChange={() => setIncludeProfile(!includeProfile)}
                    />
                    Learner profile data
                  </label>
                  <label className="flex items-center gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeSupportNeeds}
                      onChange={() =>
                        setIncludeSupportNeeds(!includeSupportNeeds)
                      }
                    />
                    Support needs
                  </label>
                  <label className="flex items-center gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeStrengths}
                      onChange={() => setIncludeStrengths(!includeStrengths)}
                    />
                    Strengths
                  </label>
                  <label className="flex items-center gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeAnalytics}
                      onChange={() => setIncludeAnalytics(!includeAnalytics)}
                    />
                    Progress analytics
                  </label>
                  <label className="flex items-center gap-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeNotes}
                      onChange={() => setIncludeNotes(!includeNotes)}
                    />
                    Recent notes
                  </label>
                </div>
              </div>

              <div className="mt-5">
                <button
                  onClick={handleCreateSupportRequest}
                  disabled={!selectedLearner || !requestGoal.trim() || supportSending}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <RefreshCw className={`w-4 h-4 ${supportSending ? 'animate-spin' : ''}`} />
                  {supportSending ? 'Building plan…' : 'Get support plan'}
                </button>
                {requestStatusMessage && (
                  <p
                    className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                      requestStatusTone === 'success'
                        ? 'bg-green-50 text-green-700'
                        : requestStatusTone === 'error'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {requestStatusMessage}
                  </p>
                )}
                {supportPlan && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                    <h4 className="font-semibold text-slate-800 mb-2">Support plan</h4>
                    <p className="text-sm text-slate-700 leading-6 whitespace-pre-wrap">{supportPlan}</p>
                    <p className="text-xs text-slate-500 mt-3">AI-generated suggestions to discuss with your school-based support team. Not a diagnosis.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
