import { type ReactNode } from 'react';
import { Building2 } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';

export function AuthCard({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-6)', boxSizing: 'border-box', fontFamily: 'var(--font-body)',
        background: 'linear-gradient(190deg, #627D98, #1F2D3A)',
      }}
    >
      <Blueprint
        elevation="md"
        style={{
          position: 'static', width: '100%', maxWidth: 420, padding: 20,
          boxSizing: 'border-box', background: 'var(--color-accent-200)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <div className="blueprint" style={{ position: 'relative', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={26} strokeWidth={1.5} color="var(--color-accent-700)" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--color-text)', lineHeight: 1.1 }}>
              BOWERY VALUATION
            </div>
            <div className="tag tag-outline" style={{ marginTop: 'var(--space-2)' }}>{subtitle}</div>
          </div>
        </div>
        {children}
      </Blueprint>
    </div>
  );
}
