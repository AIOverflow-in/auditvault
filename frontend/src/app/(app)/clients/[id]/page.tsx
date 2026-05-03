import Link from 'next/link';
import { ArrowLeft, Plus, Ship, Users } from 'lucide-react';
import { fetchAPI, requireRole } from '@/lib/session';
import { ROLE_LABELS } from '@/lib/labels';
import ProjectsTable, { ProjectRow } from './projects-table';

type Vessel = { id: string; name: string; imoNumber: string; flag: string; vesselType: string };
type UserBrief = { id: string; name: string; email: string; role: string };

type Client = {
  id: string;
  name: string;
  vesselCount: number;
  userCount: number;
  vessels: Vessel[];
  users: UserBrief[];
};

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const session = await requireRole(['ADMIN', 'STAFF']);
  const isAdmin = session.user.role === 'ADMIN';

  const [client, projects] = await Promise.all([
    fetchAPI<{ client: Client }>(`/clients/${params.id}`).then((r) => r.client),
    fetchAPI<{ projects: ProjectRow[] }>(`/projects?clientId=${params.id}`).then((r) => r.projects ?? []),
  ]);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link href="/clients" className="inline-flex items-center gap-2 text-base font-semibold text-teal-700 hover:underline">
          <ArrowLeft className="h-5 w-5" aria-hidden /> Back to clients
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-navy-900">{client.name}</h1>
            <p className="text-navy-700">
              {client.vesselCount} {client.vesselCount === 1 ? 'ship' : 'ships'} · {projects.length}{' '}
              {projects.length === 1 ? 'project' : 'projects'} · {client.userCount}{' '}
              {client.userCount === 1 ? 'user' : 'users'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/vessels/new?clientId=${client.id}`} className="av-btn-secondary">
              <Plus className="h-5 w-5" aria-hidden />
              Add ship
            </Link>
            <Link href={`/projects/new?clientId=${client.id}`} className="av-btn-primary">
              <Plus className="h-5 w-5" aria-hidden />
              New project
            </Link>
          </div>
        </div>
      </header>

      {/* Excel-replica table */}
      <ProjectsTable initialProjects={projects} />

      {/* Ships panel */}
      <section className="av-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-navy-900">
            <Ship className="h-5 w-5 text-navy-700" aria-hidden /> Ships
          </h2>
          <Link href={`/vessels/new?clientId=${client.id}`} className="text-base font-semibold text-teal-700 hover:underline">
            + Add ship
          </Link>
        </div>
        {client.vessels.length === 0 ? (
          <p className="py-6 text-center text-navy-700">No ships registered yet.</p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {client.vessels.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/vessels/${v.id}`}
                  className="flex items-center gap-4 px-2 py-4 hover:bg-navy-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-100 text-navy-700">
                    <Ship className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-navy-900 truncate">{v.name}</p>
                    <p className="text-sm text-navy-700 truncate">
                      {v.imoNumber ? `IMO ${v.imoNumber}` : 'No IMO'} · {v.vesselType || '—'} · {v.flag || '—'}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Users panel */}
      <section className="av-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-navy-900">
            <Users className="h-5 w-5 text-navy-700" aria-hidden /> Users
          </h2>
          {isAdmin && (
            <Link href={`/users/new?clientId=${client.id}`} className="text-base font-semibold text-teal-700 hover:underline">
              + Invite user
            </Link>
          )}
        </div>
        {client.users.length === 0 ? (
          <p className="py-6 text-center text-navy-700">No users yet for this client.</p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {client.users.map((u) => (
              <li key={u.id} className="flex items-center gap-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-100 text-base font-semibold text-navy-700">
                  {u.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-navy-900 truncate">{u.name}</p>
                  <p className="text-sm text-navy-700 truncate">{u.email}</p>
                </div>
                <span className="rounded-full bg-navy-100 px-3 py-1 text-sm font-semibold text-navy-800">
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
