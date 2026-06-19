'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userStr = params.get('user');
    const error = params.get('error');
    if (token && userStr) {
      localStorage.setItem('allminds_token', token);
      localStorage.setItem('allminds_user', userStr);
      router.push('/dashboard');
    } else if (error) {
      router.push(`/login?error=${encodeURIComponent(error)}`);
    } else {
      router.push('/login?error=oauth_failed');
    }
  }, [router]);

  return <div>Logging you in...</div>;
}
