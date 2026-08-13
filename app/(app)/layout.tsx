import { NavHeader } from '@/components/ui/nav-header';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/users/roles';
import { signOutAction } from '@/app/(app)/land-sales/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);

  if (profile?.is_suspended) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column' }}>
        <NavHeader profile={null} />
        <main style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-8) var(--space-6)', boxSizing: 'border-box', background: 'var(--color-accent-2-100)', textAlign: 'center',
        }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 var(--space-2)' }}>
            Account suspended
          </h1>
          <p style={{ fontSize: 15, color: 'var(--color-neutral-700)', margin: '0 0 var(--space-6)', maxWidth: 420 }}>
            Your access has been suspended. Contact an administrator if you believe this is a mistake.
          </p>
          <form action={signOutAction}>
            <button type="submit" className="btn btn-primary">Sign out</button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', width: '100%', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column' }}>
      <NavHeader profile={profile} />
      {children}
    </div>
  );
}
