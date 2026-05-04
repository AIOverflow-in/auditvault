'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BROWSER_API_URL } from '@/lib/api';
import { STAGE_LABELS, STAGES } from '@/lib/labels';

export default function StageUpdater({
  projectId,
  currentStage,
}: {
  projectId: string;
  currentStage: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState(currentStage);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: string) {
    if (next === stage) return;
    const previous = stage;
    setStage(next);
    setError(null);
    start(async () => {
      const res = await fetch(`${BROWSER_API_URL}/projects/${projectId}/stage`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStage(previous);
        setError(body.error ?? 'Could not update stage.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="stage" className="sr-only">
        Update stage
      </label>
      <select
        id="stage"
        value={stage}
        onChange={(e) => change(e.target.value)}
        disabled={pending}
        className="av-input min-w-[14rem]"
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s]}
          </option>
        ))}
      </select>
      {error && <span className="text-sm text-red-700">{error}</span>}
    </div>
  );
}
