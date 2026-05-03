import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchAPI, requireRole } from '@/lib/session';
import NewProjectForm from './form';

type Vessel = {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
};

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: { vesselId?: string; clientId?: string };
}) {
  await requireRole(['ADMIN', 'STAFF']);
  const data = await fetchAPI<{ vessels: Vessel[] }>('/vessels').catch(() => ({ vessels: [] }));
  let vessels = data.vessels ?? [];
  if (searchParams.clientId) vessels = vessels.filter((v) => v.organizationId === searchParams.clientId);

  const backHref = searchParams.vesselId
    ? `/vessels/${searchParams.vesselId}`
    : searchParams.clientId
      ? `/clients/${searchParams.clientId}`
      : '/projects';

  return (
    <div className="max-w-xl space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-2 text-base font-semibold text-teal-700 hover:underline">
        <ArrowLeft className="h-5 w-5" aria-hidden /> Back
      </Link>
      <h1 className="text-3xl font-bold text-navy-900">New project</h1>
      <NewProjectForm vessels={vessels} initialVesselId={searchParams.vesselId ?? ''} />
    </div>
  );
}
