'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';

export function SearchNavMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
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
        className="nav-dropdown-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(current => !current)}
      >
        Search
      </button>
      <div id={menuId} className="nav-dropdown-menu" role="menu">
        <Link href="/land-sales" role="menuitem" onClick={() => setOpen(false)}>Results</Link>
        <Link href="/search" role="menuitem" onClick={() => setOpen(false)}>New</Link>
      </div>
    </div>
  );
}
