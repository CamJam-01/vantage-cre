import Link from 'next/link';
import { Building2 } from 'lucide-react';
import type { UserProfile } from '@/lib/users/roles';
import { SearchNavMenu } from '@/components/ui/search-nav-menu';
import { ProfileNavMenu } from '@/components/ui/profile-nav-menu';

export function NavHeader({ profile }: { profile: UserProfile | null }) {
  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 10,
        height: 'var(--app-header-height)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 var(--space-6)', boxSizing: 'border-box',
        background: 'var(--color-accent)',
      }}
    >
      <Link href="/search" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', textDecoration: 'none' }}>
        <div className="blueprint" style={{ position: 'relative', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Building2 size={16} strokeWidth={1.5} color="var(--color-accent-200)" />
        </div>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--color-accent-2-100)' }}>
          BOWERY VALUATION DBMS
        </span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', alignSelf: 'stretch' }}>
        <SearchNavMenu />
        <ProfileNavMenu avatarUrl={profile?.avatar_url} />
      </div>
    </header>
  );
}
