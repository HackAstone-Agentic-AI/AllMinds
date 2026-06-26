'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { LearnerProfile, LearnerScheduleItem } from '@/types/database';
import { AlertCircle, ArrowLeft, Calendar, Clock3, Plus, Trash2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const mapLearnerRow = (learner: LearnerProfile) => ({
  ...learner,
  id: Number(learner.id),
});

export default function ScheduleTrackingPage() {
  const [learnerProfiles, setLearnerProfiles] = useState<LearnerProfile[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState<number | null>(null);
  const [loadingLearners, setLoadingLearners] = useState(true);
  const [scheduleItems, setScheduleItems] = useState<LearnerScheduleItem[]>([]);
  const [newItem, setNewItem] = useState({ title: '', time: '', notes: '' });
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [error, setError] = useState('');
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState('');
  const router = useRouter();

  useEffect(() => {
    api
      .getCalendarStatus()
      .then((status) => {
        setCalendarConnected(Boolean(status?.connected));
        setCalendarEmail(status?.gmail_email ?? null);
      })
      .catch(() => {
        setCalendarConnected(false);
        setCalendarEmail(null);
      });
  }, []);

  const connectGoogleCalendar = async () => {
    try {
      const { url } = await api.getCalendarConnectUrl();
      window.location.href = url;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not start the Google Calendar connection.',
      );
    }
  };

  const loadLearnersFromDatabase = useCallback(async () => {
    setLoadingLearners(true);
    try {
      const data = await api.getLearners();
      const learners = data.map(mapLearnerRow);
      setLearnerProfiles(learners);
      if (learners.length) {
        setSelectedLearnerId(learners[0].id);
      }
    } catch (error) {
      console.error('Failed to load learners:', error);
    } finally {
      setLoadingLearners(false);
    }
  }, []);

  useEffect(() => {
    void loadLearnersFromDatabase();
  }, [loadLearnersFromDatabase]);

  useEffect(() => {
    if (!selectedLearnerId) {
      setScheduleItems([]);
      return;
    }

    let active = true;
    setLoadingSchedule(true);
    setError('');
    api
      .getScheduleItems(selectedLearnerId)
      .then((items) => {
        if (active) setScheduleItems(items);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Failed to load the learner schedule.',
          );
        }
      })
      .finally(() => {
        if (active) setLoadingSchedule(false);
      });

    return () => {
      active = false;
    };
  }, [selectedLearnerId]);

  const selectedLearner =
    learnerProfiles.find((learner) => learner.id === selectedLearnerId) ?? null;

  const addScheduleItem = async () => {
    if (!selectedLearnerId || !newItem.title.trim() || !newItem.time.trim()) {
      return;
    }

    setSavingItem(true);
    setError('');
    setSyncNotice('');
    try {
      const item = await api.createScheduleItem({
        learner_id: selectedLearnerId,
        title: newItem.title.trim(),
        start_time: newItem.time.trim(),
        notes: newItem.notes.trim(),
      });
      setScheduleItems((current) =>
        [...current, item].sort((a, b) => a.start_time.localeCompare(b.start_time)),
      );

      // Mirror the item to the teacher's Google Calendar when connected. A sync
      // failure must not lose the item, which is already saved above.
      if (calendarConnected) {
        try {
          await api.createCalendarEvent({
            title: newItem.title.trim(),
            start_time: newItem.time.trim(),
            notes: newItem.notes.trim() || undefined,
          });
          setSyncNotice('Added to your Google Calendar.');
        } catch {
          setSyncNotice('Saved here, but it could not be added to Google Calendar. Try reconnecting in Settings.');
        }
      }

      setNewItem({ title: '', time: '', notes: '' });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to save the schedule item.',
      );
    } finally {
      setSavingItem(false);
    }
  };

  const deleteScheduleItem = async (itemId: number) => {
    setError('');
    try {
      await api.deleteScheduleItem(itemId);
      setScheduleItems((current) => current.filter((item) => item.id !== itemId));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to delete the schedule item.',
      );
    }
  };

  return (
    <DashboardLayout activeTab="tools">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/tools')}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-slate-800">Schedule Tracking</h2>
            <p className="text-slate-600 mt-1">
              Organize learner routines, transitions, and classroom activities
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 flex-none text-[#087d8c]" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Google Calendar</p>
              {calendarConnected ? (
                <p className="text-sm text-slate-600">
                  Connected{calendarEmail ? ` as ${calendarEmail}` : ''} — new schedule items are added to your calendar.
                </p>
              ) : (
                <p className="text-sm text-slate-600">
                  Connect your Google Calendar to sync schedule items automatically.
                </p>
              )}
            </div>
          </div>
          {!calendarConnected && (
            <button
              type="button"
              onClick={() => void connectGoogleCalendar()}
              className="rounded-lg bg-[#0b4f5c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#083f49]"
            >
              Connect
            </button>
          )}
        </div>

        {syncNotice && (
          <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {syncNotice}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-purple-600" />
              <h3 className="text-xl font-semibold text-slate-800">Learners</h3>
            </div>

            {loadingLearners ? (
              <p className="text-sm text-slate-500">Loading learner profiles...</p>
            ) : learnerProfiles.length === 0 ? (
              <div className="text-sm text-slate-500">
                No learner profiles available yet. Add learners to begin schedule tracking.
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Select Learner
                </label>
                <select
                  value={selectedLearnerId ?? ''}
                  onChange={(event) => setSelectedLearnerId(Number(event.target.value))}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                >
                  {learnerProfiles.map((learner) => (
                    <option key={learner.id} value={learner.id}>
                      {learner.anonymous_id}
                    </option>
                  ))}
                </select>

                {selectedLearner && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-sm text-purple-900 font-medium">
                      Active learner: {selectedLearner.anonymous_id}
                    </p>
                    <p className="text-xs text-purple-700 mt-1">
                      Use this planner to keep transitions predictable and visible.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-purple-600" />
              <h3 className="text-xl font-semibold text-slate-800">Daily Schedule Planner</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Activity
                </label>
                <input
                  type="text"
                  value={newItem.title}
                  onChange={(event) =>
                    setNewItem((current) => ({ ...current, title: event.target.value }))
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                  placeholder="e.g. Reading group"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Time</label>
                <input
                  type="time"
                  value={newItem.time}
                  onChange={(event) =>
                    setNewItem((current) => ({ ...current, time: event.target.value }))
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => void addScheduleItem()}
                  disabled={
                    savingItem ||
                    !selectedLearnerId ||
                    !newItem.title.trim() ||
                    !newItem.time.trim()
                  }
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  {savingItem ? 'Saving...' : 'Add item'}
                </button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              <textarea
                value={newItem.notes}
                onChange={(event) =>
                  setNewItem((current) => ({ ...current, notes: event.target.value }))
                }
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                rows={3}
                placeholder="Add reminders, transition supports, or preparation notes"
              />
            </div>

            {loadingSchedule ? (
              <div className="space-y-3" aria-label="Loading schedule">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-20 animate-pulse rounded-lg bg-slate-100"
                  />
                ))}
              </div>
            ) : scheduleItems.length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-300 rounded-xl">
                <Clock3 className="w-14 h-14 mx-auto mb-4 text-slate-300" />
                <p className="font-medium">No schedule items yet</p>
                <p className="text-sm mt-2">
                  Add a classroom activity to start building a predictable routine
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduleItems.map((item) => (
                  <div
                    key={item.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-sm transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-medium text-slate-800">{item.title}</h4>
                        {item.notes && (
                          <p className="text-sm text-slate-600 mt-1">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
                          {item.start_time}
                        </span>
                        <button
                          type="button"
                          onClick={() => void deleteScheduleItem(item.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          aria-label={`Delete ${item.title}`}
                          title="Delete schedule item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
