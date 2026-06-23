'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import AuthShell from '@/components/AuthShell';
import { api, ApiError } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendSent, setResendSent] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const oauthError = new URLSearchParams(window.location.search).get('error');
    if (!oauthError) return;

    const errorMap: Record<string, string> = {
      oauth_failed: 'We could not complete that sign-in request.',
      google_oauth_failed: 'Google sign-in failed. Please try again.',
      google_oauth_not_configured: 'Google sign-in is not available yet.',
      microsoft_oauth_failed: 'Microsoft sign-in failed. Please try again.',
      microsoft_oauth_not_configured: 'Microsoft sign-in is not available yet.',
      apple_oauth_failed: 'Apple sign-in failed. Please try again.',
      apple_oauth_not_configured: 'Apple sign-in is not available yet.',
      session_expired: 'Your session expired. Sign in again to continue.',
    };

    setError(errorMap[oauthError] || 'We could not complete that sign-in request.');
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.login(email, password);
      localStorage.setItem('allminds_token', data.token);
      localStorage.setItem('allminds_user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'email_not_verified') {
        setUnverifiedEmail(email);
      } else {
        setError(err instanceof Error ? err.message : 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = api.getOAuthUrl('google');
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to All Minds"
      description="Continue to your teaching workspace."
    >
      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span className="mt-0.5 font-bold text-red-500">!</span>
          {error}
        </div>
      )}

      {unverifiedEmail && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-2"
        >
          <p className="font-medium">Email not verified</p>
          <p>Please verify your email address before logging in. Check your inbox for the link.</p>
          {!resendSent ? (
            <button
              onClick={() =>
                api.resendVerification(unverifiedEmail)
                  .then(() => setResendSent(true))
                  .catch(() => null)
              }
              className="font-semibold underline hover:no-underline"
            >
              Resend verification email
            </button>
          ) : (
            <p className="text-emerald-700 font-medium">Verification email sent — check your inbox.</p>
          )}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              id="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-[#087d8c] hover:text-[#075f6a]"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-11 text-sm text-slate-900 outline-none transition focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0b4f5c] px-4 py-3 font-semibold text-white transition hover:bg-[#083f49] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign in'}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-500">or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09A6.2 6.2 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A10.9 10.9 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </button>

      <p className="mt-7 text-center text-sm text-slate-600">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-semibold text-[#087d8c] hover:text-[#075f6a]">
          Create account
        </Link>
      </p>
    </AuthShell>
  );
}
