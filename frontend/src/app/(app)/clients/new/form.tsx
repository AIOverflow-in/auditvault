'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { API_URL } from '@/lib/api';

export default function NewClientForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await fetch(`${API_URL}/clients`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Could not save the client.');
        return;
      }
      const body = await res.json();
      router.replace(`/clients/${body.client.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="av-card p-6 space-y-5">
      <div>
        <label htmlFor="name" className="av-label">
          Company name
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
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending || !name.trim()} className="av-btn-primary">
        <Plus className="h-5 w-5" aria-hidden />
        {pending ? 'Saving…' : 'Save client'}
      </button>
    </form>
  );
}
