/** Profile names are suggestions, never foreign keys: saved verification text
 * must survive a profile rename, suspension, or deletion. */
export function activeUsernames(
  profiles: readonly { username: string | null; is_suspended: boolean }[],
): string[] {
  return [...new Set(profiles.flatMap(profile => {
    const username = profile.username?.trim();
    return !profile.is_suspended && username ? [username] : [];
  }))].sort((a, b) => a.localeCompare(b));
}
