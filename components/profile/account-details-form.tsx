'use client';

import { useState } from 'react';
import { User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Blueprint } from '@/components/ui/blueprint';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { updateProfileAction } from '@/app/(app)/profile/actions';

export function AccountDetailsForm({ initialUsername, initialEmail }: { initialUsername: string; initialEmail: string }) {
  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState(initialEmail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.set('username', username);
    const result = await updateProfileAction(null, formData);
    if (result?.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    if (email !== initialEmail) {
      const supabase = createClient();
      const { error: emailError } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: `${window.location.origin}/auth/callback?next=/profile` }
      );
      if (emailError) {
        setError(emailError.message);
        setSaving(false);
        return;
      }
      setMessage('Username saved. Check your new email address to confirm the change.');
    } else {
      setMessage('Saved.');
    }
    setSaving(false);
  }

  return (
    <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', background: 'var(--color-bg)', padding: 'var(--space-6)' }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
        Account Details
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 96, height: 96, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--color-accent-800)', border: '1px solid var(--color-neutral-400)',
            }}
          >
            <User size={40} strokeWidth={1.5} color="var(--color-accent-200)" />
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Field id="username" label="Username" type="text" value={username} onChange={e => setUsername(e.target.value)} />
          <Field id="email" label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      </div>
      {error && <div style={{ marginTop: 'var(--space-3)', fontSize: 13, color: '#b3261e' }}>{error}</div>}
      {message && <div style={{ marginTop: 'var(--space-3)', fontSize: 13, color: 'var(--color-accent-700)' }}>{message}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>
    </Blueprint>
  );
}
