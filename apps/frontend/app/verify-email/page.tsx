'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { CheckCircle2, AlertCircle, Loader2, Mail } from 'lucide-react';

type Status = 'verifying' | 'success' | 'expired' | 'invalid' | 'error';

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('verifying');
  const [resendEmail, setResendEmail] = useState('');
  const [resendInput, setResendInput] = useState('');
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('invalid');
      return;
    }

    api.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err: Error) => {
        const msg = err.message.toLowerCase();
        if (msg.includes('expired')) setStatus('expired');
        else if (msg.includes('invalid') || msg.includes('used')) setStatus('invalid');
        else setStatus('error');
      });
  }, [searchParams]);

  const handleResend = async () => {
    const email = resendInput.trim() || resendEmail.trim();
    if (!email) {
      setResendError('Please enter your email address.');
      return;
    }
    setResending(true);
    setResendError('');
    try {
      await api.resendVerification(email);
      setResendSent(true);
    } catch (err: unknown) {
      setResendError(err instanceof Error ? err.message : 'Could not send email. Try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full max-w-md p-8 space-y-6">
        {status === 'verifying' && (
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 text-[#0b4f5c] animate-spin mx-auto" />
            <h1 className="text-xl font-semibold text-slate-800">Verifying your email…</h1>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h1 className="text-xl font-semibold text-slate-800">Email verified!</h1>
            <p className="text-slate-600 text-sm">Your account is now active. You can log in.</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-[#0b4f5c] hover:bg-[#083f49] text-white font-medium py-3 rounded-lg transition"
            >
              Go to login
            </button>
          </div>
        )}

        {(status === 'expired' || status === 'invalid' || status === 'error') && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
              <h1 className="text-xl font-semibold text-slate-800">
                {status === 'expired' ? 'Link expired' : 'Link not valid'}
              </h1>
              <p className="text-slate-600 text-sm">
                {status === 'expired'
                  ? 'This verification link has expired. Request a new one below.'
                  : 'This link is invalid or has already been used. Request a new one below.'}
              </p>
            </div>

            {!resendSent ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Your email address
                  </label>
                  <input
                    type="email"
                    value={resendInput || resendEmail}
                    onChange={(e) => setResendInput(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0b4f5c] focus:border-transparent outline-none transition text-sm"
                  />
                </div>
                {resendError && (
                  <p className="text-sm text-red-600">{resendError}</p>
                )}
                <button
                  onClick={() => void handleResend()}
                  disabled={resending}
                  className="w-full bg-[#0b4f5c] hover:bg-[#083f49] text-white font-medium py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {resending ? 'Sending…' : 'Resend verification email'}
                </button>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
                A new verification link has been sent. Please check your inbox.
              </div>
            )}

            <button
              onClick={() => router.push('/login')}
              className="w-full text-sm text-slate-500 hover:text-slate-700 transition"
            >
              Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-[#0b4f5c] animate-spin" />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
