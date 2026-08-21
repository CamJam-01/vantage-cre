import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentUserProfile, landSaleWriteDeniedMessage, listUserProfiles } from './roles.ts';

const rowWithoutAvatar = {
  id: 'user-1',
  email: 'dev@camjetton.com',
  full_name: 'Test Account',
  username: 'Cameron',
  role: 'Admin' as const,
  is_suspended: false,
};

function mockSupabase(options: {
  user: { id: string } | null;
  bySelect: Record<string, { data: unknown; error: { message: string } | null }>;
}) {
  const selects: string[] = [];
  const client = {
    selects,
    auth: {
      getUser: async () => ({ data: { user: options.user } }),
    },
    from: (table: string) => {
      assert.equal(table, 'users');
      return {
        select: (columns: string) => {
          const result = () => {
            selects.push(columns);
            return options.bySelect[columns] ?? {
              data: null,
              error: { message: `unexpected select: ${columns}` },
            };
          };
          return {
            eq: () => ({ maybeSingle: async () => result() }),
            order: async () => result(),
          };
        },
      };
    },
  };
  return client as unknown as SupabaseClient & { selects: string[] };
}

describe('getCurrentUserProfile', () => {
  it('still loads the signed-in user when avatar_url is not in the database yet', async () => {
    const supabase = mockSupabase({
      user: { id: 'user-1' },
      bySelect: {
        'id, email, full_name, username, role, is_suspended, avatar_url': {
          data: null,
          error: { message: 'column users.avatar_url does not exist' },
        },
        'id, email, full_name, username, role, is_suspended': {
          data: rowWithoutAvatar,
          error: null,
        },
      },
    });

    const profile = await getCurrentUserProfile(supabase);

    assert.deepEqual(profile, { ...rowWithoutAvatar, avatar_url: null });
    assert.equal(
      (supabase as unknown as { selects: string[] }).selects.includes(
        'id, email, full_name, username, role, is_suspended',
      ),
      true,
    );
  });

  it('returns null when there is no signed-in user', async () => {
    const supabase = mockSupabase({ user: null, bySelect: {} });
    assert.equal(await getCurrentUserProfile(supabase), null);
  });
});

describe('landSaleWriteDeniedMessage', () => {
  function profileClient(row: typeof rowWithoutAvatar & { avatar_url?: string | null }) {
    return mockSupabase({
      user: { id: row.id },
      bySelect: {
        'id, email, full_name, username, role, is_suspended, avatar_url': {
          data: { ...row, avatar_url: row.avatar_url ?? null },
          error: null,
        },
      },
    });
  }

  it('denies a Viewer so a direct server-action submit cannot write land_sales', async () => {
    const supabase = profileClient({ ...rowWithoutAvatar, role: 'Viewer' });
    assert.equal(
      await landSaleWriteDeniedMessage(supabase),
      'You do not have permission to edit records.',
    );
  });

  it('denies a signed-out caller', async () => {
    const supabase = mockSupabase({ user: null, bySelect: {} });
    assert.equal(
      await landSaleWriteDeniedMessage(supabase),
      'You do not have permission to edit records.',
    );
  });

  it('denies a suspended Editor', async () => {
    const supabase = profileClient({ ...rowWithoutAvatar, role: 'Editor', is_suspended: true });
    assert.equal(
      await landSaleWriteDeniedMessage(supabase),
      'You do not have permission to edit records.',
    );
  });

  it('allows an Editor', async () => {
    const supabase = profileClient({ ...rowWithoutAvatar, role: 'Editor' });
    assert.equal(await landSaleWriteDeniedMessage(supabase), null);
  });

  it('allows an Admin', async () => {
    const supabase = profileClient(rowWithoutAvatar);
    assert.equal(await landSaleWriteDeniedMessage(supabase), null);
  });
});

describe('listUserProfiles', () => {
  it('still lists users when avatar_url is not in the database yet', async () => {
    const supabase = mockSupabase({
      user: { id: 'user-1' },
      bySelect: {
        'id, email, full_name, username, role, is_suspended, avatar_url': {
          data: null,
          error: { message: 'column users.avatar_url does not exist' },
        },
        'id, email, full_name, username, role, is_suspended': {
          data: [rowWithoutAvatar],
          error: null,
        },
      },
    });

    const users = await listUserProfiles(supabase);

    assert.deepEqual(users, [{ ...rowWithoutAvatar, avatar_url: null }]);
  });
});
