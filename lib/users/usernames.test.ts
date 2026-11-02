import { it } from 'node:test';
import assert from 'node:assert/strict';
import { activeUsernames } from './usernames.ts';

it('suggests only distinct, nonblank active usernames in alphabetical order', () => {
  assert.deepEqual(activeUsernames([
    { username: ' Zelda ', is_suspended: false },
    { username: 'Alice', is_suspended: false },
    { username: 'Alice', is_suspended: false },
    { username: 'Suspended', is_suspended: true },
    { username: null, is_suspended: false },
    { username: ' ', is_suspended: false },
  ]), ['Alice', 'Zelda']);
});
