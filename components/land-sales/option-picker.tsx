'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';

export type PickerOption = { key: string; label: string; disabled?: boolean };

type OptionPickerProps = {
  title: string;
  subtitle: string;
  options: PickerOption[];
  backHref?: string;
  continueHref: (key: string) => string;
};

export function OptionPicker({ title, subtitle, options, backHref, continueHref }: OptionPickerProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const hasSelection = !!selected;

  function handleContinue() {
    if (!selected) return;
    router.push(continueHref(selected));
  }

  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'var(--space-8) var(--space-6) var(--space-8)', boxSizing: 'border-box',
      background: 'var(--color-accent-2-100)', paddingTop: 80,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)', margin: 'var(--space-3) 0 var(--space-2)' }}>
          {title}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--color-neutral-700)', margin: 0 }}>{subtitle}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', width: '100%', maxWidth: 520, marginTop: 'var(--space-8)' }}>
        {options.map(opt => {
          const isSelected = selected === opt.key;
          return (
            <Blueprint
              key={opt.key}
              elevation="sm"
              onClick={opt.disabled ? undefined : () => setSelected(opt.key)}
              style={{
                position: 'relative', padding: 'var(--space-4) var(--space-6)', display: 'flex',
                flexDirection: 'row', alignItems: 'center', gap: 'var(--space-4)', boxSizing: 'border-box',
                background: '#D6EBFF',
                outline: isSelected ? '2px solid var(--color-accent-600)' : 'none', outlineOffset: -1,
                opacity: opt.disabled ? 0.45 : 1,
                cursor: opt.disabled ? 'not-allowed' : 'pointer',
              }}
              title={opt.disabled ? 'Coming in a later phase' : undefined}
            >
              <div style={{
                flexShrink: 0, width: 22, height: 22,
                border: `1.5px solid ${isSelected ? 'var(--color-accent-600)' : 'var(--color-neutral-500)'}`,
                background: isSelected ? 'var(--color-accent-600)' : '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isSelected && <Check size={14} strokeWidth={3} color="var(--color-bg)" />}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text)' }}>
                  {opt.label}
                </div>
              </div>
            </Blueprint>
          );
        })}
      </div>

      {backHref && (
        <Link href={backHref} className="blueprint" style={{
          position: 'fixed', bottom: 'var(--space-6)', left: 'var(--space-6)', display: 'flex',
          alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-6)',
          background: 'var(--color-bg)', color: 'var(--color-text)', boxShadow: 'var(--shadow-md)', textDecoration: 'none',
        }}>
          <ArrowLeft size={18} strokeWidth={2} />
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, letterSpacing: '0.03em' }}>BACK</span>
        </Link>
      )}

      <button
        type="button"
        className="blueprint"
        onClick={handleContinue}
        style={{
          position: 'fixed', bottom: 'var(--space-6)', right: 'var(--space-6)', display: 'flex',
          alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-6)',
          background: hasSelection ? 'var(--color-accent-600)' : 'var(--color-neutral-300)',
          color: hasSelection ? 'var(--color-bg)' : 'var(--color-neutral-600)',
          border: 'none', cursor: hasSelection ? 'pointer' : 'not-allowed',
          opacity: hasSelection ? 1 : 0.45, pointerEvents: hasSelection ? 'auto' : 'none',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 600, letterSpacing: '0.03em' }}>CONTINUE</span>
        <ArrowRight size={18} strokeWidth={2} />
      </button>
    </main>
  );
}
