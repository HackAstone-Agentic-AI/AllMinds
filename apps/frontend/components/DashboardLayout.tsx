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
import { LANGUAGES, uiCoverage } from '@/lib/i18n/translations';
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
  const [isDesktop, setIsDesktop] = useState(false);
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const { applyServerThemePreference } = usePreferences();

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
        applyServerThemePreference(data.theme_preference as ThemePreference);
      }
    } catch (err) {
      console.error(err);
      router.push('/login');
    }
  }, [applyServerThemePreference, router]);

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
    const desktopQuery = window.matchMedia('(min-width: 768px)');
    const syncViewport = () => {
      setIsDesktop(desktopQuery.matches);
      if (desktopQuery.matches) setSidebarOpen(false);
    };

    syncViewport();
    desktopQuery.addEventListener('change', syncViewport);

    if (localStorage.getItem('allminds_sidebar_collapsed') === 'true') {
      setDesktopCollapsed(true);
    }

    return () => desktopQuery.removeEventListener('change', syncViewport);
  }, []);

  // The same control opens the mobile drawer and collapses the desktop sidebar.
  const toggleSidebar = () => {
    if (isDesktop) {
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
    if (!sidebarOpen || isDesktop) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDesktop, sidebarOpen]);

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

  const handleNavigate = (href: string) => {
    setSidebarOpen(false);
    router.push(href);
  };

  const navigationOpen = isDesktop ? !desktopCollapsed : sidebarOpen;

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

      {!navigationOpen && (
        <div className="fixed left-0 top-0 z-50 flex h-16 w-16 items-center justify-center border-b border-r border-slate-200 bg-white">
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Open navigation menu"
            aria-expanded="false"
            aria-controls="main-sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      )}

      <aside
        id="main-sidebar"
        aria-label="Sidebar navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${desktopCollapsed ? 'md:-translate-x-full' : 'md:translate-x-0'}`}
      >
        <div className="flex h-16 items-center border-b border-slate-200 px-3">
          <button
            onClick={() => handleNavigate('/dashboard')}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50"
            aria-label="Go to All Minds dashboard"
          >
            <Image
              src="/allminds-logo.png"
              alt=""
              width={38}
              height={38}
              className="h-10 w-10 flex-none object-contain"
              priority
            />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-slate-900">All Minds</p>
              <p className="truncate text-[11px] text-slate-500">Teacher workspace</p>
            </div>
          </button>
          <button
            onClick={toggleSidebar}
            className="ml-1 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close navigation menu"
            aria-expanded="true"
            aria-controls="main-sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Dashboard navigation">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleNavigate(tab.href)}
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
        <div
          className={`flex h-16 items-center justify-between pr-4 sm:pr-6 lg:pr-8 ${
            navigationOpen ? 'pl-4 sm:pl-6 lg:pl-8' : 'pl-20'
          }`}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleNavigate('/dashboard')}
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
                <div className="absolute right-0 mt-2 max-h-80 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
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
                      {lang.code !== 'en' && uiCoverage(lang.code) < 0.9 && (
                        <span className="block text-xs font-normal text-slate-400">AI replies; interface partly English</span>
                      )}
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

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>

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
