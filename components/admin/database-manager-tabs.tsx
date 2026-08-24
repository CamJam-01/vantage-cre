'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Blueprint } from '@/components/ui/blueprint';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Tag } from '@/components/ui/tag';
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

/** Illustrative only — Connections has no backend yet (decided scope: UI shell). */
const SAMPLE_CONNECTIONS = [
  { name: 'Supabase — Land Sales', type: 'Webhook', table: 'land_sales', lastSynced: 'Live', status: 'Connected' as const },
  { name: 'CoStar API', type: 'API Integration', table: 'rentals', lastSynced: '—', status: 'Not Connected' as const },
  { name: 'DocuSign Webhook', type: 'Webhook', table: 'expenses', lastSynced: '—', status: 'Not Connected' as const },
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
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [connectionType, setConnectionType] = useState<'webhook' | 'api' | null>(null);

  function openModal() { setModalOpen(true); setStep(1); setConnectionType(null); }
  function closeModal() { setModalOpen(false); }

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
            <Button variant="primary" onClick={openModal}>Add Connection</Button>
          </div>
          <p style={{ fontSize: 13, color: 'red', marginTop: 0 }}>
            Preview only — webhook and API connections aren&apos;t live yet.
          </p>
          <table className="table" style={{ width: '100%' }}>
            <thead><tr><th>Connection</th><th>Type</th><th>Table</th><th>Last Synced</th><th>Status</th></tr></thead>
            <tbody>
              {SAMPLE_CONNECTIONS.map(src => (
                <tr key={src.name}>
                  <td>{src.name}</td>
                  <td>{src.type}</td>
                  <td>{src.table}</td>
                  <td>{src.lastSynced}</td>
                  <td><span className={`tag ${src.status === 'Connected' ? 'tag-accent' : 'tag-neutral'}`}>{src.status}</span></td>
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
                  <Link href={`/admin/database-manager/schema?db=${db.key}`} className="btn btn-ghost">
                    Edit Fields
                  </Link>
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

      <Dialog
        open={modalOpen}
        onClose={closeModal}
        title="New Connection"
        actions={
          <>
            {step === 2 && <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>}
            <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
            {step === 1 && (
              <Button variant="primary" disabled={!connectionType} onClick={() => setStep(2)}>Next</Button>
            )}
            {step === 2 && <Button variant="primary" onClick={closeModal}>Finish</Button>}
          </>
        }
      >
        <div className="tag tag-outline" style={{ marginBottom: 'var(--space-4)' }}>STEP {step} OF 2</div>
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: '0 0 var(--space-2)' }}>Choose what you&apos;re connecting.</p>
            <Tag variant={connectionType === 'webhook' ? 'accent' : 'outline'} onClick={() => setConnectionType('webhook')} style={{ cursor: 'pointer', padding: 'var(--space-3) var(--space-4)' }}>
              Webhook
            </Tag>
            <Tag variant={connectionType === 'api' ? 'accent' : 'outline'} onClick={() => setConnectionType('api')} style={{ cursor: 'pointer', padding: 'var(--space-3) var(--space-4)' }}>
              API Integration
            </Tag>
          </div>
        )}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Field id="connectionName" label="Connection Name" type="text" placeholder="e.g. CoStar API" />
            <Field
              id="connectionSecret"
              label={connectionType === 'api' ? 'API Key' : 'Webhook URL'}
              type="text"
              placeholder={connectionType === 'api' ? 'sk_live_••••••••' : 'https://your-service.com/webhook'}
            />
          </div>
        )}
      </Dialog>
    </div>
  );
}
