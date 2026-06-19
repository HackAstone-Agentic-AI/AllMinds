'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { MessageSquare, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CommunityPage() {
  const router = useRouter();

  return (
    <DashboardLayout activeTab="community">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Community</h2>
          <p className="text-slate-600 mt-1">Connect with parents and fellow educators</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => router.push('/dashboard/community/parent-communication')}
            className="bg-white border-2 border-slate-200 hover:border-blue-300 rounded-xl p-8 hover:shadow-lg transition text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition">
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-semibold text-slate-800 mb-2">
                  Parent Communication
                </h3>
                <p className="text-slate-600 mb-4">
                  Create progress reports and concern letters for parents
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-blue-600 group-hover:gap-3 transition-all">
                  Open
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/dashboard/community/forum')}
            className="bg-white border-2 border-slate-200 hover:border-green-300 rounded-xl p-8 hover:shadow-lg transition text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition">
                <MessageSquare className="w-8 h-8 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-semibold text-slate-800 mb-2">
                  Teacher Community
                </h3>
                <p className="text-slate-600 mb-4">
                  Share experiences and connect with fellow educators
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-green-600 group-hover:gap-3 transition-all">
                  Open Forum
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-8 border border-slate-200">
          <h3 className="text-xl font-semibold text-slate-800 mb-3">Community Guidelines</h3>
          <ul className="space-y-2 text-slate-600">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Respect privacy: Never share student names or identifying information</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Be supportive and constructive in all interactions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Share experiences and best practices to help the community grow</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>
                Use parent communication features to maintain professional contact with families
              </span>
            </li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
