'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { TeacherProfile } from '@/types/database';
import {
  Home,
  Wrench,
  Users,
  GraduationCap,
  Settings,
  Bell,
  Globe,
  LogOut,
} from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import AgentChat from './AgentChat';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LANGUAGES } from '@/lib/i18n/translations';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
}

export default function DashboardLayout({ children, activeTab }: DashboardLayoutProps) {
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();

  const loadProfile = useCallback(async () => {
    const token = localStorage.getItem('allminds_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const data = await api.getProfile();
      setProfile(data);
    } catch (err) {
      console.error(err);
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleLogout = () => {
    localStorage.removeItem('allminds_token');
    localStorage.removeItem('allminds_user');
    router.push('/login');
  };

  const tabs = [
    { id: 'home', label: t('nav.home'), icon: Home, href: '/dashboard' },
    { id: 'tools', label: t('nav.tools'), icon: Wrench, href: '/dashboard/tools' },
    { id: 'community', label: t('nav.community'), icon: Users, href: '/dashboard/community' },
    {
      id: 'professional-development',
      label: t('nav.professionalDevelopment'),
      icon: GraduationCap,
      href: '/dashboard/professional-development',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 rounded-lg p-1 text-left transition hover:bg-slate-50"
                aria-label="Go to All Minds dashboard"
              >
                <Image
                  src="/allminds-logo.png"
                  alt=""
                  width={38}
                  height={38}
                  className="h-9 w-9 object-contain"
                  priority
                />
                <span className="text-xl font-bold text-slate-800">All Minds</span>
              </button>
              <nav className="hidden md:flex space-x-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => router.push(tab.href)}
                    className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {profile && (
                <div className="hidden sm:block text-sm text-slate-700 font-medium">
                  {profile.title} {profile.surname}
                </div>
              )}

              <div className="relative">
                <button
                  onClick={() => {
                    setShowLanguageMenu((current) => !current);
                    setShowNotifications(false);
                  }}
                  className="flex items-center gap-1 p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  <Globe className="w-5 h-5" />
                  <span className="hidden sm:inline text-xs font-medium">
                    {LANGUAGES.find((l) => l.code === language)?.label}
                  </span>
                </button>
                {showLanguageMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-2 max-h-80 overflow-y-auto">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setShowLanguageMenu(false);
                        }}
                        className={`w-full px-4 py-2 text-left hover:bg-slate-50 transition text-sm ${
                          language === lang.code ? 'font-semibold text-blue-600' : 'text-slate-700'
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifications((current) => !current);
                    setShowLanguageMenu(false);
                  }}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition relative"
                >
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-slate-200 py-2">
                    <div className="px-4 py-2 border-b border-slate-200">
                      <h3 className="font-semibold text-slate-800">{t('notifications.title')}</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <div className="px-4 py-3 hover:bg-slate-50 transition">
                        <p className="text-sm text-slate-600">{t('notifications.empty')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <Settings className="w-5 h-5" />
              </button>

              <button
                onClick={handleLogout}
                className="p-2 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="md:hidden bg-white border-b border-slate-200">
        <div className="grid grid-cols-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(tab.href)}
              className={`px-2 py-3 text-xs font-medium transition flex flex-col items-center gap-1 ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>

      {showSettings && profile && (
        <SettingsPanel
          profile={profile}
          onClose={() => setShowSettings(false)}
          onUpdate={loadProfile}
        />
      )}

      <AgentChat />
    </div>
  );
}
