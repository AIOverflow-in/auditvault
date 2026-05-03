import { fetchAPI, requireSession } from '@/lib/session';
import { isNivyashRole, PROJECT_TYPE_LABELS, STAGE_BADGE, STAGE_LABELS } from '@/lib/labels';
import Link from 'next/link';
import { Building2, FolderKanban, Ship, ArrowRight } from 'lucide-react';

type Project = {
  id: string;
  vesselName: string;
  organizationName: string;
  projectType: string;
  region: string;
  proposedDate: string;
  stage: string;
  updatedAt: string;
};

export default async function DashboardPage() {
  const session = await requireSession();
  const data = await fetchAPI<{ projects: Project[] }>('/projects').catch(() => ({ projects: [] }));
  const projects = data.projects ?? [];

  // simple counts
  const active = projects.filter((p) => p.stage !== 'COMPLETED' && p.stage !== 'ENQUIRY').length;
  const pending = projects.filter((p) => p.stage === 'REPORT_SUBMITTED').length;
  const completed = projects.filter((p) => p.stage === 'COMPLETED').length;

  const cards = [
    { label: 'Total projects', value: projects.length, icon: FolderKanban },
    { label: 'Active', value: active, icon: Ship },
    { label: 'Pending feedback', value: pending, icon: Building2 },
    { label: 'Completed', value: completed, icon: ArrowRight },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-navy-900">
          Welcome, {session.user.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-navy-700">
          {isNivyashRole(session.user.role)
            ? 'Nivyash operations overview'
            : `${session.user.organizationName} — your audits at a glance`}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="av-card p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <p className="text-3xl font-bold text-navy-900">{c.value}</p>
              <p className="text-navy-700">{c.label}</p>
            </div>
          );
        })}
      </section>

      <section className="av-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-navy-900">Recent projects</h2>
          <Link href="/projects" className="text-base font-semibold text-teal-700 hover:underline">
            View all →
          </Link>
        </div>
        {projects.length === 0 ? (
          <p className="py-8 text-center text-navy-700">No projects to show yet.</p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {projects.slice(0, 8).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-4 px-2 py-4 hover:bg-navy-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-navy-900 truncate">
                      {p.vesselName}
                      {isNivyashRole(session.user.role) && (
                        <span className="ml-2 text-sm font-normal text-navy-700">
                          · {p.organizationName}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-navy-700 truncate">
                      {PROJECT_TYPE_LABELS[p.projectType] ?? p.projectType}
                      {p.region ? ` · ${p.region}` : ''}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${STAGE_BADGE[p.stage] ?? ''}`}
                  >
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
