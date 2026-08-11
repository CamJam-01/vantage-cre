'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { AuthCard } from '@/components/auth/auth-card';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthCard subtitle="REQUEST AN ACCOUNT">
        <p style={{ fontSize: 14, color: 'var(--color-text)', textAlign: 'center' }}>
          Check <strong>{email}</strong> for a confirmation link to finish creating your account.
        </p>
        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: 14 }}>
          <Link href="/login">Back to sign in</Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle="REQUEST AN ACCOUNT">
      <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} onSubmit={handleSubmit}>
        <Field
          id="fullName" label="Full name" type="text" placeholder="Jane Smith"
          required value={fullName} onChange={e => setFullName(e.target.value)}
          style={{ backgroundColor: '#FFFFFF' }}
        />
        <Field
          id="email" label="Email address" type="email" placeholder="you@company.com"
          required value={email} onChange={e => setEmail(e.target.value)}
          style={{ backgroundColor: '#FFFFFF' }}
        />
        <Field
          id="password" label="Password" type="password" placeholder="••••••••"
          required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
          style={{ backgroundColor: '#FFFFFF' }}
        />

        {error && <div style={{ fontSize: 13, color: '#b3261e' }}>{error}</div>}

        <Button type="submit" variant="primary" block disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: 14, color: 'var(--color-text)' }}>
        Already have an account? <Link href="/login">Sign in</Link>
      </div>
    </AuthCard>
  );
}
