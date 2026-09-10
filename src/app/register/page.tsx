'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-5">
      <div className="w-full max-w-md card p-8 rise">
        <div className="mb-8">
          <p className="eyebrow mb-3">New account</p>
          <h1 className="font-display text-3xl tracking-tight">Create an account.</h1>
          <p className="text-sm text-muted mt-2">
            New accounts join as Team Members. The first account on a fresh install becomes the Admin.
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="eyebrow block mb-2">Full name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Smith"
              className="field"
            />
          </div>

          <div>
            <label className="eyebrow block mb-2">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@trizen.com"
              className="field"
            />
          </div>

          <div>
            <label className="eyebrow block mb-2">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="field"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full !mt-3">
            {loading ? 'Creating account…' : 'Register'}
          </button>
        </form>

        <div className="mt-6 text-sm text-muted">
          Already have an account?{' '}
          <Link href="/login" className="link-underline text-accent font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
