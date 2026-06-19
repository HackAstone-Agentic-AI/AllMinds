'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Activity,
  LearnerProfile,
  LessonPlan,
  ParentCommunication,
  TeacherTask,
} from '@/types/database';
import { CheckCircle2, ChevronRight, Clock, FileText, Plus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const taskBadgeStyles: Record<TeacherTask['priority'], string> = {
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-rose-100 text-rose-700',
};

export default function DashboardHome() {
  const [learnerProfiles, setLearnerProfiles] = useState<Array<LearnerProfile & { id: string }>>(
    [],
  );
  const [lessonPlans, setLessonPlans] = useState<Array<LessonPlan & { id: string }>>([]);
  const [parentCommunications, setParentCommunications] = useState<
    Array<ParentCommunication & { id: string }>
  >([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<TeacherTask[]>([]);
  const [loading, setLoading] = useState(true);
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
      const [learners, lessonPlansData, parentComms, activitiesData, tasksData] =
        await Promise.all([
          api.getLearners(),
          api.getLessonPlans(),
          api.getParentCommunications(),
          api.getActivities(),
          api.getTasks(),
        ]);

      setLearnerProfiles(
        learners.map((learner: LearnerProfile) => ({
          ...learner,
          id: String(learner.id),
        })),
      );
      setLessonPlans(
        lessonPlansData.map((plan: LessonPlan) => ({
          ...plan,
          id: String(plan.id),
        })),
      );
      setParentCommunications(
        parentComms.map((communication: ParentCommunication) => ({
          ...communication,
          id: String(communication.id),
        })),
      );
      setActivities(activitiesData);
      setTasks(tasksData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getTaskActionLabel = (status: TeacherTask['status']) => {
    if (status === 'pending') return 'Start';
    if (status === 'in_progress') return 'Complete';
    return 'Completed';
  };

  const getNextTaskStatus = (status: TeacherTask['status']) => {
    if (status === 'pending') return 'in_progress';
    if (status === 'in_progress') return 'completed';
    return 'completed';
  };

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
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to create task:', error);
      setTaskMessage('We could not save that task.');
    } finally {
      setSavingTask(false);
    }
  };

  const handleAdvanceTask = async (task: TeacherTask) => {
    if (task.status === 'completed') {
      return;
    }

    try {
      await api.updateTask(task.id, { status: getNextTaskStatus(task.status) });
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to update task:', error);
      setTaskMessage('We could not update that task.');
    }
  };

  return (
    <DashboardLayout activeTab="home">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Welcome Back</h2>
          <p className="text-slate-600 mt-1">
            Here&apos;s what&apos;s happening with your students today
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Total Learner Profiles</h3>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-800">{learnerProfiles.length}</p>
            <p className="text-xs text-slate-500 mt-2">Learners currently in your dashboard</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Lesson Plans</h3>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-800">{lessonPlans.length}</p>
            <p className="text-xs text-slate-500 mt-2">Generated lesson plans</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Recent Activities</h3>
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-800">{activities.length}</p>
            <p className="text-xs text-slate-500 mt-2">Tracked updates from your workspace</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Open Tasks</h3>
              <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-violet-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-800">
              {tasks.filter((task) => task.status !== 'completed').length}
            </p>
            <p className="text-xs text-slate-500 mt-2">Pending and in-progress tasks</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Parent Communications</h3>
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : parentCommunications.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p>No parent communications yet</p>
                <p className="text-sm mt-2">Communication history will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {parentCommunications.map((communication) => (
                  <div
                    key={communication.id}
                    className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg transition"
                  >
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800 line-clamp-2">
                        {communication.content}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {communication.type === 'progress' ? 'Progress update' : 'Concern'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatDate(communication.created_at)} at{' '}
                        {formatTime(communication.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Upcoming Tasks</h3>
              <span className="text-sm text-slate-500">
                {tasks.filter((task) => task.status !== 'completed').length} open
              </span>
            </div>

            <div className="space-y-3 mb-5">
              <input
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="Task title"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={taskDescription}
                onChange={(event) => setTaskDescription(event.target.value)}
                placeholder="Add a note or reminder"
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={taskPriority}
                  onChange={(event) =>
                    setTaskPriority(event.target.value as TeacherTask['priority'])
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="high">High priority</option>
                </select>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(event) => setTaskDueDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleCreateTask}
                disabled={savingTask}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {savingTask ? 'Saving...' : 'Add Task'}
              </button>
              {taskMessage && <p className="text-sm text-slate-600">{taskMessage}</p>}
            </div>

            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p>No upcoming tasks</p>
                <p className="text-sm mt-2">Create tasks to keep track of your work</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.slice(0, 6).map((task) => (
                  <div key={task.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-medium text-slate-800">{task.title}</h4>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-medium uppercase tracking-wide ${taskBadgeStyles[task.priority]}`}
                          >
                            {task.priority}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                        {task.description && (
                          <p className="mt-2 text-sm text-slate-600">{task.description}</p>
                        )}
                        <p className="mt-2 text-xs text-slate-500">
                          {task.due_date
                            ? `Due ${formatDate(task.due_date)}`
                            : `Created ${formatDate(task.created_at)}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAdvanceTask(task)}
                        disabled={task.status === 'completed'}
                        className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-default disabled:opacity-60"
                      >
                        {getTaskActionLabel(task.status)}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Recent Activity Feed ({activities.length})
            </h3>

            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Clock className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                <p className="font-medium">No recent activity yet</p>
                <p className="text-sm mt-2">Your learner updates and task changes will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 p-4"
                  >
                    <div className="mt-2 h-2 w-2 rounded-full bg-amber-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{activity.description}</p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                        {activity.activity_type.replace(/_/g, ' ')}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(activity.created_at)} at {formatTime(activity.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">
                Lesson Plans ({lessonPlans.length})
              </h3>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                View All
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : lessonPlans.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                <p className="font-medium">No lesson plans yet</p>
                <p className="text-sm mt-2">
                  Use the Tools section to generate your first lesson plan
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lessonPlans.slice(0, 6).map((plan) => (
                  <div
                    key={plan.id}
                    className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-800 truncate">{plan.title}</h4>
                        <p className="text-xs text-slate-500 mt-1">{formatDate(plan.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
