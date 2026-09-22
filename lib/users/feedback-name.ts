/** The name the feedback widget's "Name" field is pre-filled with. Same
 * precedence as `displayUserName` — username, then full name — but yields
 * null instead of that function's `—` placeholder: an em dash is something
 * to render, not something to submit as a person's name. Null means leave
 * the field blank so the user can type whatever they want. */
export function feedbackSubmitterName(user: {
  username: string | null;
  full_name: string | null;
}): string | null {
  return user.username?.trim() || user.full_name?.trim() || null;
}
