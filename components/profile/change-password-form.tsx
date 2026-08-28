'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Blueprint } from '@/components/ui/blueprint';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

export function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setMessage(null);
    if (!current || !next) { setError('Enter your current and new password.'); return; }
    if (next !== confirm) { setError('New password and confirmation do not match.'); return; }
    if (next.length < 8) { setError('New password must be at least 8 characters.'); return; }

    setSaving(true);
    const supabase = createClient();
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (reauthError) {
      setError('Current password is incorrect.');
      setSaving(false);
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    setCurrent(''); setNext(''); setConfirm('');
    setMessage('Password updated.');
  }

  return (
    <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', background: 'var(--color-bg)', padding: 'var(--space-6)' }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
        Change Password
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 360 }}>
        <Field id="currentPassword" label="Current password" type="password" placeholder="••••••••" value={current} onChange={e => setCurrent(e.target.value)} />
        <Field id="newPassword" label="New password" type="password" placeholder="••••••••" value={next} onChange={e => setNext(e.target.value)} />
        <Field id="confirmPassword" label="Confirm new password" type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} />
      </div>
      {error && <div className="record-error" style={{ marginTop: 'var(--space-3)' }}>{error}</div>}
      {message && <div style={{ marginTop: 'var(--space-3)', fontSize: 13, color: 'var(--color-accent-700)' }}>{message}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>
    </Blueprint>
  );
}
