'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { LearnerProfile, LearnerProgress } from '@/types/database';
import { X, Plus, TrendingUp } from 'lucide-react';
import { getLearnerDisplayName, getLearnerSecondaryLabel } from '@/lib/learners';

interface LearnerProgressModalProps {
  learner: LearnerProfile;
  onClose: () => void;
  onUpdate: () => void;
}

export default function LearnerProgressModal({
  learner,
  onClose,
  onUpdate,
}: LearnerProgressModalProps) {
  const learnerName = getLearnerDisplayName(learner);
  const learnerId = getLearnerSecondaryLabel(learner);
  const [progressRecords, setProgressRecords] = useState<LearnerProgress[]>([]);
  const [newProgress, setNewProgress] = useState({
    area: '',
    level: '',
    notes: '',
    achievements: '',
  });
  const [saving, setSaving] = useState(false);

  const generateAiSuggestions = () => {
    if (!newProgress.area || !newProgress.level) {
      return '';
    }

    const suggestions = [
      `Continue reinforcing ${newProgress.area.toLowerCase()} through scaffolded practice.`,
      newProgress.level === 'Needs Support'
        ? 'Break tasks into smaller steps and provide more frequent check-ins.'
        : 'Introduce a slightly more challenging follow-up activity to build momentum.',
    ];

    return suggestions.join(' ');
  };

  const loadProgress = useCallback(async () => {
    try {
      const data = await api.getProgress(learner.id);
      setProgressRecords(data);
    } catch (err) {
      console.error('Failed to load progress:', err);
    }
  }, [learner.id]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  const handleSaveProgress = async () => {
    if (!newProgress.area.trim()) return;
    setSaving(true);
    try {
      const aiSuggestions = generateAiSuggestions();
      await api.createProgress(learner.id, {
        area: newProgress.area,
        level: newProgress.level,
        achievements: newProgress.achievements,
        notes: newProgress.notes,
        engagementLevel: '',
        engagementDescription: '',
        attendance: '',
        taskCompletionLevel: '',
        taskCompletionDescription: '',
        aiSuggestions,
      });
      setNewProgress({ area: '', level: '', notes: '', achievements: '' });
      await loadProgress();
      onUpdate();
    } catch (err) {
      console.error('Failed to save progress:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Learner Progress</h2>
            <p className="text-sm text-slate-600">{learnerName}</p>
            {learnerId && <p className="text-xs text-slate-500">{learnerId}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">Track Academic Progress</h3>
            <p className="text-sm text-green-800">
              Monitor and record learner development across different areas. Track achievements,
              challenges, and growth over time.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              Record New Progress
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Learning Area
                </label>
                <select
                  value={newProgress.area}
                  onChange={(e) => setNewProgress({ ...newProgress, area: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                >
                  <option value="">Select an area</option>
                  <option value="Reading">Reading</option>
                  <option value="Writing">Writing</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Science">Science</option>
                  <option value="Social Skills">Social Skills</option>
                  <option value="Communication">Communication</option>
                  <option value="Motor Skills">Motor Skills</option>
                  <option value="Behavior">Behavior</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Progress Level
                </label>
                <select
                  value={newProgress.level}
                  onChange={(e) => setNewProgress({ ...newProgress, level: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                >
                  <option value="">Select level</option>
                  <option value="Excellent">Excellent Progress</option>
                  <option value="Good">Good Progress</option>
                  <option value="Moderate">Moderate Progress</option>
                  <option value="Needs Support">Needs Additional Support</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Achievements
                </label>
                <input
                  type="text"
                  value={newProgress.achievements}
                  onChange={(e) =>
                    setNewProgress({ ...newProgress, achievements: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="e.g., Completed 5 reading exercises independently"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea
                  value={newProgress.notes}
                  onChange={(e) => setNewProgress({ ...newProgress, notes: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  rows={3}
                  placeholder="Additional observations or recommendations"
                />
              </div>

              <button
                onClick={handleSaveProgress}
                disabled={saving || !newProgress.area}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Progress Record'}
              </button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-800 mb-4">Progress History</h3>
            {progressRecords.length === 0 ? (
              <div className="text-center py-8 text-slate-500 border border-slate-200 rounded-lg">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No progress records yet</p>
                <p className="text-sm mt-2">Start tracking to monitor learner development</p>
              </div>
            ) : (
              <div className="space-y-3">
                {progressRecords.map((record) => (
                  <div
                    key={record.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-slate-800">{record.progress_data.area}</h4>
                        <span
                          className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${
                            record.progress_data.level === 'Excellent'
                              ? 'bg-green-100 text-green-700'
                              : record.progress_data.level === 'Good'
                              ? 'bg-blue-100 text-blue-700'
                              : record.progress_data.level === 'Moderate'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {record.progress_data.level}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(record.recorded_at).toLocaleDateString()}
                      </span>
                    </div>
                    {record.progress_data.achievements && (
                      <p className="text-sm text-slate-600 mb-1">
                        <span className="font-medium">Achievements:</span>{' '}
                        {record.progress_data.achievements}
                      </p>
                    )}
                    {record.progress_data.notes && (
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Notes:</span> {record.progress_data.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
