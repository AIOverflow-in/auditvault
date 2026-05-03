'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  Maximize2,
  Search,
  X,
} from 'lucide-react';
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

type SortColumn =
  | 'srNo'
  | 'vesselName'
  | 'projectType'
  | 'region'
  | 'proposedDate'
  | 'stage';

type SortState = { col: SortColumn; dir: 'asc' | 'desc' };

// Column order intentionally mirrors docs/IM-NIVYASH AUDIT VAULT DASHBOARD.xlsx
// 1:1 — that's the spreadsheet the captain uses today and the headline brief
// was "exactly the same columns". The Excel reserves three "Report uploaded"
// slots, with the first explicitly noted as accepting either a PDF or audio
// (VDR recording). Don't reorder these without checking the source xlsx.
//
// On top of the static table we layer a small set of Excel-style operations
// the captain will recognise: search across the row text, click-to-sort
// columns, fullscreen view that hides chrome, and a one-click CSV download
// that opens cleanly in Excel.
export default function ProjectsTable({
  initialProjects,
  clientName,
}: {
  initialProjects: ProjectRow[];
  clientName: string;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState>({ col: 'vesselName', dir: 'asc' });
  const [fullscreen, setFullscreen] = useState(false);

  // Lock body scroll while the fullscreen modal is open and let Esc close it.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

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

  // Filter + sort. Done in-memory because the dataset is small (one client's
  // projects — typically dozens, not thousands) and round-tripping to the
  // server for every keystroke would be sluggish.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = projects;
    if (q) {
      rows = rows.filter((p) =>
        [
          p.vesselName,
          PROJECT_TYPE_LABELS[p.projectType] ?? p.projectType,
          p.region,
          STAGE_LABELS[p.stage] ?? p.stage,
          p.remarks,
          p.proposedDate,
        ]
          .map((x) => (x ?? '').toString().toLowerCase())
          .some((s) => s.includes(q)),
      );
    }
    const dir = sort.dir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sort.col) {
        case 'srNo':
          // Sr no is implicit row order — fall back to vessel name + date.
          av = `${a.vesselName}_${a.proposedDate || ''}`;
          bv = `${b.vesselName}_${b.proposedDate || ''}`;
          break;
        case 'vesselName':
          av = a.vesselName.toLowerCase();
          bv = b.vesselName.toLowerCase();
          break;
        case 'projectType':
          av = (PROJECT_TYPE_LABELS[a.projectType] ?? a.projectType).toLowerCase();
          bv = (PROJECT_TYPE_LABELS[b.projectType] ?? b.projectType).toLowerCase();
          break;
        case 'region':
          av = (a.region ?? '').toLowerCase();
          bv = (b.region ?? '').toLowerCase();
          break;
        case 'proposedDate':
          // Empty dates sort to the end ascending, start descending.
          av = a.proposedDate || '￿';
          bv = b.proposedDate || '￿';
          break;
        case 'stage':
          av = STAGES.indexOf(a.stage);
          bv = STAGES.indexOf(b.stage);
          break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return rows;
  }, [projects, search, sort]);

  function toggleSort(col: SortColumn) {
    setSort((curr) =>
      curr.col === col
        ? { col, dir: curr.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'asc' },
    );
  }

  function downloadCSV() {
    const header = [
      'Sr no',
      'Ship Name',
      'Project Type',
      'Proposed Region',
      'Proposed dates',
      'Project Stage',
      'Report uploaded 1 (pdf or audio)',
      'Report uploaded 2',
      'Report uploaded 3',
      'Feedback from ship',
      'Remarks by company',
    ];
    const rows = visible.map((p, i) => [
      String(i + 1),
      p.vesselName,
      PROJECT_TYPE_LABELS[p.projectType] ?? p.projectType,
      p.region ?? '',
      p.proposedDate ?? '',
      STAGE_LABELS[p.stage] ?? p.stage,
      p.finalReports?.[0]?.fileName ?? '',
      p.finalReports?.[1]?.fileName ?? '',
      p.finalReports?.[2]?.fileName ?? '',
      (p.feedback ?? []).map((f) => f.fileName).join('; '),
      p.remarks ?? '',
    ]);
    const csv = [header, ...rows].map((r) => r.map(escapeCSV).join(',')).join('\n');
    // BOM so Excel auto-detects UTF-8 (handles non-ASCII vessel names cleanly).
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `${slug(clientName)}-projects-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // The table itself — extracted as a render function so we can share it
  // between the inline card and the fullscreen overlay without prop-drilling.
  const tableMarkup = (
    <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: fullscreen ? 'calc(100vh - 12rem)' : undefined }}>
      <table className="w-full text-base">
        <thead className="sticky top-0 z-10 bg-navy-50 shadow-[inset_0_-1px_0_0_rgba(189,205,224,1)]">
          <tr className="text-left text-sm font-semibold uppercase tracking-wider text-navy-700">
            <SortableTH col="srNo" sort={sort} onClick={toggleSort}>Sr no</SortableTH>
            <SortableTH col="vesselName" sort={sort} onClick={toggleSort}>Ship name</SortableTH>
            <SortableTH col="projectType" sort={sort} onClick={toggleSort}>Project type</SortableTH>
            <SortableTH col="region" sort={sort} onClick={toggleSort}>Proposed region</SortableTH>
            <SortableTH col="proposedDate" sort={sort} onClick={toggleSort}>Proposed dates</SortableTH>
            <SortableTH col="stage" sort={sort} onClick={toggleSort}>Project stage</SortableTH>
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
          {visible.length === 0 && (
            <tr>
              <td colSpan={12} className="px-6 py-12 text-center text-navy-700">
                {search.trim()
                  ? <>No rows match <span className="font-semibold text-navy-900">“{search}”</span>.</>
                  : 'No projects yet. Use “New project” to add one.'}
              </td>
            </tr>
          )}
          {visible.map((p, i) => (
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
                <label className="sr-only" htmlFor={`stage-${p.id}`}>Stage</label>
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
                  onChange={(file) =>
                    patchRow(p.id, { feedback: [...(p.feedback ?? []), file] })
                  }
                />
              </td>
              <td className="min-w-[18rem] px-4 py-3">
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
  );

  // Toolbar above the table — search + sort indicator + actions.
  const toolbar = (
    <div className="flex flex-col gap-3 border-b border-navy-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-3">
        <h2 className="font-display text-xl font-bold tracking-tightish text-navy-900">
          Audit projects
        </h2>
        <span className="av-pill">
          {visible.length}
          {search.trim() && projects.length !== visible.length ? ` of ${projects.length}` : ''} rows
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Search projects</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ship, type, region…"
            className="av-input min-w-[14rem] pl-10"
          />
        </label>
        <button
          type="button"
          onClick={downloadCSV}
          className="av-btn-secondary"
          title="Download visible rows as CSV (opens in Excel)"
        >
          <Download className="h-4 w-4" aria-hidden />
          <span>Excel</span>
        </button>
        {!fullscreen && (
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="av-btn-secondary"
            title="Open the table in fullscreen view"
          >
            <Maximize2 className="h-4 w-4" aria-hidden />
            <span>Full screen</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <section className="av-card overflow-hidden">
        {toolbar}
        {tableMarkup}
      </section>

      {fullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-navy-50">
          {/* Top bar of the fullscreen view */}
          <div className="flex items-center justify-between gap-4 border-b border-navy-200 bg-white px-6 py-4 shadow-sm">
            <div>
              <p className="av-eyebrow">Client · Excel view</p>
              <h2 className="font-display text-xl font-bold tracking-tightish text-navy-900">
                {clientName} — Audit projects
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="av-btn-secondary"
              autoFocus
              aria-label="Close fullscreen view"
            >
              <X className="h-4 w-4" aria-hidden />
              <span>Close (Esc)</span>
            </button>
          </div>
          {toolbar}
          <div className="flex-1 overflow-hidden bg-white">
            {tableMarkup}
          </div>
        </div>
      )}
    </>
  );
}

// --- helpers ---

function SortableTH({
  col,
  sort,
  onClick,
  children,
}: {
  col: SortColumn;
  sort: SortState;
  onClick: (col: SortColumn) => void;
  children: React.ReactNode;
}) {
  const active = sort.col === col;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={() => onClick(col)}
        className={`group inline-flex items-center gap-1.5 -mx-1 rounded px-1 py-0.5 hover:bg-navy-100 ${
          active ? 'text-navy-900' : 'text-navy-700'
        }`}
      >
        <span>{children}</span>
        <Icon
          className={`h-3.5 w-3.5 ${active ? 'text-teal-700' : 'text-navy-400 opacity-0 group-hover:opacity-100'}`}
          aria-hidden
        />
      </button>
    </th>
  );
}

function escapeCSV(value: string): string {
  // Quote any field containing comma, quote, newline, or leading whitespace.
  if (/[",\n\r]/.test(value) || value !== value.trim()) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}
