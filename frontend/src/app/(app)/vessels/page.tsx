import Link from 'next/link';
import { Ship, Plus } from 'lucide-react';
import { fetchAPI, requireSession } from '@/lib/session';
import { isNivyashRole } from '@/lib/labels';

type Vessel = {
  id: string;
  name: string;
  imoNumber: string;
  flag: string;
  vesselType: string;
  organizationId: string;
  organizationName: string;
};

export default async function VesselsPage() {
  const session = await requireSession();
  const data = await fetchAPI<{ vessels: Vessel[] }>('/vessels').catch(() => ({ vessels: [] }));
  const vessels = data.vessels ?? [];
  const canCreate = isNivyashRole(session.user.role);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Ships</h1>
          <p className="text-navy-700">
            {vessels.length} {vessels.length === 1 ? 'ship' : 'ships'}
          </p>
        </div>
        {canCreate && (
          <Link href="/vessels/new" className="av-btn-primary">
            <Plus className="h-5 w-5" aria-hidden />
            Add ship
          </Link>
        )}
      </header>

      {vessels.length === 0 ? (
        <div className="av-card p-10 text-center">
          <Ship className="mx-auto mb-4 h-10 w-10 text-navy-400" aria-hidden />
          <p className="text-navy-700">
            {canCreate
              ? 'No ships registered yet. Add your first ship to get started.'
              : 'You don’t have access to any ships yet. Contact Nivyash to be granted access.'}
          </p>
        </div>
      ) : (
        <div className="av-card overflow-hidden">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50 text-left text-sm font-semibold uppercase tracking-wider text-navy-700">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">IMO</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Flag</th>
                {canCreate && <th className="px-4 py-3">Owner</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {vessels.map((v) => (
                <tr key={v.id} className="hover:bg-navy-50/50">
                  <td className="px-4 py-3 font-semibold text-navy-900">
                    <Link href={`/vessels/${v.id}`} className="hover:text-teal-700 hover:underline">
                      {v.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-navy-800">{v.imoNumber || '—'}</td>
                  <td className="px-4 py-3 text-navy-800">{v.vesselType || '—'}</td>
                  <td className="px-4 py-3 text-navy-800">{v.flag || '—'}</td>
                  {canCreate && <td className="px-4 py-3 text-navy-800">{v.organizationName}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
