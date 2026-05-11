'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { BROWSER_API_URL } from '@/lib/api';
import { PROJECT_TYPE_LABELS, PROJECT_TYPES, STAGE_LABELS } from '@/lib/labels';
import type { ProjectRow } from './projects-table';

export type ExistingShip = { id: string; name: string };

// The inline "Add ship" row. Sits at the top of the projects table as a
// draft `<tr>` and lets the captain type a row directly — the way he
// works in Excel — instead of bouncing to /vessels/new + /projects/new.
//
// Ship-name autocomplete uses a native <datalist> so existing ships in
// this client are suggested as he types. If the name doesn't match any
// existing ship, the backend creates a fresh vessel in this client.
// Required fields: ship name + project type. Save button is disabled
// until both are present.
//
// File slots (Report 1/2/3, Feedback) and the Stage dropdown are
// intentionally inert here — they need a real project id to act on, and
// adding them to the draft state would let the captain start an upload
// that has nowhere to go. They unlock as soon as the row is saved.
export default function DraftRow({
  clientId,
  shipsList,
  onSaved,
  onCancel,
}: {
  clientId: string;
  shipsList: ExistingShip[];
  onSaved: (row: ProjectRow) => void;
  onCancel: () => void;
}) {
  const [shipName, setShipName] = useState('');
  const [projectType, setProjectType] = useState('');
  const [region, setRegion] = useState('');
  const [proposedDate, setProposedDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = shipName.trim().length > 0 && projectType.length > 0 && !saving;
  const listId = `ships-${clientId}`;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`${BROWSER_API_URL}/clients/${clientId}/audit-rows`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shipName: shipName.trim(),
        projectType,
        region: region.trim(),
        proposedDate,
        remarks: remarks.trim(),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSaving(false);
      setError(body.error ?? 'Could not save the row.');
      return;
    }
    const body = await res.json();
    setSaving(false);
    onSaved(body.project as ProjectRow);
  }

  return (
    <tr className="align-top bg-teal-50/50 ring-2 ring-teal-200 ring-inset">
      <td className="whitespace-nowrap px-4 py-3">
        <span className="av-pill-teal">New</span>
      </td>
      <td className="px-4 py-3">
        <input
          autoFocus
          list={listId}
          value={shipName}
          onChange={(e) => setShipName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
          }}
          className="av-input min-w-[12rem]"
          placeholder="Ship name"
          aria-label="Ship name"
        />
        <datalist id={listId}>
          {shipsList.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
      </td>
      <td className="px-4 py-3">
        <select
          required
          value={projectType}
          onChange={(e) => setProjectType(e.target.value)}
          className="av-input min-w-[14rem]"
          aria-label="Project type"
        >
          <option value="">Select type…</option>
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>
              {PROJECT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="av-input min-w-[10rem]"
          placeholder="(optional)"
          aria-label="Proposed region"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="date"
          value={proposedDate}
          onChange={(e) => setProposedDate(e.target.value)}
          className="av-input"
          aria-label="Proposed date"
        />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm italic text-navy-600">
        {STAGE_LABELS.ENQUIRY}
      </td>
      <td className="px-4 py-3 text-center text-sm text-navy-400" colSpan={4}>
        Reports and feedback unlock after the row is saved.
      </td>
      <td className="min-w-[16rem] px-4 py-3">
        <input
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="av-input min-w-[14rem]"
          placeholder="(optional)"
          aria-label="Remarks"
        />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="av-btn-primary"
              title={canSave ? 'Save row (Enter)' : 'Ship name and project type are required'}
            >
              <Check className="h-4 w-4" aria-hidden />
              <span>{saving ? 'Saving…' : 'Save'}</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-navy-200 bg-white text-navy-700 hover:bg-navy-50 disabled:opacity-50"
              aria-label="Cancel adding row"
              title="Cancel (Esc)"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {error && <p className="max-w-[14rem] text-right text-sm text-red-700">{error}</p>}
        </div>
      </td>
    </tr>
  );
}
