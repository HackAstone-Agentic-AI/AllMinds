'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import AuthShell from '@/components/AuthShell';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setResetLink('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Enter the email address for your account.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.forgotPassword(trimmedEmail);
      setMessage(result.message || 'If that email is registered, you will receive a reset link.');
      if (result.reset_link) {
        setResetLink(result.reset_link);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not send reset instructions. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter your account email and we will send a secure reset link if the account exists."
    >
      {(error || message) && (
        <div
          role="alert"
          className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error || message}
        </div>
      )}

      {resetLink && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Email isn&apos;t set up on this server.</p>
          <p className="mt-1">Use this link to reset your password:</p>
          <Link href={resetLink} className="mt-2 block break-all font-semibold text-[#087d8c] underline">
            {resetLink}
          </Link>
        </div>
      )}

      <form onSubmit={handleResetPassword} className="space-y-4">
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
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#087d8c] focus:ring-2 focus:ring-[#087d8c]/20"
              placeholder="teacher@example.com"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0b4f5c] px-4 py-3 font-semibold text-white transition hover:bg-[#083f49] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Sending...' : 'Send reset link'}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        <Link href="/login" className="font-semibold text-[#087d8c] hover:text-[#075f6a]">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
