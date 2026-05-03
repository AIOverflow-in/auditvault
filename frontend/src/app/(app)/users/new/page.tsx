import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchAPI, requireRole } from '@/lib/session';
import NewUserForm, { type ClientWithVessels } from './form';

type Org = { id: string; name: string; type: string };
type Vessel = { id: string; name: string; organizationId: string; organizationName: string };

export default async function NewUserPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  await requireRole(['ADMIN']);

  // We need: list of all orgs (to choose where the user belongs), and the
  // vessels for each client org (so the admin can pre-grant ships).
  const [clientsData, vesselsData] = await Promise.all([
    fetchAPI<{ clients: { id: string; name: string }[] }>('/clients').catch(() => ({ clients: [] })),
    fetchAPI<{ vessels: Vessel[] }>('/vessels').catch(() => ({ vessels: [] })),
  ]);

  const orgs: Org[] = [
    { id: 'NIVYASH', name: 'Nivyash (internal)', type: 'NIVYASH' },
    ...((clientsData.clients ?? []).map((c) => ({ id: c.id, name: c.name, type: 'CLIENT' }))),
  ];

  // Group vessels by client org for the multi-select.
  const clientVessels: ClientWithVessels[] = (clientsData.clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    vessels: (vesselsData.vessels ?? []).filter((v) => v.organizationId === c.id),
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/users" className="inline-flex items-center gap-2 text-base font-semibold text-teal-700 hover:underline">
        <ArrowLeft className="h-5 w-5" aria-hidden /> Back to users
      </Link>
      <h1 className="text-3xl font-bold text-navy-900">Add a user</h1>
      <NewUserForm orgs={orgs} clients={clientVessels} initialClientId={searchParams.clientId ?? ''} />
    </div>
  );
}
