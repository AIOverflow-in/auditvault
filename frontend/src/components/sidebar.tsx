'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Anchor, LayoutDashboard, Ship, Building2, Users, LogOut, FolderKanban, ScrollText } from 'lucide-react';
import { cn } from '@/lib/cn';
import { isClientRole, isNivyashRole, ROLE_LABELS } from '@/lib/labels';

type Item = { href: string; label: string; icon: typeof LayoutDashboard; allow: 'all' | 'nivyash' | 'admin' };

const items: Item[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, allow: 'all' },
  { href: '/clients',   label: 'Clients',   icon: Building2,       allow: 'nivyash' },
  { href: '/vessels',   label: 'Ships',     icon: Ship,            allow: 'all' },
  { href: '/projects',  label: 'Projects',  icon: FolderKanban,    allow: 'all' },
  { href: '/users',     label: 'Users',     icon: Users,           allow: 'admin' },
  { href: '/audit-logs', label: 'Audit log', icon: ScrollText,     allow: 'admin' },
];

export default function Sidebar({
  user,
}: {
  user: { name: string; email: string; role: string; organizationName: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, start] = useTransition();

  const visible = items.filter((it) => {
    if (it.allow === 'all') return true;
    if (it.allow === 'nivyash') return isNivyashRole(user.role);
    if (it.allow === 'admin') return user.role === 'ADMIN';
    return false;
  });

  function signOut() {
    start(async () => {
      await fetch('/api/session/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    });
  }

  const userBadge = isClientRole(user.role) ? user.organizationName : 'Nivyash';

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col bg-navy-900 text-navy-100">
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600">
          <Anchor className="h-5 w-5 text-white" aria-hidden />
        </div>
        <div>
          <p className="text-lg font-bold text-white leading-tight">AuditVault</p>
          <p className="text-xs uppercase tracking-wider text-teal-400">{userBadge}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visible.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + '/');
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'flex min-h-tap items-center gap-3 rounded-lg px-3 text-base font-semibold transition-colors',
                active
                  ? 'bg-teal-600 text-white'
                  : 'text-navy-100 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" aria-hidden />
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <div className="mb-2 px-3 py-2">
          <p className="text-base font-semibold text-white truncate">{user.name}</p>
          <p className="text-sm text-navy-200 truncate">{user.email}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-teal-400">{ROLE_LABELS[user.role]}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="flex min-h-tap w-full items-center gap-3 rounded-lg px-3 text-base font-semibold text-navy-100 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
        >
          <LogOut className="h-5 w-5" aria-hidden />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </aside>
  );
}
