'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2, Upload, FileText } from 'lucide-react';
import { BROWSER_API_URL } from '@/lib/api';
import { FILE_CATEGORIES, FILE_CATEGORY_LABELS } from '@/lib/labels';
import { uploadProjectFile, type UploadCategory } from '@/lib/upload';

export type ProjectFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: string;
  createdAt: string;
  uploadedByName: string;
};

export default function FilePanel({
  projectId,
  initialFiles,
  isClient,
  isAdmin,
}: {
  projectId: string;
  initialFiles: ProjectFile[];
  isClient: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState(initialFiles);
  const [category, setCategory] = useState<UploadCategory>(isClient ? 'FEEDBACK' : 'FINAL_REPORT');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allowedCategories = isClient ? ['FEEDBACK'] : FILE_CATEGORIES;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: f.size });
    try {
      const result = await uploadProjectFile(projectId, f, category, (loaded, total) =>
        setProgress({ done: loaded, total }),
      );
      setFiles((curr) => [
        {
          id: result.id,
          fileName: result.fileName,
          fileType: result.fileType,
          fileSize: result.fileSize,
          category: result.category,
          createdAt: result.createdAt,
          uploadedByName: 'You',
        },
        ...curr,
      ]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function softDelete(fileId: string) {
    if (!confirm('Delete this file? It will be removed from the project. Admins can restore it later.')) {
      return;
    }
    const res = await fetch(`${BROWSER_API_URL}/projects/${projectId}/files/${fileId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? 'Could not delete the file.');
      return;
    }
    setFiles((curr) => curr.filter((f) => f.id !== fileId));
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="cat" className="av-label">
            Category
          </label>
          <select
            id="cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as UploadCategory)}
            disabled={busy || allowedCategories.length === 1}
            className="av-input min-w-[14rem]"
          >
            {allowedCategories.map((c) => (
              <option key={c} value={c}>
                {FILE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <input ref={fileInput} type="file" id="file" onChange={pick} className="sr-only" />
        <label
          htmlFor="file"
          className={`av-btn-primary cursor-pointer ${busy ? 'cursor-wait opacity-60' : ''}`}
        >
          <Upload className="h-5 w-5" aria-hidden />
          {busy ? 'Uploading…' : 'Upload file'}
        </label>
      </div>

      {progress && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-navy-100">
            <div
              className="h-full bg-teal-600 transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-sm text-navy-700">
            {fmtBytes(progress.done)} of {fmtBytes(progress.total)} uploaded
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </p>
      )}

      {files.length === 0 ? (
        <p className="py-6 text-center text-navy-700">No documents uploaded yet.</p>
      ) : (
        <ul className="divide-y divide-navy-100">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-100 text-navy-700">
                <FileText className="h-5 w-5" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-navy-900 truncate">{f.fileName}</p>
                <p className="text-sm text-navy-700">
                  {FILE_CATEGORY_LABELS[f.category]} · {fmtBytes(f.fileSize)} · uploaded by {f.uploadedByName}
                </p>
              </div>
              <a
                href={`${BROWSER_API_URL}/projects/${projectId}/files/${f.id}/download`}
                target="_blank"
                rel="noopener"
                className="av-btn-secondary"
              >
                <Download className="h-5 w-5" aria-hidden /> Download
              </a>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => softDelete(f.id)}
                  className="av-btn-secondary text-red-700 hover:bg-red-50"
                  aria-label={`Delete ${f.fileName}`}
                >
                  <Trash2 className="h-5 w-5" aria-hidden /> Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fmtBytes(n: number): string {
  if (!n) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}
