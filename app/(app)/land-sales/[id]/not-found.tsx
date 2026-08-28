import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-8) var(--space-6)', boxSizing: 'border-box', background: 'var(--color-accent-2-100)', textAlign: 'center',
    }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 var(--space-2)' }}>
        Record not found
      </h1>
      <p style={{ fontSize: 15, color: 'var(--color-neutral-700)', margin: '0 0 var(--space-6)' }}>
        This land sale record does not exist or may have been removed.
      </p>
      <Link href="/land-sales" className="btn btn-primary">Back to results</Link>
    </main>
  );
}
