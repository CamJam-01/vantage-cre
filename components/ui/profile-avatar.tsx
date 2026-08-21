import { User } from 'lucide-react';

export function ProfileAvatar({
  src,
  size,
  iconSize,
}: {
  src?: string | null;
  size: number;
  iconSize: number;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-accent-800)',
        border: '1px solid var(--color-neutral-400)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {src ? (
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <User size={iconSize} strokeWidth={1.5} color="var(--color-accent-200)" />
      )}
    </span>
  );
}
