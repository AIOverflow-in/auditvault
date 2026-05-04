'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { BROWSER_API_URL } from '@/lib/api';

export default function NewVesselForm({
  clients,
  initialClientId,
}: {
  clients: { id: string; name: string }[];
  initialClientId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [organizationId, setOrganizationId] = useState(initialClientId);
  const [imoNumber, setImoNumber] = useState('');
  const [flag, setFlag] = useState('');
  const [vesselType, setVesselType] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await fetch(`${BROWSER_API_URL}/vessels`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, organizationId, imoNumber, flag, vesselType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Could not save the ship.');
        return;
      }
      const body = await res.json();
      router.replace(`/vessels/${body.vessel.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="av-card space-y-5 p-6">
      <div>
        <label htmlFor="name" className="av-label">
          Ship name
        </label>
        <input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="av-input"
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="org" className="av-label">
          Owner (client company)
        </label>
        <select
          id="org"
          required
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          className="av-input"
        >
          <option value="">Select a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor="imo" className="av-label">
            IMO number
          </label>
          <input
            id="imo"
            value={imoNumber}
            onChange={(e) => setImoNumber(e.target.value)}
            className="av-input"
            placeholder="e.g. 9876543"
          />
        </div>
        <div>
          <label htmlFor="flag" className="av-label">
            Flag
          </label>
          <input
            id="flag"
            value={flag}
            onChange={(e) => setFlag(e.target.value)}
            className="av-input"
            placeholder="e.g. Singapore"
          />
        </div>
        <div>
          <label htmlFor="type" className="av-label">
            Type
          </label>
          <input
            id="type"
            value={vesselType}
            onChange={(e) => setVesselType(e.target.value)}
            className="av-input"
            placeholder="e.g. VLCC Tanker"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending || !name.trim() || !organizationId} className="av-btn-primary">
        <Plus className="h-5 w-5" aria-hidden />
        {pending ? 'Saving…' : 'Register ship'}
      </button>
    </form>
  );
}
