'use client';

import { useState } from 'react';
import { LearnerProfile } from '@/types/database';
import { User, Activity, TrendingUp, X } from 'lucide-react';
import SensoryToolkitModal from './SensoryToolkitModal';
import LearnerProgressModal from './LearnerProgressModal';

interface LearnerCardProps {
  learner: LearnerProfile;
  onUpdate: () => void;
}

export default function LearnerCard({ learner, onUpdate }: LearnerCardProps) {
  const [showSensoryToolkit, setShowSensoryToolkit] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-800 text-lg truncate">
              {learner.anonymous_id}
            </h4>
            <p className="text-sm text-slate-500">
              Added {new Date(learner.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {learner.profile_data && Object.keys(learner.profile_data).length > 0 && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs font-medium text-slate-600 mb-2">Profile Information</p>
            <div className="space-y-1">
              {Object.entries(learner.profile_data).slice(0, 3).map(([key, value]) => (
                <div key={key} className="text-xs text-slate-600">
                  <span className="font-medium capitalize">{key}:</span> {String(value)}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowSensoryToolkit(true)}
            className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
          >
            <Activity className="w-4 h-4" />
            Sensory Toolkit
          </button>

          <button
            onClick={() => setShowProgress(true)}
            className="bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Progress
          </button>
        </div>
      </div>

      {showSensoryToolkit && (
        <SensoryToolkitModal
          learner={learner}
          onClose={() => setShowSensoryToolkit(false)}
          onUpdate={onUpdate}
        />
      )}

      {showProgress && (
        <LearnerProgressModal
          learner={learner}
          onClose={() => setShowProgress(false)}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
}
