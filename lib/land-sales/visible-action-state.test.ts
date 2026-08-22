import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_ACTION_STATE,
  visibleActionState,
} from './visible-action-state.ts';

const stale = { errors: { city: 'Required' } };
const nextRejection = { errors: { county: 'Required' } };

describe('visibleActionState', () => {
  it('hides leftover validation errors when a new edit session opens on the same action state', () => {
    assert.equal(visibleActionState(stale, stale), null);
  });

  it('shows errors returned by a submit in the current edit session', () => {
    assert.equal(visibleActionState(nextRejection, stale), nextRejection);
  });

  it('shows errors when the form opened already in edit mode', () => {
    assert.equal(visibleActionState(stale, CURRENT_ACTION_STATE), stale);
  });
});
