import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { isNivyashRole } from '@/lib/labels';

// "Dashboard" in the sidebar is the captain's home. There is no longer a
// dedicated stat-cards page — the Excel-style client view shows everything
// he cares about. So this route just redirects:
//   - Nivyash admin/staff → list of all client companies (/clients)
//   - Client admin/viewer → their own company's page (/clients/{orgId}),
//     which is the same Excel-style table, prefilled with only the ships
//     they have grants on
export default async function DashboardPage() {
  const session = await requireSession();
  if (isNivyashRole(session.user.role)) {
    redirect('/clients');
  }
  redirect(`/clients/${session.user.organizationId}`);
}
