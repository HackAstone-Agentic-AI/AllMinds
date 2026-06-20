'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { TeacherProfile } from '@/types/database';
import { X } from 'lucide-react';

interface SettingsPanelProps {
  profile: TeacherProfile;
  onClose: () => void;
  onUpdate: () => void;
}

export default function SettingsPanel({ profile, onClose, onUpdate }: SettingsPanelProps) {
  const SA_LANGUAGES = [
    { code: 'en',  english_name: 'English',       native_name: 'English' },
    { code: 'zu',  english_name: 'Zulu',           native_name: 'isiZulu' },
    { code: 'xh',  english_name: 'Xhosa',          native_name: 'isiXhosa' },
    { code: 'af',  english_name: 'Afrikaans',       native_name: 'Afrikaans' },
    { code: 'nso', english_name: 'Sepedi',          native_name: 'Sepedi' },
    { code: 'tn',  english_name: 'Setswana',        native_name: 'Setswana' },
    { code: 'st',  english_name: 'Sesotho',         native_name: 'Sesotho' },
    { code: 'ts',  english_name: 'Xitsonga',        native_name: 'Xitsonga' },
    { code: 'ss',  english_name: 'siSwati',         native_name: 'siSwati' },
    { code: 've',  english_name: 'Tshivenda',       native_name: 'Tshivenda' },
    { code: 'nr',  english_name: 'isiNdebele',      native_name: 'isiNdebele' },
  ];

  const [formData, setFormData] = useState({
    title: profile.title,
    name: profile.name,
    surname: profile.surname,
    theme_preference: profile.theme_preference,
    language_pref: profile.language_pref || 'en',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await api.updateProfile({
        title: formData.title,
        name: formData.name,
        surname: formData.surname,
        theme_preference: formData.theme_preference,
        language_pref: formData.language_pref,
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('allminds_language', formData.language_pref);
      }
      setMessage('Settings saved successfully');
      onUpdate();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setMessage(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Profile Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
                <select
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                >
                  <option value="Mr.">Mr.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Prof.">Prof.</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Surname</label>
                  <input
                    type="text"
                    value={formData.surname}
                    onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Appearance</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Theme</label>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => setFormData({ ...formData, theme_preference: 'light' })}
                  className={`p-4 border-2 rounded-lg transition ${
                    formData.theme_preference === 'light'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <div className="w-full h-12 bg-white rounded border border-slate-300 mb-2"></div>
                  <p className="text-sm font-medium text-slate-700">Light</p>
                </button>
                <button
                  onClick={() => setFormData({ ...formData, theme_preference: 'dark' })}
                  className={`p-4 border-2 rounded-lg transition ${
                    formData.theme_preference === 'dark'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <div className="w-full h-12 bg-slate-800 rounded border border-slate-600 mb-2"></div>
                  <p className="text-sm font-medium text-slate-700">Dark</p>
                </button>
                <button
                  onClick={() => setFormData({ ...formData, theme_preference: 'auto' })}
                  className={`p-4 border-2 rounded-lg transition ${
                    formData.theme_preference === 'auto'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <div className="w-full h-12 bg-gradient-to-r from-white to-slate-800 rounded border border-slate-300 mb-2"></div>
                  <p className="text-sm font-medium text-slate-700">Auto</p>
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Language / Taal / Ulimi</h3>
            <p className="text-sm text-slate-500 mb-3">
              Choose the language Thandi responds in. All 11 official South African languages are supported.
            </p>
            <select
              value={formData.language_pref}
              onChange={(e) => setFormData({ ...formData, language_pref: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            >
              {SA_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.native_name} — {lang.english_name}
                </option>
              ))}
            </select>
          </div>

          {message && (
            <div
              className={`p-4 rounded-lg ${
                message.includes('success')
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {message}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}