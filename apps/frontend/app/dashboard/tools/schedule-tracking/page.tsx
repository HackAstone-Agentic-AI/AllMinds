'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { LearnerProfile } from '@/types/database';
import { ArrowLeft, Calendar, Clock3, Plus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface ScheduleItem {
  id: number;
  learnerId: number;
  title: string;
  time: string;
  notes: string;
}

const mapLearnerRow = (learner: LearnerProfile) => ({
  ...learner,
  id: Number(learner.id),
});

export default function ScheduleTrackingPage() {
  const [learnerProfiles, setLearnerProfiles] = useState<LearnerProfile[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState<number | null>(null);
  const [loadingLearners, setLoadingLearners] = useState(true);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [newItem, setNewItem] = useState({ title: '', time: '', notes: '' });
  const router = useRouter();

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

  const selectedLearner =
    learnerProfiles.find((learner) => learner.id === selectedLearnerId) ?? null;

  const addScheduleItem = () => {
    if (!selectedLearnerId || !newItem.title.trim() || !newItem.time.trim()) {
      return;
    }

    const item: ScheduleItem = {
      id: Date.now(),
      learnerId: selectedLearnerId,
      title: newItem.title.trim(),
      time: newItem.time.trim(),
      notes: newItem.notes.trim(),
    };

    setScheduleItems((current) =>
      [...current, item].sort((a, b) => a.time.localeCompare(b.time)),
    );
    setNewItem({ title: '', time: '', notes: '' });
  };

  const filteredItems = scheduleItems.filter((item) => item.learnerId === selectedLearnerId);

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
                  onClick={addScheduleItem}
                  disabled={!selectedLearnerId || !newItem.title.trim() || !newItem.time.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Item
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

            {filteredItems.length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-300 rounded-xl">
                <Clock3 className="w-14 h-14 mx-auto mb-4 text-slate-300" />
                <p className="font-medium">No schedule items yet</p>
                <p className="text-sm mt-2">
                  Add a classroom activity to start building a predictable routine
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => (
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
                      <span className="text-sm font-medium text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
                        {item.time}
                      </span>
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
