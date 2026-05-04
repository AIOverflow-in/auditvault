'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { BROWSER_API_URL } from '@/lib/api';

export type ClientWithVessels = {
  id: string;
  name: string;
  vessels: { id: string; name: string }[];
};

type Org = { id: string; name: string; type: string };

const ROLE_OPTIONS: { value: string; label: string; orgType: 'NIVYASH' | 'CLIENT' }[] = [
  { value: 'ADMIN', label: 'Admin (Nivyash)', orgType: 'NIVYASH' },
  { value: 'STAFF', label: 'Staff (Nivyash)', orgType: 'NIVYASH' },
  { value: 'CLIENT_ADMIN', label: 'Client admin', orgType: 'CLIENT' },
  { value: 'CLIENT_VIEWER', label: 'Client viewer', orgType: 'CLIENT' },
];

const NIVYASH_ORG_PLACEHOLDER = 'NIVYASH';

export default function NewUserForm({
  orgs,
  clients,
  initialClientId,
}: {
  orgs: Org[];
  clients: ClientWithVessels[];
  initialClientId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('CLIENT_VIEWER');
  const [organizationId, setOrganizationId] = useState(initialClientId || '');
  const [vesselIds, setVesselIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const selectedOrgType = useMemo(() => {
    if (organizationId === NIVYASH_ORG_PLACEHOLDER) return 'NIVYASH';
    return 'CLIENT';
  }, [organizationId]);

  const allowedRoles = useMemo(
    () => ROLE_OPTIONS.filter((r) => r.orgType === selectedOrgType),
    [selectedOrgType],
  );

  // Whenever org changes, snap role to a compatible value.
  function changeOrg(next: string) {
    setOrganizationId(next);
    const allowed = ROLE_OPTIONS.filter(
      (r) => r.orgType === (next === NIVYASH_ORG_PLACEHOLDER ? 'NIVYASH' : 'CLIENT'),
    );
    if (!allowed.find((r) => r.value === role)) setRole(allowed[0].value);
    // Reset vessel grants when org changes — they only apply to the new org.
    setVesselIds([]);
  }

  const isClientRole = role === 'CLIENT_ADMIN' || role === 'CLIENT_VIEWER';
  const orgVessels =
    selectedOrgType === 'CLIENT' ? clients.find((c) => c.id === organizationId)?.vessels ?? [] : [];

  function toggleVessel(id: string) {
    setVesselIds((curr) => (curr.includes(id) ? curr.filter((v) => v !== id) : [...curr, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!organizationId) {
      setError('Choose an organisation.');
      return;
    }
    // For Nivyash placeholder, we need a real organisation id — there's
    // exactly one Nivyash org, but the API doesn't expose it directly. We
    // surface this case in the option list as a special id and resolve it
    // by asking the admin to use the seeded Nivyash org. For now, block.
    if (organizationId === NIVYASH_ORG_PLACEHOLDER) {
      setError('Nivyash organisation must be selected from a real id (run the seed script first).');
      return;
    }

    const payload: Record<string, unknown> = {
      name,
      email,
      password,
      role,
      organizationId,
    };
    if (isClientRole && vesselIds.length > 0) payload.vesselIds = vesselIds;

    start(async () => {
      const res = await fetch(`${BROWSER_API_URL}/users`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Could not create user.');
        return;
      }
      const body = await res.json();
      router.replace(isClientRole ? `/users/${body.user.id}` : '/users');
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="av-card space-y-5 p-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="av-label">
            Name
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
          <label htmlFor="email" className="av-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="av-input"
          />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="av-label">
          Temporary password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="av-input"
        />
        <p className="mt-1 text-sm text-navy-700">At least 8 characters. The user can change it after first login.</p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="org" className="av-label">
            Organisation
          </label>
          <select
            id="org"
            required
            value={organizationId}
            onChange={(e) => changeOrg(e.target.value)}
            className="av-input"
          >
            <option value="">Select…</option>
            {orgs
              .filter((o) => o.id !== NIVYASH_ORG_PLACEHOLDER)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label htmlFor="role" className="av-label">
            Role
          </label>
          <select
            id="role"
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="av-input"
          >
            {allowedRoles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isClientRole && orgVessels.length > 0 && (
        <fieldset className="rounded-lg border border-navy-100 p-4">
          <legend className="px-2 text-sm font-semibold uppercase tracking-wider text-navy-700">
            Initial ship access
          </legend>
          <p className="mb-3 text-sm text-navy-700">
            Select which ships this user can see. You can change this later from the user’s page.
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {orgVessels.map((v) => (
              <li key={v.id}>
                <label className="flex min-h-tap items-center gap-3 rounded-lg border border-navy-100 bg-white px-3 hover:bg-navy-50">
                  <input
                    type="checkbox"
                    checked={vesselIds.includes(v.id)}
                    onChange={() => toggleVessel(v.id)}
                    className="h-5 w-5 rounded border-navy-300 text-teal-600 focus:ring-teal-600"
                  />
                  <span className="text-base font-semibold text-navy-900">{v.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className="av-btn-primary">
        <Plus className="h-5 w-5" aria-hidden />
        {pending ? 'Saving…' : 'Create user'}
      </button>
    </form>
  );
}
