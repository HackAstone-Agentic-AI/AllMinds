'use client';

import { useEffect, useState } from 'react';
import {
  Accessibility,
  CalendarDays,
  Check,
  CircleUserRound,
  Languages,
  Laptop,
  Moon,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Unplug,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { LanguageCode, LANGUAGES, languageOptionLabel } from '@/lib/i18n/translations';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import {
  TextScale,
  ThemePreference,
  usePreferences,
} from '@/lib/preferences/PreferencesContext';
import { TeacherProfile } from '@/types/database';

export type SettingsSection = 'profile' | 'appearance' | 'accessibility' | 'integrations';

interface SettingsPanelProps {
  profile: TeacherProfile;
  onClose: () => void;
  onUpdate: () => void;
  initialSection?: SettingsSection;
}

interface CalendarStatus {
  connected: boolean;
  gmail_email: string | null;
  connected_at?: string;
}

const sections: Array<{
  id: SettingsSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'profile', label: 'Profile', icon: CircleUserRound },
  { id: 'appearance', label: 'Appearance', icon: SlidersHorizontal },
  { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
  { id: 'integrations', label: 'Integrations', icon: CalendarDays },
];

const themes: Array<{
  id: ThemePreference;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'light', label: 'Light', description: 'Bright and clear', icon: Sun },
  { id: 'dark', label: 'Dark', description: 'Lower-light workspace', icon: Moon },
  { id: 'auto', label: 'System', description: 'Follow this device', icon: Laptop },
];

