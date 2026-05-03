'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { PROJECT_TYPE_LABELS, PROJECT_TYPES } from '@/lib/labels';

export default function NewProjectForm({
  vessels,
  initialVesselId,
}: {
  vessels: { id: string; name: string; organizationName: string }[];
  initialVesselId: string;
}) {
  const router = useRouter();
  const [vesselId, setVesselId] = useState(initialVesselId);
  const [projectType, setProjectType] = useState('');
  const [region, setRegion] = useState('');
  const [proposedDate, setProposedDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vesselId, projectType, region, proposedDate, remarks }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Could not create the project.');
        return;
      }
      const body = await res.json();
      router.replace(`/projects/${body.project.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="av-card space-y-5 p-6">
      <div>
        <label htmlFor="vessel" className="av-label">
          Ship
        </label>
        <select
          id="vessel"
          required
          value={vesselId}
          onChange={(e) => setVesselId(e.target.value)}
          className="av-input"
        >
          <option value="">Select a ship…</option>
          {vessels.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} — {v.organizationName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="type" className="av-label">
          Project type
        </label>
        <select
          id="type"
          required
          value={projectType}
          onChange={(e) => setProjectType(e.target.value)}
          className="av-input"
        >
          <option value="">Select project type…</option>
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>
              {PROJECT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="region" className="av-label">
            Region / location
          </label>
          <input
            id="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="av-input"
            placeholder="e.g. Singapore Strait"
          />
        </div>
        <div>
          <label htmlFor="date" className="av-label">
            Proposed date
          </label>
          <input
            id="date"
            type="date"
            value={proposedDate}
            onChange={(e) => setProposedDate(e.target.value)}
            className="av-input"
          />
        </div>
      </div>
      <div>
        <label htmlFor="remarks" className="av-label">
          Internal remarks (Nivyash only)
        </label>
        <textarea
          id="remarks"
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="av-input min-h-[6rem] py-2"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending || !vesselId || !projectType} className="av-btn-primary">
        <Plus className="h-5 w-5" aria-hidden />
        {pending ? 'Saving…' : 'Create project'}
      </button>
    </form>
  );
}
