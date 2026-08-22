export const CURRENT_ACTION_STATE = Symbol('current-action-state');

/** Action-state to show for this edit session.
 *
 * `useActionState` can keep the last server-action result after Cancel remounts
 * the form, so a new session starts from a `baseline` snapshot and ignores that
 * leftover until a later submit returns a different state object. Pass
 * `CURRENT_ACTION_STATE` when the form opened already editing (`?edit=1`) so
 * the rejection that produced this render is still shown. */
export function visibleActionState<T>(
  actionState: T,
  baseline: T | typeof CURRENT_ACTION_STATE,
): T | null {
  if (baseline === CURRENT_ACTION_STATE) return actionState;
  return Object.is(actionState, baseline) ? null : actionState;
}
