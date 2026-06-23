'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Save,
  Sparkles,
  Trash2,
  Youtube,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface TeacherProfileSummary {
  id: number;
  surname: string;
  title: string;
}

interface YoutubeLink {
  label: string;
  url: string;
}

interface ImageAid {
  label: string;
  url: string; // data URI from Gemini image generation
}

function AssessmentPlannerInner() {
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfileSummary | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [plannerInput, setPlannerInput] = useState({
    subject: '',
    topic: '',
    grade: '',
    supportNeed: '',
    difficulty: '',
    materialType: 'lesson_plan',
  });
  const [generatedPlan, setGeneratedPlan] = useState('');
  const [youtubeLinks, setYoutubeLinks] = useState<YoutubeLink[]>([]);
  const [imageAids, setImageAids] = useState<ImageAid[]>([]);
  const [planTitle, setPlanTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [savedPlanId, setSavedPlanId] = useState<number | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  const { t } = useLanguage();

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

  const loadSavedPlan = useCallback(async (planId: number) => {
    try {
      const plan = await api.getLessonPlan(planId);
      setGeneratedPlan(typeof plan.content === 'string' ? plan.content : JSON.stringify(plan.content));
      setPlanTitle(plan.title);
      setSavedPlanId(plan.id);
    } catch {
      setError('Could not load the saved plan.');
    }
  }, []);

  useEffect(() => {
    void loadTeacherProfile();
  }, [loadTeacherProfile]);

  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      const planId = Number(idParam);
      if (Number.isInteger(planId) && planId > 0) void loadSavedPlan(planId);
    }
  }, [searchParams, loadSavedPlan]);

  const generatePlan = async () => {
    if (!plannerInput.subject || !plannerInput.topic || !plannerInput.grade) return;

    setIsGenerating(true);
    setError('');
    setSaveSuccess(false);
    setSavedPlanId(null);
    setYoutubeLinks([]);
    setImageAids([]);

    try {
      const materialLabels: Record<string, string> = {
        lesson_plan: 'Lesson Plan',
        worksheet: 'Worksheet',
        test: 'Test',
        homework: 'Homework',
      };
      const materialLabel = materialLabels[plannerInput.materialType] ?? 'Plan';
      const supportContext = plannerInput.supportNeed
        ? `Specific support need to address: ${plannerInput.supportNeed}.`
        : '';
      const difficultyContext = plannerInput.difficulty
        ? `Difficulty level: ${plannerInput.difficulty}.`
        : '';

      const response = await api.chatWithAgent(
        `Create a complete ${materialLabel}. Grade: ${plannerInput.grade}. Subject: ${plannerInput.subject}. Topic: ${plannerInput.topic}. ${supportContext} ${difficultyContext} Produce every section in full — do not truncate.`,
        {
          thread_id: `assessment-planner-${teacherProfile?.id ?? 'guest'}`,
          tool_hint: 'lesson',
          grade: plannerInput.grade,
          subject: plannerInput.subject,
          topic: plannerInput.topic,
          support_need: plannerInput.supportNeed || undefined,
          difficulty: plannerInput.difficulty || undefined,
          material_type: plannerInput.materialType,
        },
      );

      setPlanTitle(`${materialLabel} – Grade ${plannerInput.grade} ${plannerInput.subject} – ${plannerInput.topic}`);

      setGeneratedPlan(response.response || 'No plan was returned.');
      setYoutubeLinks(Array.isArray(response.youtube_links) ? response.youtube_links : []);
      setImageAids(Array.isArray(response.image_aids) ? response.image_aids : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to generate the plan.');
    } finally {
      setIsGenerating(false);
    }
  };

  const savePlan = async () => {
    if (!generatedPlan || !planTitle.trim()) return;
    setIsSaving(true);
    setError('');
    setSaveSuccess(false);
    try {
      const saved = await api.createLessonPlan(planTitle.trim(), generatedPlan);
      setSavedPlanId(saved.id);
      setSaveSuccess(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to save the plan.');
    } finally {
      setIsSaving(false);
    }
  };

  const deletePlan = async () => {
    if (!savedPlanId) return;
    setIsDeleting(true);
    setError('');
    try {
      await api.deleteLessonPlan(savedPlanId);
      setSavedPlanId(null);
      setSaveSuccess(false);
      setGeneratedPlan('');
      setPlanTitle('');
      setYoutubeLinks([]);
      setImageAids([]);
      router.push('/dashboard/tools/assessment-planner');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to delete the plan.');
    } finally {
      setIsDeleting(false);
    }
  };

  const exportToPDF = async () => {
    if (!generatedPlan) return;
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const margin = 18;
      const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
      let y = margin;

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      const titleLines = doc.splitTextToSize(planTitle || 'Assessment & Pedagogical Plan', pageWidth);
      doc.text(titleLines, margin, y);
      y += titleLines.length * 8 + 4;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated by All Minds  |  ${new Date().toLocaleDateString('en-ZA')}`, margin, y);
      y += 8;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y);
      y += 6;

      doc.setTextColor(40, 40, 40);
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(generatedPlan, pageWidth);
      for (const line of lines) {
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        const isHeader =
          /^[A-Z\s]{4,}$/.test(line.trim()) || /^TIER \d/.test(line.trim());
        doc.setFont('helvetica', isHeader && line.trim().length > 0 ? 'bold' : 'normal');
        doc.setTextColor(
          isHeader && line.trim().length > 0 ? 11 : 40,
          isHeader && line.trim().length > 0 ? 79 : 40,
          isHeader && line.trim().length > 0 ? 92 : 40,
        );
        doc.text(line, margin, y);
        y += 5.5;
      }

      // YouTube links appendix
      if (youtubeLinks.length > 0) {
        doc.addPage();
        y = margin;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(11, 79, 92);
        doc.text('VIDEO RESOURCES', margin, y);
        y += 8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        for (const link of youtubeLinks) {
          if (y > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
          doc.setTextColor(40, 40, 40);
          doc.text(`• ${link.label}`, margin, y);
          y += 5;
          doc.setTextColor(0, 0, 180);
          doc.textWithLink(link.url, margin + 4, y, { url: link.url });
          y += 8;
        }
      }

      // Visual aids appendix
      for (const img of imageAids) {
        doc.addPage();
        y = margin;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(11, 79, 92);
        doc.text('VISUAL AID', margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.text(img.label, margin, y);
        y += 6;
        const fmt = img.url.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        try {
          doc.addImage(img.url, fmt, margin, y, 174, 120);
        } catch {
          doc.text('[Image could not be embedded]', margin, y);
        }
      }

      doc.save(`${(planTitle || 'assessment-plan').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`);
    } catch {
      setError('PDF export failed. Please try again.');
    }
  };

  const exportToWord = () => {
    if (!generatedPlan) return;

    const escaped = generatedPlan
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const styledContent = escaped
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        const isHeader =
          /^[A-Z][A-Z\s\/\(\)–-]{3,}$/.test(trimmed) || /^TIER \d/.test(trimmed);
        if (isHeader && trimmed.length > 0) {
          return `<p style="font-weight:bold;color:#0b4f5c;margin-top:12pt;margin-bottom:4pt;font-size:11pt;">${line}</p>`;
        }
        if (trimmed === '') return '<br/>';
        return `<p style="margin:2pt 0;font-size:10.5pt;">${line}</p>`;
      })
      .join('');

    const ytSection =
      youtubeLinks.length > 0
        ? `<h2 style="color:#0b4f5c;">Video Resources</h2>` +
          youtubeLinks.map((l) => `<p><a href="${l.url}">${l.label}</a></p>`).join('')
        : '';

    const imgSection =
      imageAids.length > 0
        ? `<h2 style="color:#0b4f5c;">Visual Aids</h2>` +
          imageAids
            .map((img) => `<p><strong>${img.label}</strong></p><img src="${img.url}" style="max-width:100%;margin:8pt 0;" />`)
            .join('')
        : '';

    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office'
            xmlns:w='urn:schemas-microsoft-com:office:word'
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${planTitle || 'Assessment Plan'}</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; margin: 2cm; }
          h1 { color: #0b4f5c; font-size: 18pt; }
          .meta { color: #888; font-size: 9pt; border-bottom: 1px solid #ccc; padding-bottom: 6pt; margin-bottom: 12pt; }
        </style>
      </head>
      <body>
        <h1>${planTitle || 'Assessment &amp; Pedagogical Plan'}</h1>
        <p class="meta">Generated by All Minds &nbsp;|&nbsp; ${new Date().toLocaleDateString('en-ZA')}</p>
        ${styledContent}
        ${ytSection}
        ${imgSection}
      </body>
      </html>`;

    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(planTitle || 'assessment-plan').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const planSections = generatedPlan
    ? generatedPlan.split('\n').map((line, index) => {
        const trimmed = line.trim();
        const isHeader =
          /^[A-Z][A-Z\s\/\(\)–-]{3,}$/.test(trimmed) || /^TIER \d/.test(trimmed);
        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('□') || trimmed.startsWith('-');
        if (isHeader && trimmed.length > 0) {
          return (
            <p key={index} className="mt-5 mb-1 text-sm font-bold text-[#0b4f5c] uppercase tracking-wide">
              {trimmed}
            </p>
          );
        }
        if (isBullet) {
          return (
            <p key={index} className="ml-4 text-sm leading-6 text-slate-700">
              {trimmed}
            </p>
          );
        }
        if (trimmed === '') return <div key={index} className="h-1" />;
        return (
          <p key={index} className="text-sm leading-6 text-slate-700">
            {trimmed}
          </p>
        );
      })
    : null;

  return (
    <DashboardLayout activeTab="tools">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/tools')}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-slate-800">
              {t('planner.title')}
            </h2>
            <p className="text-slate-600 mt-1">
              {t('planner.subtitle')}
            </p>
          </div>
        </div>

        {/* Profile banner */}
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

        {saveSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800">
                Plan saved. It will appear in <strong>Lesson Plans</strong> on your dashboard.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Left: builder form ── */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-green-600" />
                <h3 className="text-xl font-semibold text-slate-800">Assessment Builder</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{t('planner.materialType')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'lesson_plan', label: t('planner.lessonPlan') },
                      { value: 'worksheet', label: t('planner.worksheet') },
                      { value: 'test', label: t('planner.test') },
                      { value: 'homework', label: t('planner.homework') },
                    ].map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setPlannerInput((c) => ({ ...c, materialType: type.value }))}
                        className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition ${
                          plannerInput.materialType === type.value
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{t('planner.subject')}</label>
                  <input
                    type="text"
                    value={plannerInput.subject}
                    onChange={(e) => setPlannerInput((c) => ({ ...c, subject: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                    placeholder="e.g. Mathematics"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{t('planner.topic')}</label>
                  <input
                    type="text"
                    value={plannerInput.topic}
                    onChange={(e) => setPlannerInput((c) => ({ ...c, topic: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                    placeholder="e.g. Fractions and equivalence"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{t('planner.grade')}</label>
                  <input
                    type="text"
                    value={plannerInput.grade}
                    onChange={(e) => setPlannerInput((c) => ({ ...c, grade: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                    placeholder="e.g. 5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{t('planner.difficulty')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'Foundation', label: t('planner.foundation') },
                      { value: 'Intermediate', label: t('planner.intermediate') },
                      { value: 'Advanced', label: t('planner.advanced') },
                    ].map(({ value: d, label: dLabel }) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setPlannerInput((c) => ({ ...c, difficulty: c.difficulty === d ? '' : d }))}
                        className={`py-2 px-2 rounded-lg border text-xs font-medium transition ${
                          plannerInput.difficulty === d
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {dLabel}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Specific Support Need
                  </label>
                  <input
                    type="text"
                    value={plannerInput.supportNeed}
                    onChange={(e) => setPlannerInput((c) => ({ ...c, supportNeed: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                    placeholder="e.g. visual scaffolds, reduced writing load"
                  />
                </div>

                <button
                  onClick={() => void generatePlan()}
                  disabled={
                    isGenerating ||
                    loadingProfile ||
                    !plannerInput.subject ||
                    !plannerInput.topic ||
                    !plannerInput.grade
                  }
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  {isGenerating
                    ? 'Generating…'
                    : `Generate ${
                        { lesson_plan: 'Lesson Plan', worksheet: 'Worksheet', test: 'Test', homework: 'Homework' }[plannerInput.materialType] ?? 'Plan'
                      }`
                  }
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
              <h3 className="font-semibold text-blue-900 mb-2">Planning Reminders</h3>
              <ul className="space-y-1.5 text-sm text-blue-800">
                <li>Use more than one response method where possible.</li>
                <li>Keep success criteria visible throughout the task.</li>
                <li>Plan one clear extension and one support pathway.</li>
              </ul>
            </div>
          </div>

          {/* ── Right: output ── */}
          <div className="space-y-4">
            {/* Generating indicator */}
            {isGenerating && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <p className="text-sm text-purple-800">
                    Generating lesson plan, YouTube links, and AI visual aid images…
                  </p>
                </div>
              </div>
            )}

            {/* Plan text */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 min-h-[360px] flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  <h3 className="text-xl font-semibold text-slate-800">Generated Plan</h3>
                </div>
                {generatedPlan && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void exportToPDF()}
                      title="Export as PDF"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>
                    <button
                      onClick={exportToWord}
                      title="Export as Word document"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Word
                    </button>
                  </div>
                )}
              </div>

              {generatedPlan ? (
                <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">{planSections}</div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                  <FileText className="w-14 h-14 mx-auto mb-4 text-slate-300" />
                  <p className="font-medium">No plan generated yet</p>
                  <p className="text-sm mt-2 text-center">
                    Complete the form to build a full inclusive assessment plan
                  </p>
                </div>
              )}
            </div>

            {/* Save controls */}
            {generatedPlan && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">Save to Lesson Plans</h4>
                <input
                  type="text"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                  placeholder="Plan title"
                  maxLength={255}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => void savePlan()}
                    disabled={isSaving || !planTitle.trim() || !!savedPlanId}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#0b4f5c] hover:bg-[#083f49] text-white text-sm font-medium py-2.5 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving…' : savedPlanId ? 'Saved' : 'Save Plan'}
                  </button>
                  {savedPlanId && (
                    <button
                      onClick={() => void deletePlan()}
                      disabled={isDeleting}
                      className="flex items-center justify-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium py-2.5 px-4 rounded-lg transition disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* YouTube links */}
            {youtubeLinks.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Youtube className="w-5 h-5 text-red-500" />
                  <h4 className="text-sm font-semibold text-slate-800">Video Resources</h4>
                </div>
                <div className="space-y-2">
                  {youtubeLinks.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-100 hover:bg-red-50 hover:border-red-200 transition group"
                    >
                      <ExternalLink className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5 group-hover:text-red-600" />
                      <span className="text-xs text-slate-700 group-hover:text-red-700 leading-5">
                        {link.label}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* AI Visual Aids */}
            {imageAids.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon className="w-5 h-5 text-purple-500" />
                  <h4 className="text-sm font-semibold text-slate-800">AI Visual Aids</h4>
                  <span className="ml-auto text-xs text-slate-400">
                    Gemini · print or display in class
                  </span>
                </div>
                <div className="space-y-5">
                  {imageAids.map((img, i) => (
                    <div key={i} className="space-y-2">
                      <p className="text-xs font-medium text-slate-600">{img.label}</p>
                      <img
                        src={img.url}
                        alt={img.label}
                        className="w-full rounded-lg border border-slate-200 object-contain max-h-72 bg-slate-50"
                      />
                      <a
                        href={img.url}
                        download={`${img.label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`}
                        className="inline-flex items-center gap-1.5 text-xs text-[#0b4f5c] hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download image
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function AssessmentPlannerPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout activeTab="tools">
          <div className="flex items-center justify-center min-h-64 text-slate-500 text-sm">
            Loading planner…
          </div>
        </DashboardLayout>
      }
    >
      <AssessmentPlannerInner />
    </Suspense>
  );
}
