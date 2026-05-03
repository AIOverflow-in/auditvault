'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { API_URL } from '@/lib/api';

export type Vessel = {
  id: string;
  name: string;
  imoNumber: string;
  flag: string;
  vesselType: string;
  organizationId: string;
  organizationName: string;
};

export default function GrantsEditor({
  userId,
  vessels,
  initialGrantedIds,
}: {
  userId: string;
  vessels: Vessel[];
  initialGrantedIds: string[];
}) {
  const router = useRouter();
  const [granted, setGranted] = useState<string[]>(initialGrantedIds);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(id: string) {
    setGranted((curr) => (curr.includes(id) ? curr.filter((v) => v !== id) : [...curr, id]));
  }

  function selectAll() {
    setGranted(vessels.map((v) => v.id));
  }
  function clearAll() {
    setGranted([]);
  }

  function save() {
    setError(null);
    setSavedAt(null);
    start(async () => {
      const res = await fetch(`${API_URL}/users/${userId}/vessels`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vesselIds: granted }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Could not save changes.');
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  if (vessels.length === 0) {
    return (
      <p className="text-navy-700">
        This client has no ships registered yet. Add ships to the client first, then come back to grant access.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={selectAll} className="av-btn-secondary">
          Select all
        </button>
        <button type="button" onClick={clearAll} className="av-btn-secondary">
          Clear
        </button>
        <p className="ml-auto text-sm text-navy-700">
          {granted.length} of {vessels.length} ships granted
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {vessels.map((v) => (
          <li key={v.id}>
            <label className="flex min-h-tap items-center gap-3 rounded-lg border border-navy-100 bg-white px-3 hover:bg-navy-50">
              <input
                type="checkbox"
                checked={granted.includes(v.id)}
                onChange={() => toggle(v.id)}
                className="h-5 w-5 rounded border-navy-300 text-teal-600 focus:ring-teal-600"
              />
              <span className="flex-1">
                <span className="block text-base font-semibold text-navy-900">{v.name}</span>
                {v.imoNumber && <span className="block text-sm text-navy-700">IMO {v.imoNumber}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </p>
      )}
      {savedAt && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
          Saved at {savedAt}.
        </p>
      )}

      <button type="button" onClick={save} disabled={pending} className="av-btn-primary">
        <Save className="h-5 w-5" aria-hidden />
        {pending ? 'Saving…' : 'Save access'}
      </button>
    </div>
  );
}
