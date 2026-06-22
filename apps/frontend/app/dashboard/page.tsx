'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity as ActivityIcon,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  MessageSquareText,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/api';
import {
  Activity,
  LearnerProfile,
  LessonPlan,
  ParentCommunication,
  TeacherTask,
} from '@/types/database';

type ResourceCategory =
  | 'learner-profiles'
  | 'lesson-plans'
  | 'communications'
  | 'activity'
  | 'open-tasks'
  | 'scheduled-work';

type HistoryItem = {
  id: string;
  title: string;
  subtitle: string;
  createdAt: string;
  href: string;
};

type ResourceCard = {
  id: ResourceCategory;
  title: string;
  count: number;
  description: string;
  emptyMessage: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: {
    icon: string;
    iconBg: string;
    selected: string;
    hover: string;
  };
};

const taskBadgeStyles: Record<TeacherTask['priority'], string> = {
  low: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  high: 'bg-rose-50 text-rose-700',
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const getLearnerName = (learner: LearnerProfile) => {
  const profile = learner.profile_data || {};
  return (
    profile.pseudonym ||
    profile.fullName ||
    profile.full_name ||
    profile.name ||
    learner.anonymous_id
  );
};

const getLessonTitle = (plan: LessonPlan) => plan.title || 'Untitled lesson plan';

export default function DashboardHome() {
  const [learnerProfiles, setLearnerProfiles] = useState<LearnerProfile[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [parentCommunications, setParentCommunications] = useState<ParentCommunication[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<TeacherTask[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<ResourceCategory>('learner-profiles');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<TeacherTask['priority']>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [taskMessage, setTaskMessage] = useState('');
  const router = useRouter();

  const loadDashboardData = useCallback(async () => {
    const token = localStorage.getItem('allminds_token');
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    try {
      const [learners, plans, communications, activityFeed, teacherTasks] =
        await Promise.all([
          api.getLearners(),
          api.getLessonPlans(),
          api.getParentCommunications(),
          api.getActivities(),
          api.getTasks(),
        ]);

      setLearnerProfiles(learners);
      setLessonPlans(plans);
      setParentCommunications(communications);
      setActivities(activityFeed);
      setTasks(teacherTasks);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const historyMap = useMemo<Record<ResourceCategory, HistoryItem[]>>(
    () => ({
      'learner-profiles': learnerProfiles.map((learner) => ({
        id: String(learner.id),
        title: String(getLearnerName(learner)),
        subtitle: learner.anonymous_id,
        createdAt: learner.created_at,
        href: `/dashboard/tools/learner-profiles?learnerId=${learner.id}`,
      })),
      'lesson-plans': lessonPlans.map((plan) => ({
        id: String(plan.id),
        title: getLessonTitle(plan),
        subtitle: 'Lesson plan',
        createdAt: plan.created_at,
        href: `/dashboard/tools/assessment-planner?resource=lesson-plan&id=${plan.id}`,
      })),
      communications: parentCommunications.map((communication) => ({
        id: String(communication.id),
        title:
          communication.type === 'progress' ? 'Progress communication' : 'Concern communication',
        subtitle: communication.learner_anonymous_id || 'Parent communication',
        createdAt: communication.created_at,
        href: `/dashboard/community/parent-communication?id=${communication.id}`,
      })),
      activity: activities.map((activity) => ({
        id: String(activity.id),
        title: activity.description,
        subtitle: activity.activity_type.replace(/_/g, ' '),
        createdAt: activity.created_at,
        href: '/dashboard',
      })),
      'open-tasks': tasks
        .filter((task) => task.status !== 'completed')
        .map((task) => ({
          id: String(task.id),
          title: task.title,
          subtitle: `${task.priority} priority - ${task.status.replace('_', ' ')}`,
          createdAt: task.due_date || task.created_at,
          href: '/dashboard',
        })),
      'scheduled-work': tasks
        .filter((task) => Boolean(task.due_date))
        .map((task) => ({
          id: String(task.id),
          title: task.title,
          subtitle: task.description || 'Scheduled teacher task',
          createdAt: task.due_date || task.created_at,
          href: '/dashboard/tools/schedule-tracking',
        })),
    }),
    [activities, learnerProfiles, lessonPlans, parentCommunications, tasks],
  );

  const cards = useMemo<ResourceCard[]>(
    () => [
      {
        id: 'learner-profiles',
        title: 'Learner Profiles',
        count: learnerProfiles.length,
        description: 'Anonymised learner records',
        emptyMessage: 'No learner profiles have been added yet.',
        icon: Users,
        accent: {
          icon: 'text-blue-700',
          iconBg: 'bg-blue-50',
          selected: 'border-blue-400 bg-blue-50',
          hover: 'hover:border-blue-300',
        },
      },
      {
        id: 'lesson-plans',
        title: 'Lesson Plans',
        count: lessonPlans.length,
        description: 'Generated teaching resources',
        emptyMessage: 'No lesson plans have been generated yet.',
        icon: FileText,
        accent: {
          icon: 'text-emerald-700',
          iconBg: 'bg-emerald-50',
          selected: 'border-emerald-400 bg-emerald-50',
          hover: 'hover:border-emerald-300',
        },
      },
      {
        id: 'communications',
        title: 'Communications',
        count: parentCommunications.length,
        description: 'Progress and concern updates',
        emptyMessage: 'No parent communications have been created yet.',
        icon: MessageSquareText,
        accent: {
          icon: 'text-cyan-700',
          iconBg: 'bg-cyan-50',
          selected: 'border-cyan-400 bg-cyan-50',
          hover: 'hover:border-cyan-300',
        },
      },
      {
        id: 'activity',
        title: 'Recent Activity',
        count: activities.length,
        description: 'Updates across your workspace',
        emptyMessage: 'No workspace activity has been recorded yet.',
        icon: ActivityIcon,
        accent: {
          icon: 'text-amber-700',
          iconBg: 'bg-amber-50',
          selected: 'border-amber-400 bg-amber-50',
          hover: 'hover:border-amber-300',
        },
      },
      {
        id: 'open-tasks',
        title: 'Open Tasks',
        count: tasks.filter((task) => task.status !== 'completed').length,
        description: 'Pending and active teacher work',
        emptyMessage: 'You have no open tasks.',
        icon: ClipboardCheck,
        accent: {
          icon: 'text-rose-700',
          iconBg: 'bg-rose-50',
          selected: 'border-rose-400 bg-rose-50',
          hover: 'hover:border-rose-300',
        },
      },
      {
        id: 'scheduled-work',
        title: 'Scheduled Work',
        count: tasks.filter((task) => Boolean(task.due_date)).length,
        description: 'Tasks with dates and reminders',
        emptyMessage: 'No dated tasks have been scheduled yet.',
        icon: CalendarDays,
        accent: {
          icon: 'text-[#087d8c]',
          iconBg: 'bg-teal-50',
          selected: 'border-[#38a8b5] bg-teal-50',
          hover: 'hover:border-[#7bc6ce]',
        },
      },
    ],
    [activities.length, learnerProfiles.length, lessonPlans.length, parentCommunications.length, tasks],
  );

  const selectedCard = cards.find((card) => card.id === selectedCategory) || cards[0];
  const filteredHistory = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const items = historyMap[selectedCategory];
    if (!query) return items;

    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query),
    );
  }, [historyMap, searchTerm, selectedCategory]);

  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== 'completed')
        .sort((a, b) => {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        })
        .slice(0, 5),
    [tasks],
  );

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) {
      setTaskMessage('Add a task title before saving.');
      return;
    }

    setSavingTask(true);
    setTaskMessage('');
    try {
      await api.createTask({
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        priority: taskPriority,
        due_date: taskDueDate || null,
      });
      setTaskTitle('');
      setTaskDescription('');
      setTaskPriority('medium');
      setTaskDueDate('');
      setTaskMessage('Task created.');
      setShowTaskForm(false);
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to create task:', error);
      setTaskMessage('We could not save that task.');
    } finally {
      setSavingTask(false);
    }
  };

  const handleAdvanceTask = async (task: TeacherTask) => {
    const nextStatus = task.status === 'pending' ? 'in_progress' : 'completed';
    try {
      await api.updateTask(task.id, { status: nextStatus });
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to update task:', error);
      setTaskMessage('We could not update that task.');
    }
  };

  return (
    <DashboardLayout activeTab="home">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#087d8c]">Teacher overview</p>
            <h2 className="mt-1 text-3xl font-bold text-slate-900">Welcome back</h2>
            <p className="mt-1 text-slate-600">
              Open recent resources, check your workload, and continue where you left off.
            </p>
          </div>
          <Link
            href="/dashboard/tools"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0b4f5c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#083f49]"
          >
            Open AI tools
            <ChevronRight className="h-4 w-4" />
          </Link>
        </header>

        <section
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Workspace resources"
        >
          {cards.map((card) => {
            const Icon = card.icon;
            const isSelected = card.id === selectedCategory;

            return (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(card.id);
                  setSearchTerm('');
                }}
                className={`min-h-36 rounded-lg border-2 p-5 text-left transition ${
                  isSelected
                    ? card.accent.selected
                    : `border-slate-200 bg-white ${card.accent.hover} hover:shadow-sm`
                }`}
                aria-pressed={isSelected}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{card.title}</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{card.count}</p>
                  </div>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.accent.iconBg}`}
                  >
                    <Icon className={`h-5 w-5 ${card.accent.icon}`} />
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-500">{card.description}</p>
              </button>
            );
          })}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedCard.title}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Search and open your latest workspace items.
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={`Search ${selectedCard.title.toLowerCase()}`}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
                />
              </div>
            </div>

            <div className="min-h-72 p-2">
              {loading ? (
                <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
                  Loading workspace...
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                  <selectedCard.icon className="h-9 w-9 text-slate-300" />
                  <p className="mt-3 font-medium text-slate-700">{selectedCard.emptyMessage}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    New items will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredHistory.slice(0, 10).map((item) => (
                    <Link
                      key={`${selectedCategory}-${item.id}`}
                      href={item.href}
                      className="flex items-start justify-between gap-4 rounded-md px-4 py-4 transition hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{item.title}</p>
                        <p className="mt-1 truncate text-sm capitalize text-slate-500">
                          {item.subtitle}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 flex-none text-slate-400" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Upcoming tasks</h3>
                <p className="mt-1 text-sm text-slate-500">{upcomingTasks.length} shown</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTaskForm((current) => !current);
                  setTaskMessage('');
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0b4f5c] text-white transition hover:bg-[#083f49]"
                aria-label={showTaskForm ? 'Close task form' : 'Add task'}
                title={showTaskForm ? 'Close task form' : 'Add task'}
              >
                {showTaskForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>

            {showTaskForm && (
              <div className="space-y-3 border-b border-slate-200 bg-slate-50 p-5">
                <input
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  placeholder="Task title"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
                />
                <textarea
                  value={taskDescription}
                  onChange={(event) => setTaskDescription(event.target.value)}
                  placeholder="Optional note"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <select
                    value={taskPriority}
                    onChange={(event) =>
                      setTaskPriority(event.target.value as TeacherTask['priority'])
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
                  >
                    <option value="low">Low priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="high">High priority</option>
                  </select>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(event) => setTaskDueDate(event.target.value)}
                    className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateTask}
                  disabled={savingTask}
                  className="w-full rounded-lg bg-[#0b4f5c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#083f49] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingTask ? 'Saving...' : 'Save task'}
                </button>
                {taskMessage && <p className="text-sm text-slate-600">{taskMessage}</p>}
              </div>
            )}

            <div className="p-2">
              {loading ? (
                <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
                  Loading tasks...
                </div>
              ) : upcomingTasks.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
                  <CheckCircle2 className="h-9 w-9 text-emerald-400" />
                  <p className="mt-3 font-medium text-slate-700">Your task list is clear</p>
                  <p className="mt-1 text-sm text-slate-500">Add a task when something comes up.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {upcomingTasks.map((task) => (
                    <div key={task.id} className="px-3 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-slate-900">{task.title}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${taskBadgeStyles[task.priority]}`}
                            >
                              {task.priority}
                            </span>
                          </div>
                          {task.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                              {task.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                            <Clock3 className="h-3.5 w-3.5" />
                            {task.due_date ? `Due ${formatDate(task.due_date)}` : 'No due date'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAdvanceTask(task)}
                          className="flex-none rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                        >
                          {task.status === 'pending' ? 'Start' : 'Complete'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 p-4">
              <Link
                href="/dashboard/tools/schedule-tracking"
                className="flex items-center justify-between rounded-lg bg-teal-50 px-3 py-3 text-sm font-medium text-[#075f6a] transition hover:bg-teal-100"
              >
                Open schedule tracking
                <CalendarDays className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Quick actions">
          {[
            {
              title: 'Add learner profiles',
              description: 'Import or create anonymised learner records.',
              href: '/dashboard/tools/learner-profiles',
              icon: Users,
            },
            {
              title: 'Plan a lesson',
              description: 'Build an assessment or teaching resource.',
              href: '/dashboard/tools/assessment-planner',
              icon: FileText,
            },
            {
              title: 'Contact a parent',
              description: 'Draft a progress update or concern message.',
              href: '/dashboard/community/parent-communication',
              icon: MessageSquareText,
            },
          ].map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-[#7bc6ce] hover:shadow-sm"
            >
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-teal-50">
                <action.icon className="h-4 w-4 text-[#087d8c]" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{action.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{action.description}</p>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </DashboardLayout>
  );
}
