export default function Loading() {
  return (
    <main style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-8) var(--space-6)', boxSizing: 'border-box', background: 'var(--color-accent-2-100)',
    }}>
      <p style={{ fontSize: 14, color: 'var(--color-neutral-600)' }}>Loading…</p>
    </main>
  );
}
