'use client';

import { useState, useTransition } from 'react';
import { Blueprint } from '@/components/ui/blueprint';
import { adminSetRoleAction, adminSetSuspendedAction } from '@/app/(app)/profile/actions';
import { ROLES, type Role, type UserProfile } from '@/lib/users/roles';

export function UserAccessTable({ users, currentUserId }: { users: UserProfile[]; currentUserId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRoleChange(userId: string, role: Role) {
    setError(null);
    startTransition(async () => {
      const result = await adminSetRoleAction(userId, role);
      if (result?.error) setError(result.error);
    });
  }

  function handleToggleSuspend(userId: string, suspended: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await adminSetSuspendedAction(userId, suspended);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', background: 'var(--color-bg)', padding: 'var(--space-6)', marginTop: 'var(--space-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>User Access Management</div>
        <span className="tag tag-accent">ADMIN</span>
      </div>
      {error && <div style={{ marginBottom: 'var(--space-3)', fontSize: 13, color: '#b3261e' }}>{error}</div>}
      <table className="table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => {
            const isSelf = u.id === currentUserId;
            return (
              <tr key={u.id}>
                <td>{u.full_name || u.username || '—'}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    className="input"
                    style={{ padding: 'var(--space-2) var(--space-3)', width: 'auto' }}
                    value={u.role}
                    disabled={isSelf || pending}
                    onChange={e => handleRoleChange(u.id, e.target.value as Role)}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  <span className={`tag ${u.is_suspended ? 'tag-neutral' : 'tag-accent'}`}>
                    {u.is_suspended ? 'Suspended' : 'Active'}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={isSelf || pending}
                    onClick={() => handleToggleSuspend(u.id, !u.is_suspended)}
                  >
                    {u.is_suspended ? 'Reactivate' : 'Suspend'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Blueprint>
  );
}
