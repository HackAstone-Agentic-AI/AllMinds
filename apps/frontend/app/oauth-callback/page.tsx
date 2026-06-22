'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function OAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    if (error) {
      router.push(`/login?error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code) {
      router.push('/login?error=oauth_failed');
      return;
    }

    let active = true;
    api
      .exchangeOAuthCode(code)
      .then((data) => {
        if (!active) return;
        localStorage.setItem('allminds_token', data.token);
        localStorage.setItem('allminds_user', JSON.stringify(data.user));
        router.replace('/dashboard');
      })
      .catch(() => {
        if (active) router.replace('/login?error=oauth_failed');
      });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-5">
      <div className="text-center">
        <p className="font-semibold text-slate-900">Completing sign-in</p>
        <p className="mt-2 text-sm text-slate-500">This should only take a moment.</p>
      </div>
    </main>
  );
}
