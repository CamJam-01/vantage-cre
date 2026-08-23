import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/users/roles';
import { Blueprint } from '@/components/ui/blueprint';
import { AccountDetailsForm } from '@/components/profile/account-details-form';
import { ChangePasswordForm } from '@/components/profile/change-password-form';

export default async function ProfilePage() {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile) redirect('/login');

  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'var(--space-8) var(--space-6) calc(var(--space-8) * 3)', boxSizing: 'border-box',
      background: 'var(--color-accent-2-200)',
    }}>
      <div style={{ width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: 0 }}>
          Your Profile
        </h1>

        <AccountDetailsForm
          initialUsername={profile.username ?? ''}
          initialEmail={profile.email}
          initialAvatarUrl={profile.avatar_url}
        />
        <ChangePasswordForm email={profile.email} />

        {profile.role === 'Admin' && (
          <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', background: 'var(--color-bg)', padding: 'var(--space-6)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
              Admin Settings
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Link href="/admin/database-manager" className="btn btn-primary">Open</Link>
            </div>
          </Blueprint>
        )}
      </div>
    </main>
  );
}
