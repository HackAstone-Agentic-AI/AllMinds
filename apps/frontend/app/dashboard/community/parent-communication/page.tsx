'use client';

import { useState, useEffect, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import DashboardLayout from '@/components/DashboardLayout';
import { LearnerProfile, ParentCommunication } from '@/types/database';
import { ArrowLeft, Mail, Download, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function ParentCommunicationPage() {
  const [learners, setLearners] = useState<LearnerProfile[]>([]);
  const [communications, setCommunications] = useState<ParentCommunication[]>([]);
  const [selectedLearner, setSelectedLearner] = useState<string>('');
  const [letterType, setLetterType] = useState<'progress' | 'concern'>('progress');
  const [content, setContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      const [learnersData, commsData] = await Promise.all([
        api.getLearners(),
        api.getParentCommunications(),
      ]);
      setLearners(learnersData);
      setCommunications(commsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const draftWithAI = async () => {
    if (!selectedLearner) return;

    const learner = learners.find((l) => String(l.id) === selectedLearner);
    const rawId = learner?.anonymous_id ?? `Learner ${selectedLearner}`;
    const learnerLabel = rawId.replace(/[^a-zA-Z0-9 \-_]/g, '').trim().slice(0, 40) || `Learner ${selectedLearner}`;
    const typeLabel = letterType === 'progress' ? 'progress report' : 'concern letter';

    setDrafting(true);
    setMessage('');

    try {
      const existingNotes = content.trim();
      const notesContext = existingNotes
        ? ` Incorporate these notes from the teacher: ${existingNotes}`
        : '';
      const result = await api.chatWithAgent(
        `Draft a professional, empathetic parent ${typeLabel} for a neurodivergent learner (${learnerLabel}).${notesContext}`,
        {
          thread_id: `parent-comm-${selectedLearner}-${letterType}`,
          tool_hint: 'parent',
          communication_type: letterType,
          learner_name: learnerLabel,
          language_pref:
            (typeof window !== 'undefined' && localStorage.getItem('allminds_language')) || 'en',
        },
      );
      const draft: string = result?.response ?? '';
      if (draft) {
        setContent(draft);
      } else {
        setMessage('No draft was returned. Please try again.');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to draft letter.');
    } finally {
      setDrafting(false);
    }
  };

  const generateLetter = async () => {
    if (!selectedLearner || !content.trim()) return;

    setGenerating(true);
    setMessage('');

    try {
      await api.createParentCommunication({
        learner_id: parseInt(selectedLearner, 10),
        type: letterType,
        content,
      });
      setContent('');
      setSelectedLearner('');
      await loadData();
      setMessage('Letter created successfully.');
    } catch (err) {
      console.error('Failed to generate letter:', err);
      setMessage('We could not create that letter. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const buildLetterMarkup = (comm: ParentCommunication) => {
    const learnerId = comm.learner_anonymous_id || `Learner ${comm.learner_id}`;
    return `
      <html>
        <head>
          <title>${comm.type === 'progress' ? 'Progress Report' : 'Concern Letter'}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 32px; line-height: 1.6; }
            h1 { margin-bottom: 8px; }
            .meta { color: #475569; margin-bottom: 24px; }
          </style>
        </head>
        <body>
          <h1>${comm.type === 'progress' ? 'Progress Report' : 'Concern Letter'}</h1>
          <div class="meta">
            <div><strong>Learner:</strong> ${learnerId}</div>
            <div><strong>Date:</strong> ${new Date(comm.created_at).toLocaleDateString()}</div>
          </div>
          <div>${comm.content.replace(/\n/g, '<br />')}</div>
        </body>
      </html>
    `;
  };

  const downloadLetter = (comm: ParentCommunication, format: 'doc' | 'txt') => {
    const learnerId = comm.learner_anonymous_id || `learner_${comm.learner_id}`;
    const blob =
      format === 'doc'
        ? new Blob([buildLetterMarkup(comm)], { type: 'application/msword' })
        : new Blob([comm.content], { type: 'text/plain' });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `letter_${comm.type}_${learnerId}_${new Date(comm.created_at).toISOString().split('T')[0]}.${format}`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadPdfLetter = (comm: ParentCommunication) => {
    const learnerId = comm.learner_anonymous_id || `Learner ${comm.learner_id}`;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 48;
    const contentWidth = pageWidth - margin * 2;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text(comm.type === 'progress' ? 'Progress Report' : 'Concern Letter', margin, 64);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.text(`Learner: ${learnerId}`, margin, 92);
    pdf.text(`Date: ${new Date(comm.created_at).toLocaleDateString()}`, margin, 110);

    const contentLines = pdf.splitTextToSize(comm.content, contentWidth);
    let cursorY = 148;

    contentLines.forEach((line: string) => {
      if (cursorY > pageHeight - margin) {
        pdf.addPage();
        cursorY = margin;
      }
      pdf.text(line, margin, cursorY);
      cursorY += 18;
    });

    const safeLearnerId = learnerId.replace(/[^a-z0-9_-]+/gi, '_');
    pdf.save(
      `letter_${comm.type}_${safeLearnerId}_${new Date(comm.created_at).toISOString().split('T')[0]}.pdf`,
    );
  };

  return (
    <DashboardLayout activeTab="community">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/community')}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-slate-800">Parent Communication</h2>
            <p className="text-slate-600 mt-1">Create letters for learner progress and concerns</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Create New Letter
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Learner
                </label>
                <select
                  value={selectedLearner}
                  onChange={(e) => setSelectedLearner(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                >
                  <option value="">Choose a learner</option>
                  {learners.map((learner) => (
                    <option key={learner.id} value={learner.id}>
                      {learner.anonymous_id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Letter Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setLetterType('progress')}
                    className={`px-4 py-3 border-2 rounded-lg font-medium transition ${
                      letterType === 'progress'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-300 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    Progress Report
                  </button>
                  <button
                    onClick={() => setLetterType('concern')}
                    className={`px-4 py-3 border-2 rounded-lg font-medium transition ${
                      letterType === 'concern'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-slate-300 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    Concern Letter
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Letter Content
                  </label>
                  <button
                    onClick={() => void draftWithAI()}
                    disabled={drafting || !selectedLearner}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {drafting ? 'Drafting…' : 'Draft with AI'}
                  </button>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  rows={8}
                  placeholder={
                    letterType === 'progress'
                      ? "Describe the learner's progress, achievements, and areas of growth..."
                      : 'Describe the concern and suggest ways to work together...'
                  }
                />
              </div>

              <button
                onClick={generateLetter}
                disabled={generating || !selectedLearner || !content.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating...' : 'Generate Letter'}
              </button>

              {message && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {message}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-xl font-semibold text-slate-800 mb-4">
              Recent Letters ({communications.length})
            </h3>

            {communications.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No letters created yet</p>
                <p className="text-sm mt-2">Generate your first parent communication letter</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {communications.map((comm) => (
                  <div
                    key={comm.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-slate-800">
                          {comm.learner_anonymous_id || 'Unknown Learner'}
                        </h4>
                        <span
                          className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${
                            comm.type === 'progress'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {comm.type === 'progress' ? 'Progress Report' : 'Concern Letter'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(comm.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 mb-3 line-clamp-3">{comm.content}</p>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => downloadPdfLetter(comm)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded text-xs font-medium transition flex items-center justify-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        PDF
                      </button>
                      <button
                        onClick={() => downloadLetter(comm, 'doc')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded text-xs font-medium transition flex items-center justify-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        Word
                      </button>
                      <button
                        onClick={() => downloadLetter(comm, 'txt')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded text-xs font-medium transition flex items-center justify-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        Text
                      </button>
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
