'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AuthCard } from '@/components/auth/auth-card';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push('/search');
    router.refresh();
  }

  return (
    <AuthCard>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} onSubmit={handleSubmit}>
        <Field
          label="Email address" type="email" id="email" autoComplete="on" placeholder="you@company.com"
          required value={email} onChange={e => setEmail(e.target.value)}
          style={{ backgroundColor: 'var(--color-paper)' }}
        />
        <Field
          label="Password" type="password" id="password" autoComplete="on" placeholder="••••••••"
          required value={password} onChange={e => setPassword(e.target.value)}
          style={{ backgroundColor: 'var(--color-paper)' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'calc(var(--space-2) * -1)' }}>
          <label className="radio" style={{ gap: 'var(--space-2)', cursor: 'pointer' }}>
            <input type="checkbox" name="remember" checked={remember} onChange={() => setRemember(r => !r)} />
            <span className="dot" />
            <span style={{ fontSize: 14 }}>Remember me</span>
          </label>
          <Link href="/auth/reset-password" style={{ fontSize: 14 }}>Forgot password?</Link>
        </div>

        {error && <div className="record-error">{error}</div>}

        <Button type="submit" variant="primary" block disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: 14, color: 'var(--color-text)' }}>
        Need access? <Link href="/signup">Request an account</Link>
      </div>
    </AuthCard>
  );
}
