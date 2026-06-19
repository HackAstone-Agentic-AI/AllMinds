'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const oauthError = new URLSearchParams(window.location.search).get('error');
    if (!oauthError) {
      return;
    }

    const errorMap: Record<string, string> = {
      oauth_failed: 'We could not complete that sign-in request.',
      google_oauth_failed: 'Google sign-in failed. Please try again.',
      microsoft_oauth_failed: 'Microsoft sign-in failed. Please try again.',
      apple_oauth_failed: 'Apple sign-in failed. Please try again.',
      google_oauth_not_configured: 'Google sign-in is not configured yet on the backend.',
      microsoft_oauth_not_configured:
        'Microsoft sign-in is not configured yet on the backend.',
      apple_oauth_not_configured: 'Apple sign-in is not configured yet on the backend.',
    };

    setError(errorMap[oauthError] || 'We could not complete that sign-in request.');
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(email, password);
      localStorage.setItem('allminds_token', data.token);
      localStorage.setItem('allminds_user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth – redirect to backend
  const handleOAuthLogin = (provider: 'google' | 'microsoft' | 'apple') => {
    window.location.href = api.getOAuthUrl(provider);
  };

  const providers: Array<{ id: 'google' | 'microsoft' | 'apple'; label: string }> = [
    { id: 'google', label: 'Google' },
    { id: 'microsoft', label: 'Microsoft' },
    { id: 'apple', label: 'Apple' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">All Minds</h1>
          <p className="text-slate-600">HackAstone Teacher Tool</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">Or continue with</span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleOAuthLogin(provider.id)}
                disabled={loading}
                className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue with {provider.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center space-y-2">
          <Link href="/forgot-password" className="block text-sm text-blue-600 hover:text-blue-700 transition">
            Forgot Password?
          </Link>
          <div className="text-sm text-slate-600">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium transition">
              Create New Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
