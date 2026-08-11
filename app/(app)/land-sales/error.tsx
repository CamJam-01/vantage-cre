'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-8) var(--space-6)', boxSizing: 'border-box', background: 'var(--color-accent-2-100)', textAlign: 'center',
    }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 var(--space-2)' }}>
        Something went wrong
      </h1>
      <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: '0 0 var(--space-6)', maxWidth: 480 }}>
        {error.message || 'The land sales data could not be loaded.'}
      </p>
      <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
    </main>
  );
}
