'use client';

import { type ReactNode } from 'react';

type DialogProps = {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
};

export function Dialog({ open, title, children, actions, onClose }: DialogProps) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-title">{title}</div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  );
}
