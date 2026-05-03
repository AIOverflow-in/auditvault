'use client';

import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { API_URL } from '@/lib/api';
import type { ProjectRow } from './projects-table';

export default function RemarksCell({
  project,
  onChange,
}: {
  project: ProjectRow;
  onChange: (remarks: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(project.remarks ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`${API_URL}/projects/${project.id}/remarks`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: value }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not save.');
      return;
    }
    onChange(value);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-2">
        <p className="flex-1 text-base text-navy-800 whitespace-pre-wrap">
          {project.remarks ? project.remarks : <span className="text-navy-400">—</span>}
        </p>
        <button
          type="button"
          onClick={() => {
            setValue(project.remarks ?? '');
            setEditing(true);
          }}
          className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-navy-200 px-3 text-sm font-semibold text-navy-700 hover:bg-navy-50"
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="sr-only" htmlFor={`remarks-${project.id}`}>Remarks for {project.vesselName}</label>
      <textarea
        id={`remarks-${project.id}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        className="av-input min-h-[6rem] py-2"
        autoFocus
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving} className="av-btn-primary">
          <Check className="h-4 w-4" aria-hidden />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="av-btn-secondary">
          <X className="h-4 w-4" aria-hidden /> Cancel
        </button>
      </div>
    </div>
  );
}
