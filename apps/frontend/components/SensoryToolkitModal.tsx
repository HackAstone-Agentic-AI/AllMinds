'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { LearnerProfile, SensoryToolkitLog } from '@/types/database';
import { X, Plus } from 'lucide-react';
import { getLearnerDisplayName, getLearnerSecondaryLabel } from '@/lib/learners';

interface SensoryToolkitModalProps {
  learner: LearnerProfile;
  onClose: () => void;
  onUpdate: () => void;
}

export default function SensoryToolkitModal({
  learner,
  onClose,
  onUpdate,
}: SensoryToolkitModalProps) {
  const learnerName = getLearnerDisplayName(learner);
  const learnerId = getLearnerSecondaryLabel(learner);
  const [logs, setLogs] = useState<SensoryToolkitLog[]>([]);
  const [newLog, setNewLog] = useState({
    behavior: '',
    trigger: '',
    response: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadLogs = useCallback(async () => {
    try {
      const data = await api.getSensoryLogs(learner.id);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load sensory logs:', err);
      setError(err instanceof Error ? err.message : 'Could not load observations.');
    }
  }, [learner.id]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleSaveLog = async () => {
    if (!newLog.behavior.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.createSensoryLog(learner.id, {
        behavior: newLog.behavior,
        trigger: newLog.trigger,
        response: newLog.response,
        notes: newLog.notes,
      });
      setNewLog({ behavior: '', trigger: '', response: '', notes: '' });
      await loadLogs();
      onUpdate();
    } catch (err) {
      console.error('Failed to save log:', err);
      setError(err instanceof Error ? err.message : 'Could not save this observation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Sensory Toolkit</h2>
            <p className="text-sm text-slate-600">{learnerName}</p>
            {learnerId && <p className="text-xs text-slate-500">{learnerId}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-semibold text-amber-900 mb-2">About Sensory Toolkit</h3>
            <p className="text-sm text-amber-800">
              Track and log learner behaviors related to neurodiverse conditions. Document
              triggers, responses, and effective interventions to better support your students.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Log New Behavior
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Observed Behavior
                </label>
                <input
                  type="text"
                  value={newLog.behavior}
                  onChange={(e) => setNewLog({ ...newLog, behavior: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="e.g., Difficulty focusing during reading time"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Potential Trigger
                </label>
                <input
                  type="text"
                  value={newLog.trigger}
                  onChange={(e) => setNewLog({ ...newLog, trigger: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="e.g., Bright classroom lights, loud noises"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Intervention/Response
                </label>
                <input
                  type="text"
                  value={newLog.response}
                  onChange={(e) => setNewLog({ ...newLog, response: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="e.g., Provided noise-canceling headphones"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  value={newLog.notes}
                  onChange={(e) => setNewLog({ ...newLog, notes: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  rows={3}
                  placeholder="Additional observations or context"
                />
              </div>

              <button
                onClick={handleSaveLog}
                disabled={saving || !newLog.behavior.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Log Entry'}
              </button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-800 mb-4">Behavior History</h3>
            {logs.length === 0 ? (
              <div className="text-center py-8 text-slate-500 border border-slate-200 rounded-lg">
                <p>No behavior logs yet</p>
                <p className="text-sm mt-2">Start logging to track patterns over time</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-slate-800">{log.log_data.behavior}</h4>
                      <span className="text-xs text-slate-500">
                        {new Date(log.logged_at).toLocaleDateString()}
                      </span>
                    </div>
                    {log.log_data.trigger && (
                      <p className="text-sm text-slate-600 mb-1">
                        <span className="font-medium">Trigger:</span> {log.log_data.trigger}
                      </p>
                    )}
                    {log.log_data.response && (
                      <p className="text-sm text-slate-600 mb-1">
                        <span className="font-medium">Response:</span> {log.log_data.response}
                      </p>
                    )}
                    {log.log_data.notes && (
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Notes:</span> {log.log_data.notes}
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
