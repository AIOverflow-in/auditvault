'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { BROWSER_API_URL } from '@/lib/api';

export type Note = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

export default function NotesPanel({
  projectId,
  initialNotes,
  canEdit,
}: {
  projectId: string;
  initialNotes: Note[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    start(async () => {
      const res = await fetch(`${BROWSER_API_URL}/projects/${projectId}/notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody.error ?? 'Could not add note.');
        return;
      }
      const created = (await res.json()) as { note: Note };
      setNotes((curr) => [{ ...created.note, authorName: 'You' }, ...curr]);
      setBody('');
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {canEdit && (
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="note" className="av-label">
            Add a note
          </label>
          <textarea
            id="note"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="av-input min-h-[6rem] py-2"
            placeholder="Internal notes are visible to Nivyash only."
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={pending || !body.trim()} className="av-btn-primary">
            <Send className="h-5 w-5" aria-hidden />
            {pending ? 'Saving…' : 'Add note'}
          </button>
        </form>
      )}

      {notes.length === 0 ? (
        <p className="py-6 text-center text-navy-700">No internal notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-navy-100 bg-navy-50 p-4">
              <p className="whitespace-pre-wrap text-base text-navy-900">{n.body}</p>
              <p className="mt-2 text-sm text-navy-700">
                {n.authorName} · {new Date(n.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
