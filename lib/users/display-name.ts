export function displayUserName(user: {
  username: string | null;
  full_name: string | null;
}): string {
  return user.username?.trim() || user.full_name?.trim() || '—';
}
