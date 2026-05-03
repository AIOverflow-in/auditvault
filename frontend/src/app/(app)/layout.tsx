import { requireSession } from '@/lib/session';
import Sidebar from '@/components/sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen">
      <Sidebar user={session.user} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
