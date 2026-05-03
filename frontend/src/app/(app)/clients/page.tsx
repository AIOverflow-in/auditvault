import Link from 'next/link';
import { ArrowUpRight, Building2, Plus, Ship, Users } from 'lucide-react';
import { fetchAPI, requireRole } from '@/lib/session';

type Client = { id: string; name: string; vesselCount: number; userCount: number };

// Total ship count across all clients — small touch in the hero subtitle so
// the captain knows at a glance how big the operation is right now.
function totalShips(clients: Client[]) {
  return clients.reduce((n, c) => n + c.vesselCount, 0);
}

export default async function ClientsPage() {
  const session = await requireRole(['ADMIN', 'STAFF']);
  const data = await fetchAPI<{ clients: Client[] }>('/clients').catch(() => ({ clients: [] }));
  const clients = data.clients ?? [];

  const firstName = session.user.name.split(' ')[0];

  return (
    <div className="space-y-10">
      {/* Hero — confident greeting, two pieces of metadata, primary action. */}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="av-eyebrow">Dashboard</p>
          <h1 className="av-hero-title mt-2">Welcome back, {firstName}</h1>
          <p className="av-hero-subtitle">
            {clients.length === 0
              ? 'Set up your first client company to begin tracking audits.'
              : (
                <>
                  {clients.length} client {clients.length === 1 ? 'company' : 'companies'}
                  <span className="mx-2 text-navy-300">·</span>
                  {totalShips(clients)} {totalShips(clients) === 1 ? 'ship' : 'ships'} under management
                </>
              )}
          </p>
        </div>
        {clients.length > 0 && (
          <Link href="/clients/new" className="av-btn-primary self-start sm:self-auto">
            <Plus className="h-5 w-5" aria-hidden />
            Add client
          </Link>
        )}
      </header>

      {clients.length === 0 ? (
        <div className="av-card flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <Building2 className="h-8 w-8" aria-hidden />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tightish text-navy-900">
            No clients yet
          </h2>
          <p className="mt-2 max-w-md text-navy-700">
            Add the first shipping company you do audits for. You can register
            their ships and start a project right after.
          </p>
          <Link href="/clients/new" className="av-btn-primary mt-8">
            <Plus className="h-5 w-5" aria-hidden />
            Add your first client
          </Link>
        </div>
      ) : (
        <section>
          <h2 className="sr-only">Client companies</h2>
          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {clients.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clients/${c.id}`}
                  className="av-card av-card-hover group flex h-full flex-col gap-5 p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 transition-colors group-hover:bg-teal-100">
                      <Building2 className="h-6 w-6" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-lg font-bold tracking-tightish text-navy-900 group-hover:text-teal-800 truncate">
                        {c.name}
                      </p>
                      <p className="mt-1 text-sm text-navy-600">Client company</p>
                    </div>
                    <ArrowUpRight
                      className="h-5 w-5 text-navy-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-teal-600"
                      aria-hidden
                    />
                  </div>

                  <div className="mt-auto flex items-center gap-2 border-t border-navy-100 pt-4">
                    <span className="av-pill">
                      <Ship className="h-3.5 w-3.5" aria-hidden />
                      {c.vesselCount} {c.vesselCount === 1 ? 'ship' : 'ships'}
                    </span>
                    <span className="av-pill">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      {c.userCount} {c.userCount === 1 ? 'user' : 'users'}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
