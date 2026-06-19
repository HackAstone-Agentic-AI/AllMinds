'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { AlertCircle, ArrowLeft, ClipboardList, FileText, Lightbulb, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface TeacherProfileSummary {
  id: number;
  surname: string;
  title: string;
}

export default function AssessmentPlannerPage() {
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfileSummary | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [plannerInput, setPlannerInput] = useState({
    subject: '',
    topic: '',
    grade: '',
    supportNeed: '',
  });
  const [generatedPlan, setGeneratedPlan] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const loadTeacherProfile = useCallback(async () => {
    const token = localStorage.getItem('allminds_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const data = await api.getProfile();
      setTeacherProfile({ id: data.id, surname: data.surname, title: data.title });
    } catch {
      router.push('/login');
    }

    setLoadingProfile(false);
  }, [router]);

  useEffect(() => {
    void loadTeacherProfile();
  }, [loadTeacherProfile]);

  const generatePlan = async () => {
    if (!plannerInput.subject || !plannerInput.topic || !plannerInput.grade) {
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const supportContext = plannerInput.supportNeed
        ? `Specific support need: ${plannerInput.supportNeed}.`
        : 'Use inclusive supports for neurodivergent learners.';

      const response = await api.chatWithAgent(
        `Create an inclusive assessment and lesson support plan for Grade ${plannerInput.grade} ${plannerInput.subject} on ${plannerInput.topic}. ${supportContext} Keep it practical for a classroom teacher.`,
        {
          thread_id: `assessment-planner-${teacherProfile?.id || 'guest'}`,
        },
      );

      setGeneratedPlan(response.response?.output || 'No plan was returned.');
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Failed to generate the plan.',
      );
    } finally {
      setIsGenerating(false);
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
            <h2 className="text-3xl font-bold text-slate-800">
              Assessment & Pedagogical Planner
            </h2>
            <p className="text-slate-600 mt-1">
              Plan inclusive assessments and classroom tasks
            </p>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ClipboardList className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900 mb-1">Profile Context</h3>
              {loadingProfile ? (
                <p className="text-sm text-green-800">Loading your profile...</p>
              ) : teacherProfile ? (
                <p className="text-sm text-green-800">
                  Planning as {teacherProfile.title} {teacherProfile.surname}.
                </p>
              ) : (
                <p className="text-sm text-green-800">Redirecting to login...</p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-green-600" />
              <h3 className="text-xl font-semibold text-slate-800">Assessment Builder</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
                <input
                  type="text"
                  value={plannerInput.subject}
                  onChange={(event) =>
                    setPlannerInput((current) => ({ ...current, subject: event.target.value }))
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="e.g. Mathematics"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Topic</label>
                <input
                  type="text"
                  value={plannerInput.topic}
                  onChange={(event) =>
                    setPlannerInput((current) => ({ ...current, topic: event.target.value }))
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="e.g. Fractions and equivalence"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Grade</label>
                <input
                  type="text"
                  value={plannerInput.grade}
                  onChange={(event) =>
                    setPlannerInput((current) => ({ ...current, grade: event.target.value }))
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="e.g. 5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Specific Support Need
                </label>
                <input
                  type="text"
                  value={plannerInput.supportNeed}
                  onChange={(event) =>
                    setPlannerInput((current) => ({
                      ...current,
                      supportNeed: event.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="e.g. visual scaffolds, reduced writing load"
                />
              </div>

              <button
                onClick={() => void generatePlan()}
                disabled={
                  isGenerating ||
                  !plannerInput.subject ||
                  !plannerInput.topic ||
                  !plannerInput.grade
                }
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                {isGenerating ? 'Generating...' : 'Generate Planner'}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 min-h-[320px]">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                <h3 className="text-xl font-semibold text-slate-800">Generated Guidance</h3>
              </div>

              {generatedPlan ? (
                <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-6 font-sans">
                  {generatedPlan}
                </pre>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-14 h-14 mx-auto mb-4 text-slate-300" />
                  <p className="font-medium">No plan generated yet</p>
                  <p className="text-sm mt-2">
                    Complete the form to build an inclusive assessment outline
                  </p>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">Planning Reminders</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>Use more than one response method where possible.</li>
                <li>Keep success criteria visible throughout the task.</li>
                <li>Plan one clear extension and one support pathway.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
