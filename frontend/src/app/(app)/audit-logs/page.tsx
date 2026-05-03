import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchAPI, requireRole } from '@/lib/session';

type Log = {
  id: string;
  userName: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  projectId: string;
  metadata: string;
  createdAt: string;
};

export default async function AuditLogsPage() {
  await requireRole(['ADMIN']);
  const data = await fetchAPI<{ logs: Log[] }>('/audit-logs?limit=200').catch(() => ({ logs: [] }));
  const logs = data.logs ?? [];

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-base font-semibold text-teal-700 hover:underline">
        <ArrowLeft className="h-5 w-5" aria-hidden /> Back to dashboard
      </Link>
      <header>
        <h1 className="text-3xl font-bold text-navy-900">Audit log</h1>
        <p className="text-navy-700">Most recent {logs.length} entries.</p>
      </header>
      <div className="av-card overflow-hidden">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50 text-left text-sm font-semibold uppercase tracking-wider text-navy-700">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-navy-700">
                  No audit entries yet.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-navy-50/50">
                <td className="whitespace-nowrap px-4 py-3 text-navy-800">
                  {new Date(l.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-navy-900">{l.userName}</p>
                  <p className="text-sm text-navy-700">{l.userEmail}</p>
                </td>
                <td className="px-4 py-3 font-mono text-sm text-teal-800">{l.action}</td>
                <td className="px-4 py-3 text-sm text-navy-800">{l.entityType}</td>
                <td className="px-4 py-3 text-sm text-navy-700">
                  <code className="break-all">{l.metadata || '—'}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
