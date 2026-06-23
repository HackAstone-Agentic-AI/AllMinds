'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { AlertCircle, ArrowLeft, Download, ExternalLink, Eye, Image as ImageIcon, Info, MessageSquare, Send, Sparkles, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface TeacherProfileSummary {
  id: number;
  surname: string;
  title: string;
}

interface YoutubeLink {
  label: string;
  url: string;
  thumbnail?: string;
}

interface ImageAid {
  label: string;
  url: string;
}

interface ChatMessage {
  id: number;
  role: 'assistant' | 'user';
  content: string;
  youtubeLinks?: YoutubeLink[];
  imageAids?: ImageAid[];
  mediaDiagnostics?: string[];
}

const starterPrompts = [
  'Create a visual timetable for a learner who benefits from structured transitions.',
  'Suggest calming visual supports for a noisy classroom environment.',
  'Generate a step-by-step classroom routine with icons for morning activities.',
];

export default function VisualSupportPage() {
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfileSummary | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const nextId = useRef(2);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: 'assistant',
      content:
        'Describe the learner need or classroom challenge, and I will help you plan a visual support.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const loadTeacherProfile = useCallback(async () => {
    const token = localStorage.getItem('allminds_token');
    if (!token) {
      router.push('/login');
      setLoadingProfile(false);
      return;
    }

    try {
      const data = await api.getProfile();
      setTeacherProfile({ id: data.id, surname: data.surname, title: data.title });
    } catch {
      router.push('/login');
    } finally {
      setLoadingProfile(false);
    }
  }, [router]);

  useEffect(() => {
    void loadTeacherProfile();
  }, [loadTeacherProfile]);

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      id: nextId.current++,
      role: 'user',
      content: trimmed,
    };
    setMessages((current) => [...current, userMessage]);
    setInput('');

    setIsSending(true);
    setError('');

    try {
      const response = await api.chatWithAgent(trimmed, {
        thread_id: `visual-support-${teacherProfile?.id || 'guest'}`,
        tool_hint: 'visual',
      });

      const assistantMessage: ChatMessage = {
        id: nextId.current++,
        role: 'assistant',
        content: response.response || 'No response was returned.',
        youtubeLinks: Array.isArray(response.youtube_links) ? response.youtube_links : [],
        imageAids: Array.isArray(response.image_aids) ? response.image_aids : [],
        mediaDiagnostics: Array.isArray(response.media_diagnostics) ? response.media_diagnostics : [],
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Failed to contact the assistant.',
      );
    } finally {
      setIsSending(false);
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
            <h2 className="text-3xl font-bold text-slate-800">Visual Support</h2>
            <p className="text-slate-600 mt-1">
              Build simple visual supports for neurodiverse learners
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Eye className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Teacher Profile Loaded</h3>
              {loadingProfile ? (
                <p className="text-sm text-blue-800">Loading your profile...</p>
              ) : teacherProfile ? (
                <p className="text-sm text-blue-800">
                  Working as {teacherProfile.title} {teacherProfile.surname}.
                </p>
              ) : (
                <p className="text-sm text-blue-800">Redirecting to login...</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <h3 className="text-xl font-semibold text-slate-800">Planning Assistant</h3>
            </div>

            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xl rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2 text-xs font-medium opacity-80">
                      {message.role === 'user' ? (
                        <>
                          <User className="w-3.5 h-3.5" />
                          You
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          All Minds Assistant
                        </>
                      )}
                    </div>
                    <p className="text-sm leading-6">{message.content}</p>
                    {message.youtubeLinks && message.youtubeLinks.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Video Resources</p>
                        {message.youtubeLinks.map((link) => (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-blue-700 hover:text-blue-900 hover:underline"
                          >
                            {link.thumbnail ? (
                              <img
                                src={link.thumbnail}
                                alt=""
                                className="w-12 h-9 object-cover rounded flex-shrink-0 border border-slate-200"
                              />
                            ) : (
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            )}
                            <span className="line-clamp-2">{link.label}</span>
                          </a>
                        ))}
                      </div>
                    )}
                    {message.imageAids && message.imageAids.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> AI Visual Aids
                        </p>
                        {message.imageAids.map((img) => (
                          <div key={img.label} className="space-y-1">
                            <p className="text-xs text-slate-600 font-medium">{img.label}</p>
                            <img
                              src={img.url}
                              alt={img.label}
                              className="w-full rounded-lg border border-slate-200 object-contain max-h-52 bg-slate-50"
                            />
                            <a
                              href={img.url}
                              download={`${img.label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              <Download className="w-3 h-3" /> Download
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                    {message.mediaDiagnostics && message.mediaDiagnostics.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
                        {message.mediaDiagnostics.map((msg) => (
                          <p key={msg} className="flex items-start gap-1.5 text-xs text-amber-700">
                            <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span>{msg}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <input
                type="text"
                value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !isSending && !loadingProfile) {
                      void sendMessage(input);
                    }
                  }}
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="Describe a learner need, routine, or classroom challenge"
                  disabled={loadingProfile}
                />
              <button
                onClick={() => void sendMessage(input)}
                disabled={isSending || !input.trim() || loadingProfile}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            {isSending && <p className="mt-3 text-sm text-slate-500">Generating support...</p>}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Starter Prompts</h3>
              <div className="space-y-3">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void sendMessage(prompt)}
                    disabled={loadingProfile}
                    className="w-full text-left p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <p className="text-sm text-slate-700">{prompt}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <h3 className="font-semibold text-amber-900 mb-2">Visual Support Tips</h3>
              <ul className="space-y-2 text-sm text-amber-800">
                <li>Use one consistent icon style across a routine.</li>
                <li>Limit each visual board to the most essential steps.</li>
                <li>Place supports where the learner needs to act on them.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
