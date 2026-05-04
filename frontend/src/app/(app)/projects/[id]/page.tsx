import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Ship, FileText, MessageSquare } from 'lucide-react';
import { fetchAPI, requireSession } from '@/lib/session';
import { isClientRole, isNivyashRole, PROJECT_TYPE_LABELS, STAGE_BADGE, STAGE_LABELS, STAGES } from '@/lib/labels';
import StageUpdater from './stage-updater';
import FilePanel, { ProjectFile } from './file-panel';
import NotesPanel, { Note } from './notes-panel';

type Project = {
  id: string;
  vesselId: string;
  vesselName: string;
  organizationId: string;
  organizationName: string;
  projectType: string;
  region: string;
  proposedDate: string;
  actualDate: string;
  stage: string;
  remarks: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const isAdmin = session.user.role === 'ADMIN';
  const canEdit = isNivyashRole(session.user.role);
  const isClient = isClientRole(session.user.role);

  // The project fetch must be allowed to fail cleanly: when a client user
  // URL-picks a project on a vessel they do not have a grant on, the API
  // returns 404 and our fetchAPI throws. allSettled lets us catch that and
  // call notFound() instead of crashing the route into a 500.
  const [projectRes, filesRes, notesRes] = await Promise.allSettled([
    fetchAPI<{ project: Project }>(`/projects/${params.id}`),
    fetchAPI<{ files: ProjectFile[] }>(`/projects/${params.id}/files`),
    isClient
      ? Promise.resolve({ notes: [] as Note[] })
      : fetchAPI<{ notes: Note[] }>(`/projects/${params.id}/notes`),
  ]);

  if (projectRes.status !== 'fulfilled') notFound();

  const { project } = projectRes.value;
  const files = filesRes.status === 'fulfilled' ? (filesRes.value.files ?? []) : [];
  const notes = notesRes.status === 'fulfilled' ? (notesRes.value.notes ?? []) : [];
  const stageIdx = STAGES.indexOf(project.stage);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link href="/projects" className="inline-flex items-center gap-2 text-base font-semibold text-teal-700 hover:underline">
          <ArrowLeft className="h-5 w-5" aria-hidden /> Back to projects
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href={`/vessels/${project.vesselId}`}
              className="inline-flex items-center gap-1.5 text-base font-semibold text-teal-700 hover:underline"
            >
              <Ship className="h-4 w-4" aria-hidden />
              {project.vesselName}
            </Link>
            <h1 className="mt-1 text-3xl font-bold text-navy-900">
              {PROJECT_TYPE_LABELS[project.projectType] ?? project.projectType}
            </h1>
            <p className="text-navy-700">
              {project.region || '—'}
              {canEdit && ` · ${project.organizationName}`}
            </p>
          </div>
          <span className={`rounded-full px-4 py-2 text-base font-semibold ${STAGE_BADGE[project.stage] ?? ''}`}>
            {STAGE_LABELS[project.stage] ?? project.stage}
          </span>
        </div>
      </header>

      {/* Stage tracker */}
      <section className="av-card p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-navy-900">Progress</h2>
          {canEdit && <StageUpdater projectId={project.id} currentStage={project.stage} />}
        </div>
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {STAGES.map((s, i) => {
            const done = i < stageIdx;
            const active = i === stageIdx;
            return (
              <li
                key={s}
                className={`rounded-lg border p-3 text-center ${
                  done
                    ? 'border-teal-200 bg-teal-50 text-teal-800'
                    : active
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : 'border-navy-100 bg-white text-navy-700'
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">Step {i + 1}</p>
                <p className="mt-1 text-sm font-semibold">{STAGE_LABELS[s]}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Meta */}
      <section className="av-card p-6">
        <h2 className="mb-4 text-xl font-semibold text-navy-900">Project details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {[
            { label: 'Type', value: PROJECT_TYPE_LABELS[project.projectType] ?? project.projectType },
            { label: 'Region', value: project.region || '—' },
            { label: 'Proposed', value: project.proposedDate || '—' },
            { label: 'Actual', value: project.actualDate || '—' },
            { label: 'Created', value: project.createdAt.split('T')[0] },
            { label: 'Updated', value: project.updatedAt.split('T')[0] },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-sm font-semibold uppercase tracking-wider text-navy-700">{item.label}</dt>
              <dd className="text-base text-navy-900">{item.value}</dd>
            </div>
          ))}
        </dl>
        {!isClient && project.remarks && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-bold uppercase tracking-wider text-amber-800">Internal remarks</p>
            <p className="mt-1 whitespace-pre-wrap text-base text-amber-900">{project.remarks}</p>
          </div>
        )}
      </section>

      {/* Files */}
      <section className="av-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-navy-900">
          <FileText className="h-5 w-5 text-navy-700" aria-hidden /> Documents
        </h2>
        <FilePanel
          projectId={project.id}
          initialFiles={files}
          isClient={isClient}
          isAdmin={isAdmin}
        />
      </section>

      {/* Notes (Nivyash only) */}
      {!isClient && (
        <section className="av-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-navy-900">
            <MessageSquare className="h-5 w-5 text-navy-700" aria-hidden /> Internal notes
          </h2>
          <NotesPanel projectId={project.id} initialNotes={notes} canEdit={canEdit} />
        </section>
      )}
    </div>
  );
}
