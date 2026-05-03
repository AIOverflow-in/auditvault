import Link from 'next/link';
import { FolderKanban, Plus } from 'lucide-react';
import { fetchAPI, requireSession } from '@/lib/session';
import { isNivyashRole, PROJECT_TYPE_LABELS, STAGE_BADGE, STAGE_LABELS } from '@/lib/labels';
import ProjectsFilters from './filters';

type Project = {
  id: string;
  vesselId: string;
  vesselName: string;
  organizationName: string;
  projectType: string;
  region: string;
  proposedDate: string;
  stage: string;
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { stage?: string; type?: string };
}) {
  const session = await requireSession();
  const canCreate = isNivyashRole(session.user.role);
  const data = await fetchAPI<{ projects: Project[] }>('/projects').catch(() => ({ projects: [] }));
  let projects = data.projects ?? [];

  if (searchParams.stage) projects = projects.filter((p) => p.stage === searchParams.stage);
  if (searchParams.type) projects = projects.filter((p) => p.projectType === searchParams.type);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Projects</h1>
          <p className="text-navy-700">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </p>
        </div>
        {canCreate && (
          <Link href="/projects/new" className="av-btn-primary">
            <Plus className="h-5 w-5" aria-hidden />
            New project
          </Link>
        )}
      </header>

      <ProjectsFilters stage={searchParams.stage} type={searchParams.type} />

      {projects.length === 0 ? (
        <div className="av-card p-10 text-center">
          <FolderKanban className="mx-auto mb-4 h-10 w-10 text-navy-400" aria-hidden />
          <p className="text-navy-700">No projects match.</p>
        </div>
      ) : (
        <div className="av-card overflow-hidden">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50 text-left text-sm font-semibold uppercase tracking-wider text-navy-700">
                <th className="px-4 py-3">Ship</th>
                {canCreate && <th className="px-4 py-3">Client</th>}
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-navy-50/50">
                  <td className="px-4 py-3 font-semibold text-navy-900">
                    <Link href={`/projects/${p.id}`} className="hover:text-teal-700 hover:underline">
                      {p.vesselName}
                    </Link>
                  </td>
                  {canCreate && <td className="px-4 py-3 text-navy-800">{p.organizationName}</td>}
                  <td className="px-4 py-3 text-navy-800">
                    {PROJECT_TYPE_LABELS[p.projectType] ?? p.projectType}
                  </td>
                  <td className="px-4 py-3 text-navy-800">{p.region || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-navy-800">{p.proposedDate || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STAGE_BADGE[p.stage] ?? ''}`}>
                      {STAGE_LABELS[p.stage] ?? p.stage}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
