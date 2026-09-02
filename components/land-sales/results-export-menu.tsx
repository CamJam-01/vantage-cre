'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Download } from 'lucide-react';

export function ResultsExportMenu({
  disabled,
  onExportCsv,
  onMergeDocx,
  hasOutputFlows,
}: {
  disabled: boolean;
  onExportCsv: () => void;
  onMergeDocx: () => void;
  hasOutputFlows: boolean;
}) {
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
    <div ref={rootRef} className={open ? 'results-export-menu is-open' : 'results-export-menu'}>
      <button
        type="button"
        className="blueprint elev-md results-sidebar-badge"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        title={disabled ? 'Select records to export' : 'Export'}
        onClick={event => {
          event.stopPropagation();
          setOpen(current => !current);
        }}
      >
        <Download size={16} strokeWidth={1.5} aria-hidden />
        Export
      </button>
      <div id={menuId} className="results-add-dropdown" role="menu">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onExportCsv();
            setOpen(false);
          }}
        >
          Export CSV
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!hasOutputFlows}
          title={hasOutputFlows ? undefined : 'An admin needs to create an Output Flow in Database Manager first'}
          onClick={() => {
            onMergeDocx();
            setOpen(false);
          }}
        >
          Merge to DOCX
        </button>
      </div>
    </div>
  );
}
