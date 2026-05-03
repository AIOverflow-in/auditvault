'use client';

import { useRef, useState } from 'react';
import { Download, Upload, FileText } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { uploadProjectFile } from '@/lib/upload';
import type { FileBrief, ProjectRow } from './projects-table';

export default function ReportCell({
  project,
  onChange,
}: {
  project: ProjectRow;
  onChange: (file: FileBrief) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reports = project.finalReports ?? [];

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

  return (
    <div className="space-y-2">
      {reports.length > 0 ? (
        <ul className="space-y-1.5">
          {reports.map((r) => (
            <li key={r.id}>
              <a
                href={`${API_URL}/projects/${project.id}/files/${r.id}/download`}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 text-base font-semibold text-teal-800 hover:bg-teal-100"
              >
                <FileText className="h-4 w-4" aria-hidden />
                <span className="max-w-[14rem] truncate">{r.fileName}</span>
                <Download className="h-4 w-4" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-navy-400">No report uploaded</p>
      )}
      <input ref={inputRef} type="file" onChange={pick} className="sr-only" id={`upload-report-${project.id}`} />
      <label
        htmlFor={`upload-report-${project.id}`}
        className={`av-btn-secondary cursor-pointer ${busy ? 'opacity-60 cursor-wait' : ''}`}
      >
        <Upload className="h-4 w-4" aria-hidden />
        {busy ? 'Uploading…' : reports.length > 0 ? 'Upload another' : 'Upload report'}
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
