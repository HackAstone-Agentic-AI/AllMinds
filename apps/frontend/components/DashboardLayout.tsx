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
  BarChart3,
  Settings,
  Bell,
  Globe,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import SettingsPanel, { SettingsSection } from './SettingsPanel';
import AgentChat from './AgentChat';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LANGUAGES } from '@/lib/i18n/translations';
import { ThemePreference, usePreferences } from '@/lib/preferences/PreferencesContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
}

export default function DashboardLayout({ children, activeTab }: DashboardLayoutProps) {
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('profile');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const { setTheme } = usePreferences();

  const loadProfile = useCallback(async () => {
    const token = localStorage.getItem('allminds_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const data = await api.getProfile();
      setProfile(data);
      if (['light', 'dark', 'auto'].includes(data.theme_preference)) {
        setTheme(data.theme_preference as ThemePreference);
      }
    } catch (err) {
      console.error(err);
      router.push('/login');
    }
  }, [router, setTheme]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const handleSessionExpired = () => router.replace('/login?error=session_expired');
    window.addEventListener('allminds:session-expired', handleSessionExpired);
    return () => window.removeEventListener('allminds:session-expired', handleSessionExpired);
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Restore the desktop collapse preference on mount.
  useEffect(() => {
    if (localStorage.getItem('allminds_sidebar_collapsed') === 'true') {
      setDesktopCollapsed(true);
    }
  }, []);

  // One hamburger drives both behaviours: a slide-in drawer on mobile,
  // a persistent collapse on desktop (≥ md).
  const toggleSidebar = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      setDesktopCollapsed((collapsed) => {
        const next = !collapsed;
        localStorage.setItem('allminds_sidebar_collapsed', String(next));
        return next;
      });
    } else {
      setSidebarOpen((open) => !open);
    }
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [router]);

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get('settings');
    if (
      section === 'profile' ||
      section === 'appearance' ||
      section === 'accessibility' ||
      section === 'integrations'
    ) {
      setSettingsSection(section);
      setShowSettings(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('allminds_token');
    localStorage.removeItem('allminds_user');
    router.push('/login');
  };

  const tabs = [
    { id: 'home', label: t('nav.home'), icon: Home, href: '/dashboard' },
    { id: 'tools', label: t('nav.tools'), icon: Wrench, href: '/dashboard/tools' },
    { id: 'learner-analytics', label: t('nav.learnerAnalytics'), icon: BarChart3, href: '/dashboard/learnerAnalytics' },
    { id: 'community', label: t('nav.community'), icon: Users, href: '/dashboard/community' },
    {
      id: 'professional-development',
      label: t('nav.professionalDevelopment'),
      icon: GraduationCap,
      href: '/dashboard/professional-development',
    },
  ];

  return (
    <div
      className={`app-theme-surface min-h-screen bg-slate-50 transition-[padding] duration-300 ease-in-out ${
        desktopCollapsed ? 'md:pl-0' : 'md:pl-64'
      }`}
    >
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="main-sidebar"
        aria-label="Sidebar navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${desktopCollapsed ? 'md:-translate-x-full' : 'md:translate-x-0'}`}
      >
        <button
          onClick={() => router.push('/dashboard')}
          className="flex h-20 items-center gap-3 border-b border-slate-200 px-5 text-left transition hover:bg-slate-50"
          aria-label="Go to All Minds dashboard"
        >
          <Image
            src="/allminds-logo.png"
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 object-contain"
            priority
          />
          <div>
            <p className="text-xl font-bold text-slate-900">All Minds</p>
            <p className="text-xs text-slate-500">Teacher workspace</p>
          </div>
        </button>

        <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Dashboard navigation">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(tab.href)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-[#0b4f5c] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <tab.icon className="h-5 w-5 flex-none" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          {profile && (
            <div className="mb-2 px-3 py-2">
              <p className="truncate text-sm font-semibold text-slate-800">
                {profile.title} {profile.name} {profile.surname}
              </p>
              <p className="truncate text-xs text-slate-500">{profile.email}</p>
            </div>
          )}
          <button
            onClick={() => {
              setSettingsSection('profile');
              setShowSettings(true);
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            <Settings className="h-5 w-5" />
            {t('sidebar.settings')}
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-5 w-5" />
            {t('sidebar.signOut')}
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {/* Hamburger — drawer toggle on mobile, collapse toggle on desktop */}
            <button
              onClick={toggleSidebar}
              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
              aria-label={
                sidebarOpen || !desktopCollapsed ? 'Close navigation menu' : 'Open navigation menu'
              }
              aria-expanded={sidebarOpen || !desktopCollapsed}
              aria-controls="main-sidebar"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className={`flex items-center gap-2 ${desktopCollapsed ? '' : 'md:hidden'}`}
              aria-label="Go to All Minds dashboard"
            >
              <Image
                src="/allminds-logo.png"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
                priority
              />
              <span className="text-lg font-bold text-slate-900">All Minds</span>
            </button>
          </div>

          <div className="hidden md:block">
            <p className="text-sm font-medium text-slate-500">{t('sidebar.workspace')}</p>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="relative">
              <button
                onClick={() => {
                  setShowLanguageMenu((current) => !current);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-1 rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
                aria-label={t('sidebar.changeLanguage')}
                title={t('sidebar.changeLanguage')}
              >
                <Globe className="h-5 w-5" />
                <span className="hidden text-xs font-medium sm:inline">
                  {LANGUAGES.find((item) => item.code === language)?.label}
                </span>
              </button>
              {showLanguageMenu && (
                <div className="absolute right-0 mt-2 max-h-80 w-48 overflow-y-auto rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setShowLanguageMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm transition hover:bg-slate-50 ${
                        language === lang.code
                          ? 'font-semibold text-[#087d8c]'
                          : 'text-slate-700'
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
                className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#ff6b57]" />
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
                  <div className="border-b border-slate-200 px-4 py-2">
                    <h3 className="font-semibold text-slate-800">{t('notifications.title')}</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="px-4 py-3">
                      <p className="text-sm text-slate-600">{t('notifications.empty')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setSettingsSection('profile');
                setShowSettings(true);
              }}
              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
              aria-label={t('sidebar.settings')}
              title={t('sidebar.settings')}
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 md:pb-8">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden"
        aria-label="Mobile dashboard navigation"
      >
        <div className="grid grid-cols-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(tab.href)}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium leading-tight transition ${
                activeTab === tab.id
                  ? 'bg-teal-50 text-[#087d8c]'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <tab.icon className="h-5 w-5" />
              <span className="max-w-full text-center">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {showSettings && profile && (
        <SettingsPanel
          profile={profile}
          onClose={() => setShowSettings(false)}
          onUpdate={loadProfile}
          initialSection={settingsSection}
        />
      )}

      <AgentChat />
    </div>
  );
}
