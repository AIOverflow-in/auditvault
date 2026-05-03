import Link from 'next/link';
import { ArrowLeft, Plus, Ship, FolderKanban } from 'lucide-react';
import { fetchAPI, requireSession } from '@/lib/session';
import { isNivyashRole, PROJECT_TYPE_LABELS, STAGE_BADGE, STAGE_LABELS } from '@/lib/labels';

type Vessel = {
  id: string;
  name: string;
  imoNumber: string;
  flag: string;
  vesselType: string;
  organizationId: string;
  organizationName: string;
};

type Project = {
  id: string;
  vesselId: string;
  projectType: string;
  region: string;
  proposedDate: string;
  stage: string;
  updatedAt: string;
};

export default async function VesselDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const canCreate = isNivyashRole(session.user.role);

  const [{ vessel }, projData] = await Promise.all([
    fetchAPI<{ vessel: Vessel }>(`/vessels/${params.id}`),
    fetchAPI<{ projects: Project[] }>(`/projects?vesselId=${params.id}`).catch(() => ({ projects: [] })),
  ]);
  const projects = projData.projects ?? [];

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link href="/vessels" className="inline-flex items-center gap-2 text-base font-semibold text-teal-700 hover:underline">
          <ArrowLeft className="h-5 w-5" aria-hidden /> Back to ships
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-navy-900">{vessel.name}</h1>
            <p className="text-navy-700">{vessel.organizationName}</p>
          </div>
          {canCreate && (
            <Link href={`/projects/new?vesselId=${vessel.id}`} className="av-btn-primary">
              <Plus className="h-5 w-5" aria-hidden />
              New project
            </Link>
          )}
        </div>
      </header>

      <section className="av-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-navy-100 text-navy-700">
            <Ship className="h-7 w-7" aria-hidden />
          </div>
          <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <div>
              <dt className="text-sm font-semibold uppercase tracking-wider text-navy-700">IMO</dt>
              <dd className="text-base text-navy-900">{vessel.imoNumber || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold uppercase tracking-wider text-navy-700">Flag</dt>
              <dd className="text-base text-navy-900">{vessel.flag || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold uppercase tracking-wider text-navy-700">Type</dt>
              <dd className="text-base text-navy-900">{vessel.vesselType || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold uppercase tracking-wider text-navy-700">Projects</dt>
              <dd className="text-base text-navy-900">{projects.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="av-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-navy-900">
          <FolderKanban className="h-5 w-5 text-navy-700" aria-hidden /> Project history
        </h2>
        {projects.length === 0 ? (
          <p className="py-6 text-center text-navy-700">No projects yet for this ship.</p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {projects.map((p, idx) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-4 px-2 py-4 hover:bg-navy-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-navy-900">
                      {idx === 0 && (
                        <span className="mr-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-teal-800">
                          Latest
                        </span>
                      )}
                      {PROJECT_TYPE_LABELS[p.projectType] ?? p.projectType}
                    </p>
                    <p className="text-sm text-navy-700">
                      {p.region || '—'} · {p.proposedDate || 'no date set'}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STAGE_BADGE[p.stage] ?? ''}`}>
                    {STAGE_LABELS[p.stage] ?? p.stage}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
