'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';
import { PROJECT_TYPE_LABELS, STAGE_BADGE, STAGE_LABELS, STAGES } from '@/lib/labels';
import { API_URL } from '@/lib/api';
import RemarksCell from './remarks-cell';
import ReportCell from './report-cell';
import FeedbackCell from './feedback-cell';

export type FileBrief = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: string;
  createdAt: string;
};

export type ProjectRow = {
  id: string;
  vesselId: string;
  vesselName: string;
  organizationName: string;
  projectType: string;
  region: string;
  proposedDate: string;
  stage: string;
  remarks: string;
  finalReports: FileBrief[] | null;
  feedback: FileBrief[] | null;
};

// Column order intentionally mirrors docs/IM-NIVYASH AUDIT VAULT DASHBOARD.xlsx
// 1:1 — that's the spreadsheet the captain uses today and the headline brief
// was "exactly the same columns". The Excel reserves three "Report uploaded"
// slots, with the first explicitly noted as accepting either a PDF or audio
// (VDR recording). Don't reorder these without checking the source xlsx.
export default function ProjectsTable({ initialProjects }: { initialProjects: ProjectRow[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);

  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      if (a.vesselName !== b.vesselName) return a.vesselName.localeCompare(b.vesselName);
      const ad = a.proposedDate || '';
      const bd = b.proposedDate || '';
      return ad.localeCompare(bd);
    });
  }, [projects]);

  function patchRow(id: string, patch: Partial<ProjectRow>) {
    setProjects((curr) => curr.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function appendReport(id: string, file: FileBrief) {
    setProjects((curr) =>
      curr.map((p) =>
        p.id === id ? { ...p, finalReports: [...(p.finalReports ?? []), file] } : p,
      ),
    );
  }

  async function changeStage(p: ProjectRow, stage: string) {
    const previous = p.stage;
    patchRow(p.id, { stage });
    const res = await fetch(`${API_URL}/projects/${p.id}/stage`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    });
    if (!res.ok) {
      patchRow(p.id, { stage: previous });
      alert('Could not update stage.');
    }
    router.refresh();
  }

  return (
    <section className="av-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
        <h2 className="text-xl font-semibold text-navy-900">Audit projects</h2>
        <p className="text-base text-navy-700">{sorted.length} rows</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50 text-left text-sm font-semibold uppercase tracking-wider text-navy-700">
              <th className="px-4 py-3">Sr no</th>
              <th className="px-4 py-3">Ship name</th>
              <th className="px-4 py-3">Project type</th>
              <th className="px-4 py-3">Proposed region</th>
              <th className="px-4 py-3">Proposed dates</th>
              <th className="px-4 py-3">Project stage</th>
              <th className="px-4 py-3">
                Report uploaded 1
                <span className="block text-[11px] font-medium normal-case tracking-normal text-navy-600">
                  pdf or audio
                </span>
              </th>
              <th className="px-4 py-3">Report uploaded 2</th>
              <th className="px-4 py-3">Report uploaded 3</th>
              <th className="px-4 py-3">
                Feedback from ship
                <span className="block text-[11px] font-medium normal-case tracking-normal text-navy-600">
                  pdf upload
                </span>
              </th>
              <th className="px-4 py-3">Remarks by company</th>
              <th className="px-4 py-3 sr-only">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={12} className="px-6 py-10 text-center text-navy-700">
                  No projects yet. Use “New project” to add one.
                </td>
              </tr>
            )}
            {sorted.map((p, i) => (
              <tr key={p.id} className="align-top hover:bg-navy-50/50">
                <td className="whitespace-nowrap px-4 py-3 text-navy-700">{i + 1}</td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-navy-900">
                  <Link href={`/vessels/${p.vesselId}`} className="hover:text-teal-700 hover:underline">
                    {p.vesselName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-navy-800">
                  {PROJECT_TYPE_LABELS[p.projectType] ?? p.projectType}
                </td>
                <td className="px-4 py-3 text-navy-800">{p.region || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-navy-800">{p.proposedDate || '—'}</td>
                <td className="px-4 py-3">
                  <label className="sr-only" htmlFor={`stage-${p.id}`}>
                    Stage
                  </label>
                  <select
                    id={`stage-${p.id}`}
                    value={p.stage}
                    onChange={(e) => changeStage(p, e.target.value)}
                    className={`min-h-tap rounded-lg border border-navy-200 bg-white px-3 text-base font-semibold ${
                      STAGE_BADGE[p.stage] ?? ''
                    }`}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <ReportCell project={p} slotIndex={0} onChange={(f) => appendReport(p.id, f)} />
                </td>
                <td className="px-4 py-3">
                  <ReportCell project={p} slotIndex={1} onChange={(f) => appendReport(p.id, f)} />
                </td>
                <td className="px-4 py-3">
                  <ReportCell project={p} slotIndex={2} onChange={(f) => appendReport(p.id, f)} />
                </td>
                <td className="px-4 py-3">
                  <FeedbackCell
                    project={p}
                    onChange={(file) => patchRow(p.id, { feedback: [...(p.feedback ?? []), file] })}
                  />
                </td>
                <td className="px-4 py-3 min-w-[18rem]">
                  <RemarksCell project={p} onChange={(remarks) => patchRow(p.id, { remarks })} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Link
                    href={`/projects/${p.id}`}
                    className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-navy-200 px-3 text-base font-semibold text-navy-800 hover:bg-navy-50"
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
