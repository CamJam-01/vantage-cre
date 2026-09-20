'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { SalesPath } from '@/lib/land-sales/sales-path';

export function ResultsAddMenu({ path }: { path: SalesPath }) {
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

    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown);
    }, 0);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={open ? 'results-add-menu is-open' : 'results-add-menu'}>
      <button
        type="button"
        className="results-add-badge"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Add"
        title="Add"
        onClick={event => {
          event.stopPropagation();
          setOpen(current => !current);
        }}
      >
        <Plus size={20} strokeWidth={1.5} aria-hidden />
      </button>
      <div id={menuId} className="results-add-dropdown" role="menu">
        <Link href={`${path.basePath}/new`} role="menuitem">Add Record</Link>
        <Link href={`${path.basePath}/import`} role="menuitem">Import CSV</Link>
      </div>
    </div>
  );
}
