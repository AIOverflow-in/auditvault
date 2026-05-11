'use client';

import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { BROWSER_API_URL } from '@/lib/api';
import type { ProjectRow } from './projects-table';

// Same pattern as RegionCell, but for the Proposed dates column. Empty
// string clears the date on the backend (PATCH accepts an empty string
// and converts to NULL via DateFromString).
export default function ProposedDateCell({
  project,
  canEdit,
  onChange,
}: {
  project: ProjectRow;
  canEdit: boolean;
  onChange: (proposedDate: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(project.proposedDate ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`${BROWSER_API_URL}/projects/${project.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposedDate: value }),
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

  if (!canEdit) {
    return <span className="whitespace-nowrap text-navy-800">{project.proposedDate || '—'}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(project.proposedDate ?? '');
          setEditing(true);
        }}
        className="group inline-flex items-center gap-1.5 -mx-1 whitespace-nowrap rounded px-1 py-0.5 text-left text-navy-800 hover:bg-navy-100"
        title="Edit proposed date"
      >
        <span>{project.proposedDate || <span className="text-navy-400">—</span>}</span>
        <Pencil className="h-3.5 w-3.5 text-navy-400 opacity-0 group-hover:opacity-100" aria-hidden />
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="av-input"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
          aria-label="Save proposed date"
        >
          <Check className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-navy-200 bg-white text-navy-700 hover:bg-navy-50"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
