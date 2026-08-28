'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Blueprint } from '@/components/ui/blueprint';
import { Button } from '@/components/ui/button';
import { DATABASE_CATEGORIES } from '@/lib/admin/database-descriptor';
import { UserAccessTable } from '@/components/profile/user-access-table';
import type { UserProfile } from '@/lib/users/roles';

type Tab = 'connections' | 'databases' | 'audit' | 'users';

const TABS: { key: Tab; label: string }[] = [
  { key: 'databases', label: 'Databases' },
  { key: 'users', label: 'Users' },
  { key: 'audit', label: 'Audit Log' },
  { key: 'connections', label: 'Connections' },
];

/** Connections is deferred (README §5) — visible, disabled, not a live product surface. */
const DEFERRED_CONNECTIONS = [
  { name: 'Supabase — Land Sales', type: 'Webhook', table: 'land_sales' },
  { name: 'CoStar API', type: 'API Integration', table: 'rentals' },
  { name: 'DocuSign Webhook', type: 'Webhook', table: 'expenses' },
];

export type AuditRow = { timestamp: string; user: string; action: string; detail: string };

export function DatabaseManagerTabs({
  salesCount,
  auditLog,
  users,
  currentUserId,
}: {
  salesCount: number;
  auditLog: AuditRow[];
  users: UserProfile[];
  currentUserId: string;
}) {
  const [tab, setTab] = useState<Tab>('databases');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-3)', borderBottom: '1px solid var(--color-neutral-300)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 600, letterSpacing: '0.02em',
              padding: 'var(--space-3) var(--space-4)', background: 'none', border: 'none',
              borderBottom: `2px solid ${tab === t.key ? 'var(--color-accent-600)' : 'transparent'}`,
              color: tab === t.key ? 'var(--color-accent-700)' : 'var(--color-neutral-700)', cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'connections' && (
        <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', padding: 'var(--space-6)', background: 'var(--color-neutral-100)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>Connections</div>
            <Button variant="primary" disabled title="Coming in a later phase">Add Connection</Button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 0 }}>
            Coming in a later phase.
          </p>
          <table className="table" style={{ width: '100%' }}>
            <thead><tr><th>Connection</th><th>Type</th><th>Table</th><th>Last Synced</th><th>Status</th></tr></thead>
            <tbody>
              {DEFERRED_CONNECTIONS.map(src => (
                <tr key={src.name}>
                  <td>{src.name}</td>
                  <td>{src.type}</td>
                  <td>{src.table}</td>
                  <td>—</td>
                  <td><span className="tag tag-neutral" title="Coming in a later phase">Coming in a later phase</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Blueprint>
      )}

      {tab === 'databases' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {DATABASE_CATEGORIES.map(db => {
            const recordLabel = db.key === 'sales' ? `${salesCount} record${salesCount === 1 ? '' : 's'}` : 'Coming in a later phase';
            const style: CSSProperties = {
              position: 'relative', boxSizing: 'border-box', background: 'var(--color-bg)',
              padding: 'var(--space-6) var(--space-8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              opacity: db.available ? 1 : 0.45,
            };
            return (
              <Blueprint key={db.key} elevation="sm" style={style} title={db.available ? undefined : 'Coming in a later phase'}>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, color: 'var(--color-text)' }}>{db.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 'var(--space-1)' }}>
                    {recordLabel}
                  </div>
                </div>
                {db.available && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Link href={`/admin/database-manager/fields?db=${db.key}`} className="btn btn-ghost">
                      Field configuration
                    </Link>
                    <Link href={`/admin/database-manager/templates?db=${db.key}`} className="btn btn-ghost">
                      Set templates
                    </Link>
                  </div>
                )}
              </Blueprint>
            );
          })}
        </div>
      )}

      {tab === 'users' && (
        <UserAccessTable users={users} currentUserId={currentUserId} />
      )}

      {tab === 'audit' && (
        <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', background: 'var(--color-bg)', padding: 'var(--space-6)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
            Activity Log
          </div>
          <table className="table" style={{ width: '100%' }}>
            <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Detail</th></tr></thead>
            <tbody>
              {auditLog.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-neutral-600)', padding: 'var(--space-6)' }}>No activity recorded yet.</td></tr>
              ) : auditLog.map((a, i) => (
                <tr key={i}>
                  <td>{a.timestamp}</td>
                  <td>{a.user}</td>
                  <td>{a.action}</td>
                  <td>{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Blueprint>
      )}
    </div>
  );
}