const textScales: Array<{ id: TextScale; label: string; sample: string }> = [
  { id: 'compact', label: 'Compact', sample: 'Aa' },
  { id: 'comfortable', label: 'Comfortable', sample: 'Aa' },
  { id: 'large', label: 'Large', sample: 'Aa' },
];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 flex-none rounded-full border transition ${
        checked ? 'border-[#087d8c] bg-[#087d8c]' : 'border-slate-300 bg-slate-200'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
          checked ? 'left-6' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export default function SettingsPanel({
  profile,
  onClose,
  onUpdate,
  initialSection = 'profile',
}: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [formData, setFormData] = useState({
    title: profile.title || '',
    name: profile.name || '',
    surname: profile.surname || '',
    language_pref: profile.language_pref || 'en',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const { setLanguage } = useLanguage();
  const {
    theme,
    textScale,
    highContrast,
    reducedMotion,
    readableFont,
    setTheme,
    setTextScale,
    setHighContrast,
    setReducedMotion,
    setReadableFont,
    resetPreferences,
  } = usePreferences();

  useEffect(() => {
    if (activeSection !== 'integrations' || calendarStatus) return;
    setCalendarLoading(true);
    api
      .getCalendarStatus()
      .then(setCalendarStatus)
      .catch(() => setCalendarStatus({ connected: false, gmail_email: null }))
      .finally(() => setCalendarLoading(false));
  }, [activeSection, calendarStatus]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage('');
    try {
      await api.updateProfile({
        title: formData.title,
        name: formData.name,
        surname: formData.surname,
        theme_preference: theme,
        language_pref: formData.language_pref,
      });
      localStorage.setItem('allminds_language', formData.language_pref);
      setLanguage(formData.language_pref as LanguageCode);
      setMessage('Profile and preferences saved.');
      onUpdate();
    } catch (error: any) {
      setMessage(error.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleConnectCalendar = async () => {
    setCalendarLoading(true);
    setMessage('');
    try {
      const { url } = await api.getCalendarConnectUrl();
      window.location.href = url;
    } catch (error: any) {
      setMessage(error.message || 'Could not start Google Calendar connection.');
      setCalendarLoading(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    setCalendarLoading(true);
    setMessage('');
    try {
      await api.disconnectCalendar();
      setCalendarStatus({ connected: false, gmail_email: null });
      setMessage('Google Calendar disconnected.');
    } catch (error: any) {
      setMessage(error.message || 'Could not disconnect Google Calendar.');
    } finally {
      setCalendarLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/45">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close settings"
      />

      <section
        className="app-theme-surface relative flex h-full w-full max-w-4xl flex-col bg-white shadow-xl"
        aria-label="Settings"
      >
        <header className="flex h-18 items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Settings</h2>
            <p className="text-sm text-slate-500">Make All Minds work the way you do.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close settings"
            title="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 p-3 sm:w-56 sm:flex-none sm:flex-col sm:border-b-0 sm:border-r sm:p-4">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  setActiveSection(section.id);
                  setMessage('');
                }}
                className={`flex min-w-max items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition sm:w-full ${
                  activeSection === section.id
                    ? 'bg-[#0b4f5c] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <section.icon className="h-4 w-4" />
                {section.label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            {activeSection === 'profile' && (
              <div className="max-w-2xl space-y-7">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Teacher profile</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Used for your workspace and generated teacher-facing documents.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr_1fr]">
                  <label className="text-sm font-medium text-slate-700">
                    Title
                    <select
                      value={formData.title}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, title: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
                    >
                      <option value="">None</option>
                      <option value="Mr.">Mr.</option>
                      <option value="Ms.">Ms.</option>
                      <option value="Mrs.">Mrs.</option>
                      <option value="Dr.">Dr.</option>
                      <option value="Prof.">Prof.</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    First name
                    <input
                      value={formData.name}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, name: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Surname
                    <input
                      value={formData.surname}
                      onChange={(event) =>
                        setFormData((current) => ({ ...current, surname: event.target.value }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
                    />
                  </label>
                </div>

                <label className="block text-sm font-medium text-slate-700">
                  Account email
                  <input
                    type="email"
                    value={profile.email || ''}
                    disabled
                    className="mt-1.5 w-full cursor-not-allowed rounded-lg border border-slate-300 bg-slate-50 px-3 py-3 text-slate-500"
                  />
                </label>

                <div className="border-t border-slate-200 pt-6">
                  <div className="flex items-center gap-2">
                    <Languages className="h-5 w-5 text-[#087d8c]" />
                    <h3 className="font-semibold text-slate-900">Language</h3>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Thandi uses this language for future responses.
                  </p>
                  <select
                    value={formData.language_pref}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        language_pref: event.target.value,
                      }))
                    }
                    className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
                  >
                    {LANGUAGES.map((language) => (
                      <option key={language.code} value={language.code}>
                        {languageOptionLabel(language.code, language.label)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {activeSection === 'appearance' && (
              <div className="max-w-2xl space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Workspace appearance</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Changes apply immediately across the dashboard.
                  </p>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium text-slate-700">Theme</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {themes.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTheme(option.id)}
                        className={`rounded-lg border-2 p-4 text-left transition ${
                          theme === option.id
                            ? 'border-[#087d8c] bg-teal-50'
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <option.icon className="h-5 w-5 text-[#087d8c]" />
                          {theme === option.id && <Check className="h-4 w-4 text-[#087d8c]" />}
                        </div>
                        <p className="mt-4 font-semibold text-slate-900">{option.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium text-slate-700">Text size</p>
                  <div className="grid grid-cols-3 gap-3">
                    {textScales.map((option, index) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTextScale(option.id)}
                        className={`rounded-lg border-2 px-3 py-4 text-center transition ${
                          textScale === option.id
                            ? 'border-[#087d8c] bg-teal-50'
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <span
                          className={`block font-semibold text-slate-900 ${
                            index === 0 ? 'text-sm' : index === 1 ? 'text-lg' : 'text-2xl'
                          }`}
                        >
                          {option.sample}
                        </span>
                        <span className="mt-2 block text-xs text-slate-500">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'accessibility' && (
              <div className="max-w-2xl space-y-7">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Accessibility</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Reduce visual effort and make repeated work more comfortable.
                  </p>
                </div>

                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                  {[
                    {
                      title: 'High contrast focus',
                      description: 'Stronger borders and keyboard focus indicators.',
                      checked: highContrast,
                      onChange: setHighContrast,
                    },
                    {
                      title: 'Reduce motion',
                      description: 'Minimise transitions and animated feedback.',
                      checked: reducedMotion,
                      onChange: setReducedMotion,
                    },
                    {
                      title: 'Readable font',
                      description: 'Use wider character shapes and more generous spacing.',
                      checked: readableFont,
                      onChange: setReadableFont,
                    },
                  ].map((preference) => (
                    <div
                      key={preference.title}
                      className="flex items-center justify-between gap-5 p-4"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{preference.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{preference.description}</p>
                      </div>
                      <Toggle
                        checked={preference.checked}
                        onChange={preference.onChange}
                        label={preference.title}
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={resetPreferences}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset display preferences
                </button>
              </div>
            )}

            {activeSection === 'integrations' && (
              <div className="max-w-2xl space-y-7">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Connected services</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Link services used for scheduling and classroom workflows.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 p-5">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <div className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-blue-50">
                        <CalendarDays className="h-5 w-5 text-blue-700" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-slate-900">Google Calendar</h4>
                          {calendarStatus?.connected && (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                              Connected
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          Send teacher tasks and learner routines to your calendar.
                        </p>
                        {calendarStatus?.gmail_email && (
                          <p className="mt-2 text-sm font-medium text-slate-700">
                            {calendarStatus.gmail_email}
                          </p>
                        )}
                      </div>
                    </div>

                    {calendarStatus?.connected ? (
                      <button
                        type="button"
                        onClick={handleDisconnectCalendar}
                        disabled={calendarLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                      >
                        <Unplug className="h-4 w-4" />
                        Disconnect
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectCalendar}
                        disabled={calendarLoading}
                        className="rounded-lg bg-[#0b4f5c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#083f49] disabled:opacity-50"
                      >
                        {calendarLoading ? 'Checking...' : 'Connect'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 rounded-lg border border-teal-200 bg-teal-50 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-[#087d8c]" />
                  <div>
                    <p className="font-medium text-slate-900">Per-user connection</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Calendar tokens are stored for the signed-in teacher. Connecting your
                      account does not give other teachers access to it.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {message && (
              <div
                className={`mt-7 rounded-lg px-4 py-3 text-sm ${
                  message.includes('could not') || message.includes('Failed')
                    ? 'bg-red-50 text-red-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {message}
              </div>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:px-7">
          <p className="hidden text-xs text-slate-500 sm:block">
            Display preferences save automatically on this device.
          </p>
          <div className="ml-auto flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={saving}
              className="rounded-lg bg-[#0b4f5c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#083f49] disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
