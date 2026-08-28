'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/app/(app)/land-sales/actions';
import { ProfileAvatar } from '@/components/ui/profile-avatar';

export function ProfileNavMenu({ avatarUrl }: { avatarUrl?: string | null }) {
  const pathname = usePathname();
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  const open = openForPath === pathname;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpenForPath(null);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenForPath(null);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={open ? 'nav-dropdown is-open' : 'nav-dropdown'}>
      <button
        type="button"
        className="nav-dropdown-avatar-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Account menu"
        onClick={() => setOpenForPath(current => (current === pathname ? null : pathname))}
      >
        <ProfileAvatar src={avatarUrl} size={40} iconSize={18} />
      </button>
      <div id={menuId} className="nav-dropdown-menu nav-dropdown-menu-end" role="menu">
        <Link href="/profile" role="menuitem">
          Settings
        </Link>
        <form action={signOutAction}>
          <button type="submit" role="menuitem">Logout</button>
        </form>
      </div>
    </div>
  );
}
