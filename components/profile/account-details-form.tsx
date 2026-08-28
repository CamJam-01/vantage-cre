'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Blueprint } from '@/components/ui/blueprint';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { ProfilePhotoField } from '@/components/profile/profile-photo-field';
import { updateProfileAction } from '@/app/(app)/profile/actions';

export function AccountDetailsForm({
  initialUsername,
  initialEmail,
  initialAvatarUrl,
}: {
  initialUsername: string;
  initialEmail: string;
  initialAvatarUrl: string | null;
}) {
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
        <ProfilePhotoField key={initialAvatarUrl ?? 'empty'} initialUrl={initialAvatarUrl} />
        <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Field id="username" label="Username" type="text" value={username} onChange={e => setUsername(e.target.value)} />
          <Field id="email" label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      </div>
      {error && <div className="record-error" style={{ marginTop: 'var(--space-3)' }}>{error}</div>}
      {message && <div style={{ marginTop: 'var(--space-3)', fontSize: 13, color: 'var(--color-accent-700)' }}>{message}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>
    </Blueprint>
  );
}
