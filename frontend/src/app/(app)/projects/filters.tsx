'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { PROJECT_TYPE_LABELS, PROJECT_TYPES, STAGE_LABELS, STAGES } from '@/lib/labels';

export default function ProjectsFilters({
  stage,
  type,
}: {
  stage?: string;
  type?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/projects?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <label htmlFor="stage" className="av-label">
          Stage
        </label>
        <select
          id="stage"
          value={stage ?? ''}
          onChange={(e) => setParam('stage', e.target.value)}
          className="av-input min-w-[12rem]"
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
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
          value={type ?? ''}
          onChange={(e) => setParam('type', e.target.value)}
          className="av-input min-w-[14rem]"
        >
          <option value="">All types</option>
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>
              {PROJECT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      {(stage || type) && (
        <button
          type="button"
          onClick={() => router.replace('/projects')}
          className="av-btn-secondary"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
