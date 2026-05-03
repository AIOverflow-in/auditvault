'use client';

import { useRef, useState } from 'react';
import { Download, Upload, FileText } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { uploadProjectFile } from '@/lib/upload';
import type { FileBrief, ProjectRow } from './projects-table';

// One slot of the "Report uploaded" column on the captain's sheet — the
// Excel reserves three of these per row. slotIndex is 0-based; if a file
// already exists at that index in finalReports we render a download chip;
// otherwise we render an Upload button. The third slot also surfaces any
// 4th+ uploads as "+N more" stacked underneath, so we never lose files
// the captain happens to add.
export default function ReportCell({
  project,
  slotIndex,
  onChange,
}: {
  project: ProjectRow;
  slotIndex: 0 | 1 | 2;
  onChange: (file: FileBrief) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reports = project.finalReports ?? [];
  const file = reports[slotIndex];
  // The third slot also shows any overflow files (4th, 5th, …) inline.
  const overflow = slotIndex === 2 ? reports.slice(3) : [];

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      const result = await uploadProjectFile(project.id, f, 'FINAL_REPORT');
      onChange({
        id: result.id,
        fileName: result.fileName,
        fileType: result.fileType,
        fileSize: result.fileSize,
        category: result.category,
        createdAt: result.createdAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function downloadChip(f: FileBrief) {
    return (
      <a
        href={`${API_URL}/projects/${project.id}/files/${f.id}/download`}
        target="_blank"
        rel="noopener"
        className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 text-base font-semibold text-teal-800 hover:bg-teal-100"
      >
        <FileText className="h-4 w-4" aria-hidden />
        <span className="max-w-[12rem] truncate">{f.fileName}</span>
        <Download className="h-4 w-4" aria-hidden />
      </a>
    );
  }

  return (
    <div className="space-y-1.5">
      {file ? (
        <>
          {downloadChip(file)}
          {overflow.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-teal-700 hover:underline">
                +{overflow.length} more
              </summary>
              <ul className="mt-1.5 space-y-1.5">
                {overflow.map((f) => (
                  <li key={f.id}>{downloadChip(f)}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-navy-400">—</p>
          <input
            ref={inputRef}
            type="file"
            onChange={pick}
            className="sr-only"
            id={`upload-report-${project.id}-${slotIndex}`}
          />
          <label
            htmlFor={`upload-report-${project.id}-${slotIndex}`}
            className={`av-btn-secondary cursor-pointer ${busy ? 'opacity-60 cursor-wait' : ''}`}
          >
            <Upload className="h-4 w-4" aria-hidden />
            {busy ? 'Uploading…' : 'Upload'}
          </label>
        </>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
