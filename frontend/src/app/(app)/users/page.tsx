import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { fetchAPI, requireRole } from '@/lib/session';
import { ROLE_LABELS } from '@/lib/labels';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  organizationName: string;
  organizationType: string;
  createdAt: string;
};

export default async function UsersPage() {
  await requireRole(['ADMIN']);
  const data = await fetchAPI<{ users: User[] }>('/users').catch(() => ({ users: [] }));
  const users = data.users ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy-900">Users</h1>
          <p className="text-navy-700">{users.length} user{users.length === 1 ? '' : 's'} across all organisations</p>
        </div>
        <Link href="/users/new" className="av-btn-primary">
          <Plus className="h-5 w-5" aria-hidden />
          Add user
        </Link>
      </header>

      {users.length === 0 ? (
        <div className="av-card p-10 text-center">
          <Users className="mx-auto mb-4 h-10 w-10 text-navy-400" aria-hidden />
          <p className="text-navy-700">No users yet.</p>
        </div>
      ) : (
        <div className="av-card overflow-hidden">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50 text-left text-sm font-semibold uppercase tracking-wider text-navy-700">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Organisation</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 sr-only">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-navy-50/50">
                  <td className="px-4 py-3 font-semibold text-navy-900">{u.name}</td>
                  <td className="px-4 py-3 text-navy-800">{u.email}</td>
                  <td className="px-4 py-3 text-navy-800">{u.organizationName}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-navy-100 px-3 py-1 text-sm font-semibold text-navy-800">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy-700">{u.createdAt.split('T')[0]}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {u.organizationType === 'CLIENT' ? (
                      <Link
                        href={`/users/${u.id}`}
                        className="inline-flex min-h-tap items-center gap-2 rounded-lg border border-navy-200 px-3 text-base font-semibold text-navy-800 hover:bg-navy-50"
                      >
                        Manage access
                      </Link>
                    ) : (
                      <span className="text-sm text-navy-600">Sees everything</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
