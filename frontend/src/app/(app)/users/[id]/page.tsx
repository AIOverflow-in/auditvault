import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchAPI, requireRole } from '@/lib/session';
import { ROLE_LABELS } from '@/lib/labels';
import GrantsEditor, { type Vessel } from './grants-editor';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  organizationName: string;
  organizationType: string;
  createdAt: string;
};

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  await requireRole(['ADMIN']);

  const usersData = await fetchAPI<{ users: User[] }>('/users');
  const user = (usersData.users ?? []).find((u) => u.id === params.id);
  if (!user) {
    return (
      <div className="space-y-4">
        <Link href="/users" className="text-base font-semibold text-teal-700 hover:underline">
          ← Back to users
        </Link>
        <p className="text-navy-700">User not found.</p>
      </div>
    );
  }

  // Vessels in their org + the user's currently granted vessels.
  const [orgVesselsData, grantedData] = await Promise.all([
    fetchAPI<{ vessels: Vessel[] }>('/vessels').then((d) => ({
      vessels: (d.vessels ?? []).filter((v) => v.organizationId === user.organizationId),
    })),
    fetchAPI<{ vessels: Vessel[] }>(`/users/${user.id}/vessels`).catch(() => ({ vessels: [] as Vessel[] })),
  ]);

  const isClientUser = user.organizationType === 'CLIENT';

  return (
    <div className="max-w-3xl space-y-8">
      <Link href="/users" className="inline-flex items-center gap-2 text-base font-semibold text-teal-700 hover:underline">
        <ArrowLeft className="h-5 w-5" aria-hidden /> Back to users
      </Link>

      <header>
        <h1 className="text-3xl font-bold text-navy-900">{user.name}</h1>
        <p className="text-navy-700">{user.email}</p>
        <p className="mt-2 inline-block rounded-full bg-navy-100 px-3 py-1 text-sm font-semibold text-navy-800">
          {ROLE_LABELS[user.role] ?? user.role} · {user.organizationName}
        </p>
      </header>

      {isClientUser ? (
        <section className="av-card p-6">
          <h2 className="mb-1 text-xl font-semibold text-navy-900">Ship access</h2>
          <p className="mb-4 text-navy-700">
            Choose which ships this user can see. They will only see projects, documents, and reports for
            ships ticked here.
          </p>
          <GrantsEditor
            userId={user.id}
            vessels={orgVesselsData.vessels}
            initialGrantedIds={(grantedData.vessels ?? []).map((v) => v.id)}
          />
        </section>
      ) : (
        <section className="av-card p-6">
          <h2 className="text-xl font-semibold text-navy-900">Ship access</h2>
          <p className="mt-2 text-navy-700">
            Nivyash internal users (admin and staff) can see every ship and every project. There is nothing
            to configure here.
          </p>
        </section>
      )}
    </div>
  );
}
