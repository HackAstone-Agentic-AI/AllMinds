'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

export interface ProgressStep {
  label: string;
  // Seconds after start when this step typically begins.
  at: number;
}

// Shows what the agents are doing during a long generation instead of a bare spinner.
// Steps advance on typical timings; the real request finishing ends the indicator.
export default function AiProgress({ active, steps, note }: { active: boolean; steps: ProgressStep[]; note?: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  if (!active) return null;
  const currentIndex = steps.reduce((found, step, index) => (elapsed >= step.at ? index : found), 0);

  return (
    <div role="status" aria-live="polite" className="rounded-lg border border-purple-200 bg-purple-50 p-4">
      <ol className="space-y-1.5">
        {steps.map((step, index) => (
          <li key={step.label} className={`flex items-center gap-2 text-sm ${index > currentIndex ? 'text-purple-300' : 'text-purple-900'}`}>
            {index < currentIndex ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : index === currentIndex ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="h-4 w-4 rounded-full border border-purple-200" />
            )}
            {step.label}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-purple-700">
        {elapsed}s elapsed{note ? ` · ${note}` : ''}
      </p>
    </div>
  );
}
