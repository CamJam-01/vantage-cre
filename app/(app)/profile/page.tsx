import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile, type UserProfile } from '@/lib/users/roles';
import { AccountDetailsForm } from '@/components/profile/account-details-form';
import { ChangePasswordForm } from '@/components/profile/change-password-form';
import { UserAccessTable } from '@/components/profile/user-access-table';

export default async function ProfilePage() {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile) redirect('/login');

  let allUsers: UserProfile[] = [];
  if (profile.role === 'Admin') {
    const { data } = await supabase
      .from('users')
      .select('id, email, full_name, username, role, is_suspended')
      .order('created_at');
    allUsers = (data as UserProfile[] | null) ?? [];
  }

  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'var(--space-8) var(--space-6) calc(var(--space-8) * 3)', boxSizing: 'border-box',
      background: 'var(--color-accent-2-100)',
    }}>
      <div style={{ width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: 0 }}>
          Your Profile
        </h1>

        <AccountDetailsForm initialUsername={profile.username ?? ''} initialEmail={profile.email} />
        <ChangePasswordForm email={profile.email} />

        {profile.role === 'Admin' && (
          <>
            <UserAccessTable users={allUsers} currentUserId={profile.id} />
            <div>
              <Link href="/admin/database-manager" className="btn btn-secondary">Open Database Manager</Link>
            </div>
          </>
        )}
      </div>

      <Link href="/search" className="blueprint" style={{
        position: 'fixed', bottom: 'var(--space-6)', left: 'var(--space-6)', display: 'flex',
        alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-6)',
        background: 'var(--color-bg)', color: 'var(--color-text)', boxShadow: 'var(--shadow-md)', textDecoration: 'none',
      }}>
        <ArrowLeft size={18} strokeWidth={2} />
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, letterSpacing: '0.03em' }}>BACK</span>
      </Link>
    </main>
  );
}
