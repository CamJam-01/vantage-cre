import Link from 'next/link';
import { Building2, User } from 'lucide-react';
import { signOutAction } from '@/app/(app)/land-sales/actions';

export function NavHeader() {
  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 10,
        borderBottom: '1px solid var(--color-neutral-300)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--space-4) var(--space-6)', boxSizing: 'border-box',
        background: 'var(--color-accent)',
      }}
    >
      <Link href="/search" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', textDecoration: 'none' }}>
        <div className="blueprint" style={{ position: 'relative', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Building2 size={16} strokeWidth={1.5} color="var(--color-accent-200)" />
        </div>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--color-accent-2-100)' }}>
          VANTAGE CRE
        </span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
        <Link href="/search" style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-accent-200)' }}>
          New Search
        </Link>
        <form action={signOutAction}>
          <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--color-accent-200)', fontFamily: 'inherit' }}>
            Logout
          </button>
        </form>
        <span
          aria-hidden="true"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            border: '1px solid var(--color-neutral-400)', background: 'var(--color-accent-800)',
          }}
        >
          <User size={18} strokeWidth={1.5} color="var(--color-accent-200)" />
        </span>
      </div>
    </header>
  );
}
