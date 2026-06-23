'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Lock, Mail, UserRound } from 'lucide-react';
import AuthShell from '@/components/AuthShell';
import { api } from '@/lib/api';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    title: '',
    name: '',
    surname: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resending, setResending] = useState(false);
  const router = useRouter();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const fullName = `${formData.title} ${formData.name} ${formData.surname}`.trim();
      await api.register({
        email: formData.email,
        password: formData.password,
        full_name: fullName,
        title: formData.title,
        name: formData.name,
        surname: formData.surname,
        school_name: '',
        province: '',
        city: '',
      });
      setRegisteredEmail(formData.email);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    window.location.href = api.getOAuthUrl('google');
  };

  if (registeredEmail) {
    return (
      <AuthShell eyebrow="Almost there" title="Check your email" description="">
        <div className="space-y-4 text-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
          <p className="text-slate-700 text-sm">
            We sent a verification link to <strong>{registeredEmail}</strong>. Click the link in
            that email to activate your account, then log in.
          </p>
          <p className="text-xs text-slate-500">
            Didn&apos;t receive it? Check your spam folder or{' '}
            <button
              disabled={resending}
              onClick={() => {
                if (resending) return;
                setResending(true);
                api.resendVerification(registeredEmail).catch(() => null).finally(() => setResending(false));
              }}
              className="text-[#087d8c] hover:underline font-medium disabled:opacity-50"
            >
              {resending ? 'sending…' : 'resend the email'}
            </button>
            .
          </p>
          <Link
            href="/login"
            className="block w-full rounded-lg bg-[#0b4f5c] px-4 py-3 text-center font-semibold text-white transition hover:bg-[#083f49]"
          >
            Go to login
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Get started"
      title="Create your account"
      description="Set up your teacher workspace in a few details."
    >
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-slate-700">
            Title
          </label>
          <select
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
            required
          >
            <option value="">Select title</option>
            <option value="Mr.">Mr.</option>
            <option value="Ms.">Ms.</option>
            <option value="Mrs.">Mrs.</option>
            <option value="Dr.">Dr.</option>
            <option value="Prof.">Prof.</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
              First name
            </label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
                placeholder="First name"
                autoComplete="given-name"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="surname" className="mb-1.5 block text-sm font-medium text-slate-700">
              Surname
            </label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                id="surname"
                name="surname"
                value={formData.surname}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
                placeholder="Surname"
                autoComplete="family-name"
                required
              />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Confirm password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
              placeholder="Repeat your password"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0b4f5c] px-4 py-3 font-semibold text-white transition hover:bg-[#083f49] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Creating account...' : 'Create account'}
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
        onClick={handleGoogleSignup}
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
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-[#087d8c] hover:text-[#075f6a]">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
