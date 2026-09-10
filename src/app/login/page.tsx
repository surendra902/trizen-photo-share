'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
      if (emailParam === 'admin@trizen.com') {
        setPassword('Admin@123456');
      } else if (emailParam === 'team@trizen.com') {
        setPassword('Team@123456');
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const setDemoCreds = (role: 'ADMIN' | 'TEAM') => {
    if (role === 'ADMIN') {
      setEmail('admin@trizen.com');
      setPassword('Admin@123456');
    } else {
      setEmail('team@trizen.com');
      setPassword('Team@123456');
    }
  };

  return (
    <div className="w-full max-w-md card p-8 rise">
      <div className="mb-8">
        <p className="eyebrow mb-3">Staff Portal</p>
        <h1 className="font-display text-3xl tracking-tight">Sign in.</h1>
        <p className="text-sm text-muted mt-2">
          Access your event management or photography workspace.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* 1-Click Demo Buttons */}
      <div className="mb-6">
        <span className="eyebrow block mb-2.5">One-click demo fill</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDemoCreds('ADMIN')}
            className="btn btn-ghost !py-2.5 text-sm"
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => setDemoCreds('TEAM')}
            className="btn btn-ghost !py-2.5 text-sm"
          >
            Team
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="eyebrow block mb-2">Email address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@domain.com"
            className="field"
          />
        </div>

        <div>
          <label className="eyebrow block mb-2">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="field"
          />
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary w-full !mt-2">
          {loading ? 'Authenticating…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 text-sm text-muted">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="link-underline text-accent font-medium">
          Create one
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-5">
      <Suspense fallback={<div className="text-muted text-sm">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
