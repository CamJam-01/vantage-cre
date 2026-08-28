'use client';

import { useState, type FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AuthCard } from '@/components/auth/auth-card';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

/**
 * Serves two purposes depending on how it's reached:
 * - From "Forgot password?" (no active recovery session): request a reset email.
 * - From the emailed reset link (Supabase establishes a recovery session via /auth/callback
 *   before redirecting here): set a new password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, []);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push('/search');
    router.refresh();
  }

  if (hasSession === null) return null;

  if (hasSession) {
    return (
      <AuthCard subtitle="SET A NEW PASSWORD">
        <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} onSubmit={handleUpdate}>
          <Field
            id="password" label="New password" type="password" placeholder="••••••••"
            required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
            style={{ backgroundColor: 'var(--color-paper)' }}
          />
          {error && <div style={{ fontSize: 13, color: 'var(--color-danger-500)' }}>{error}</div>}
          <Button type="submit" variant="primary" block disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </AuthCard>
    );
  }

  if (sent) {
    return (
      <AuthCard subtitle="FORGOT PASSWORD">
        <p style={{ fontSize: 14, color: 'var(--color-text)', textAlign: 'center' }}>
          Check <strong>{email}</strong> for a link to reset your password.
        </p>
        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: 14 }}>
          <Link href="/login">Back to sign in</Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle="FORGOT PASSWORD">
      <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} onSubmit={handleRequest}>
        <Field
          id="email" label="Email address" type="email" placeholder="you@company.com"
          required value={email} onChange={e => setEmail(e.target.value)}
          style={{ backgroundColor: 'var(--color-paper)' }}
        />
        {error && <div style={{ fontSize: 13, color: 'var(--color-danger-500)' }}>{error}</div>}
        <Button type="submit" variant="primary" block disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: 14 }}>
        <Link href="/login">Back to sign in</Link>
      </div>
    </AuthCard>
  );
}
