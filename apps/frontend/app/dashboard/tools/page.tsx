'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { Eye, FileText, Users, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ToolsPage() {
  const router = useRouter();

  const tools = [
    {
      id: 'visual-support',
      name: 'Visual Support',
      description: 'Generate images and source educational videos for neurodiverse learners',
      icon: Eye,
      color: 'blue',
      href: '/dashboard/tools/visual-support',
    },
    {
      id: 'assessment-planner',
      name: 'Assessment & Pedagogical Planner',
      description: 'Create worksheets, tests, and homework materials',
      icon: FileText,
      color: 'green',
      href: '/dashboard/tools/assessment-planner',
    },
    {
      id: 'learner-profiles',
      name: 'Learner Profiles',
      description: 'Manage anonymized learner data and track progress',
      icon: Users,
      color: 'amber',
      href: '/dashboard/tools/learner-profiles',
    },
    {
      id: 'schedule-tracking',
      name: 'Schedule Tracking',
      description: 'Track and manage learner schedules and activities',
      icon: Calendar,
      color: 'purple',
      href: '/dashboard/tools/schedule-tracking',
    },
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: {
        bg: 'bg-blue-50',
        icon: 'bg-blue-100',
        iconColor: 'text-blue-600',
        border: 'hover:border-blue-300',
      },
      green: {
        bg: 'bg-green-50',
        icon: 'bg-green-100',
        iconColor: 'text-green-600',
        border: 'hover:border-green-300',
      },
      amber: {
        bg: 'bg-amber-50',
        icon: 'bg-amber-100',
        iconColor: 'text-amber-600',
        border: 'hover:border-amber-300',
      },
      purple: {
        bg: 'bg-purple-50',
        icon: 'bg-purple-100',
        iconColor: 'text-purple-600',
        border: 'hover:border-purple-300',
      },
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <DashboardLayout activeTab="tools">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">AI Tools</h2>
          <p className="text-slate-600 mt-1">
            Powerful AI-assisted tools to support neurodiverse learners
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tools.map((tool) => {
            const colors = getColorClasses(tool.color);
            return (
              <button
                key={tool.id}
                onClick={() => router.push(tool.href)}
                className={`bg-white border-2 border-slate-200 ${colors.border} rounded-xl p-6 hover:shadow-lg transition text-left group`}
              >
                <div className="flex items-start gap-4">
                  <div className={`${colors.icon} w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition`}>
                    <tool.icon className={`w-6 h-6 ${colors.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-slate-800 mb-2">
                      {tool.name}
                    </h3>
                    <p className="text-slate-600 text-sm">{tool.description}</p>
                    <div className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-600 group-hover:gap-3 transition-all">
                      Open Tool
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl p-8 border border-blue-100">
          <div className="max-w-2xl">
            <h3 className="text-xl font-semibold text-slate-800 mb-3">
              About All Minds AI Agents
            </h3>
            <p className="text-slate-600 mb-4">
              Each tool is powered by specialized AI agents designed to assist teachers in
              creating inclusive learning environments for neurodiverse students. These agents
              work together to provide comprehensive support across visual learning, assessment
              creation, learner profiling, and schedule management.
            </p>
            <p className="text-slate-600 text-sm">
              Click on any tool above to get started with AI-assisted teaching support.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
