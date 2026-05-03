import Link from 'next/link';
import { Building2, Plus, Ship } from 'lucide-react';
import { fetchAPI, requireRole } from '@/lib/session';

type Client = { id: string; name: string; vesselCount: number; userCount: number };

export default async function ClientsPage() {
  await requireRole(['ADMIN', 'STAFF']);
  const data = await fetchAPI<{ clients: Client[] }>('/clients').catch(() => ({ clients: [] }));
  const clients = data.clients ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Clients</h1>
          <p className="text-navy-700">
            {clients.length} client {clients.length === 1 ? 'company' : 'companies'}
          </p>
        </div>
        <Link href="/clients/new" className="av-btn-primary">
          <Plus className="h-5 w-5" aria-hidden />
          Add client
        </Link>
      </header>

      {clients.length === 0 ? (
        <div className="av-card p-10 text-center">
          <Building2 className="mx-auto mb-4 h-10 w-10 text-navy-400" aria-hidden />
          <p className="text-navy-700">No clients yet. Start by adding your first client company.</p>
          <Link href="/clients/new" className="av-btn-primary mt-6 inline-flex">
            <Plus className="h-5 w-5" aria-hidden />
            Add client
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clients/${c.id}`}
                className="av-card flex items-start gap-4 p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <Building2 className="h-6 w-6" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-navy-900 truncate">{c.name}</p>
                  <p className="mt-1 flex items-center gap-4 text-base text-navy-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Ship className="h-4 w-4" aria-hidden />
                      {c.vesselCount} {c.vesselCount === 1 ? 'ship' : 'ships'}
                    </span>
                    <span>
                      {c.userCount} {c.userCount === 1 ? 'user' : 'users'}
                    </span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
