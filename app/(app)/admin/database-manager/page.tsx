import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/users/roles';
import { DatabaseManagerTabs, type AuditRow } from '@/components/admin/database-manager-tabs';

const timestampFormat = new Intl.DateTimeFormat('en-US', {
  month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
});

export default async function DatabaseManagerPage() {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile(supabase);
  if (!profile) redirect('/login');
  if (profile.role !== 'Admin') redirect('/search');

  const [{ count: salesCount }, { data: auditRows }] = await Promise.all([
    supabase.from('land_sales').select('id', { count: 'exact', head: true }),
    supabase.from('audit_log').select('actor_name, action, detail, created_at').order('created_at', { ascending: false }).limit(25),
  ]);

  const auditLog: AuditRow[] = (auditRows ?? []).map(a => ({
    timestamp: timestampFormat.format(new Date(a.created_at)),
    user: a.actor_name,
    action: a.action,
    detail: a.detail,
  }));

  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'var(--space-8) var(--space-6) calc(var(--space-8) * 3)', boxSizing: 'border-box',
      background: 'var(--color-accent-2-100)',
    }}>
      <div style={{ width: '100%', maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: 0 }}>
            Database Manager
          </h1>
          <div className="tag tag-outline">ADMIN</div>
        </div>

        <DatabaseManagerTabs salesCount={salesCount ?? 0} auditLog={auditLog} />
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
