import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Plus, Ship, Users } from 'lucide-react';
import { fetchAPI, requireSession } from '@/lib/session';
import { isClientRole, isNivyashRole, ROLE_LABELS } from '@/lib/labels';
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
  // This page is the headline screen for everyone — Nivyash users land here
  // by clicking a client card from /clients; client users land here directly
  // because /dashboard redirects them to /clients/{their-org-id}. So we
  // require *a* session, not a specific role; the backend enforces per-tenant
  // scoping (a client user pulling another client's id gets 404).
  const session = await requireSession();
  const isAdmin = session.user.role === 'ADMIN';
  const isNivyash = isNivyashRole(session.user.role);
  const isClient = isClientRole(session.user.role);

  // Cross-tenant probe protection at the page layer too: if a client user
  // somehow URL-picks another client's id, fail fast (the API will also 404,
  // but failing here saves a round trip and shows a clean Next.js 404 page).
  if (isClient && session.user.organizationId !== params.id) {
    notFound();
  }

  const [clientRes, projectsRes] = await Promise.allSettled([
    fetchAPI<{ client: Client }>(`/clients/${params.id}`).then((r) => r.client),
    fetchAPI<{ projects: ProjectRow[] }>(`/projects?clientId=${params.id}`).then((r) => r.projects ?? []),
  ]);

  if (clientRes.status !== 'fulfilled') notFound();
  const client = clientRes.value;
  const projects = projectsRes.status === 'fulfilled' ? projectsRes.value : [];

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        {/* Breadcrumb — small text, navigates back to dashboard. */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-navy-600">
          <Link href="/dashboard" className="font-semibold text-teal-700 hover:underline">
            Dashboard
          </Link>
          <ChevronRight className="h-4 w-4 text-navy-300" aria-hidden />
          <span className="font-semibold text-navy-700">{client.name}</span>
        </nav>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="av-eyebrow">{isClient ? 'Your company' : 'Client'}</p>
            <h1 className="av-hero-title mt-2">{client.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="av-pill">
                <Ship className="h-3.5 w-3.5" aria-hidden />
                {client.vesselCount} {client.vesselCount === 1 ? 'ship' : 'ships'}
              </span>
              <span className="av-pill-teal">
                {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              </span>
              <span className="av-pill">
                <Users className="h-3.5 w-3.5" aria-hidden />
                {client.userCount} {client.userCount === 1 ? 'user' : 'users'}
              </span>
            </div>
          </div>
          {/* Admin-only actions: clients can't add ships or open projects.
              Nivyash staff get the action buttons. */}
          {isNivyash && (
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
          )}
        </div>
      </header>

      {/* Excel-replica table */}
      <ProjectsTable initialProjects={projects} clientName={client.name} />

      {/* Ships panel */}
      <section className="av-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-navy-900">
            <Ship className="h-5 w-5 text-navy-700" aria-hidden /> Ships
          </h2>
          {isNivyash && (
            <Link href={`/vessels/new?clientId=${client.id}`} className="text-base font-semibold text-teal-700 hover:underline">
              + Add ship
            </Link>
          )}
        </div>
        {client.vessels.length === 0 ? (
          <p className="py-6 text-center text-navy-700">
            {isClient
              ? 'No ships granted to you yet. Ask your Nivyash contact to grant ship access.'
              : 'No ships registered yet.'}
          </p>
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
