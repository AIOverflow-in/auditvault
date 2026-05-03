import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchAPI, requireRole } from '@/lib/session';
import NewVesselForm from './form';

type ClientOrg = { id: string; name: string };

export default async function NewVesselPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  await requireRole(['ADMIN', 'STAFF']);
  const data = await fetchAPI<{ clients: ClientOrg[] }>('/clients').catch(() => ({ clients: [] }));

  return (
    <div className="max-w-xl space-y-6">
      <Link
        href={searchParams.clientId ? `/clients/${searchParams.clientId}` : '/vessels'}
        className="inline-flex items-center gap-2 text-base font-semibold text-teal-700 hover:underline"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden /> Back
      </Link>
      <h1 className="text-3xl font-bold text-navy-900">Register a ship</h1>
      <NewVesselForm clients={data.clients ?? []} initialClientId={searchParams.clientId ?? ''} />
    </div>
  );
}
