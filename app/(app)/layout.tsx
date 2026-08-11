import { NavHeader } from '@/components/ui/nav-header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', width: '100%', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column' }}>
      <NavHeader />
      {children}
    </div>
  );
}
