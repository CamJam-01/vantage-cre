import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 'var(--space-8) var(--space-6)', boxSizing: 'border-box',
      background: 'var(--color-bg)', textAlign: 'center', fontFamily: 'var(--font-body)',
    }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 var(--space-2)' }}>
        Page not found
      </h1>
      <p style={{ fontSize: 15, color: 'var(--color-neutral-700)', margin: '0 0 var(--space-6)' }}>
        The page you're looking for doesn't exist.
      </p>
      <Link href="/search" className="btn btn-primary">Back to search</Link>
    </div>
  );
}
