'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    setLoading(false);

    // Always show the same success state, whether or not the email exists —
    // confirming "that email isn't registered" is an account-enumeration
    // leak, which is exactly the kind of small security mistake this
    // feature shouldn't introduce while fixing a different one.
    if (!error) {
      setSent(true);
    } else {
      setError('Something went wrong. Please try again in a moment.');
    }
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-red-700">Check your email</h1>
          <p className="text-sm text-neutral-600">
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset
            your password. It expires after a short time, so use it soon.
          </p>
          <Link href="/auth/login" className="inline-block text-sm text-red-700 hover:underline">
            ← Back to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-red-700">Reset your password</h1>
        <p className="text-sm text-neutral-500">
          Enter the email you registered with — we&apos;ll send you a link to set a new
          password.
        </p>

        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border px-3 py-2"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-red-700 py-2 text-white hover:bg-red-800 disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </button>

        <Link href="/auth/login" className="block text-center text-sm text-red-700 hover:underline">
          ← Back to login
        </Link>
      </form>
    </main>
  );
}
