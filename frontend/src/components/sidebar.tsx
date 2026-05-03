'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Anchor, LayoutDashboard, Users, LogOut, ScrollText } from 'lucide-react';
import { cn } from '@/lib/cn';
import { isClientRole, isNivyashRole, ROLE_LABELS } from '@/lib/labels';

type Item = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  allow: 'all' | 'nivyash' | 'admin';
};

// Yatendra asked for a single landing entry. Dashboard is the new label for
// what was the Clients list — for Nivyash users, /dashboard redirects to the
// list of all client companies; for client users it redirects directly to
// their own company page (since they only have one). Ships and Projects no
// longer have top-level entries — they're reached via in-page links from
// the client view, which matches the Excel mental model the captain works in.
const items: Item[] = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard, allow: 'all' },
  { href: '/users',      label: 'Users',      icon: Users,           allow: 'admin' },
  { href: '/audit-logs', label: 'Audit log',  icon: ScrollText,      allow: 'admin' },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

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

  const subtitle = isClientRole(user.role) ? user.organizationName : 'Nivyash Maritime';

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col bg-navy-950 text-navy-100">
      {/* Brand block */}
      <div className="flex items-center gap-3 border-b border-white/[0.08] px-6 py-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-md shadow-teal-900/40">
          <Anchor className="h-5 w-5 text-white" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold tracking-tightish leading-tight text-white">
            AuditVault
          </p>
          <p className="truncate text-[11px] uppercase tracking-[0.18em] text-teal-300/90">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <ul className="space-y-1">
          {visible.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + '/');
            const Icon = it.icon;
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={cn(
                    'group relative flex min-h-tap items-center gap-3 rounded-lg px-3 text-base font-semibold transition-colors',
                    active
                      ? 'bg-teal-600/95 text-white shadow-sm shadow-teal-900/50'
                      : 'text-navy-100 hover:bg-white/[0.06] hover:text-white',
                  )}
                >
                  {/* Subtle left accent on the active item — adds an elegant
                      "you are here" without a bright color block. */}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute -left-3 top-1/2 h-6 -translate-y-1/2 rounded-r-full bg-teal-300"
                      style={{ width: '3px' }}
                    />
                  )}
                  <Icon className="h-5 w-5 flex-shrink-0" aria-hidden />
                  <span>{it.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User block */}
      <div className="border-t border-white/[0.08] px-3 py-4">
        <div className="mb-3 flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-sm font-bold text-white ring-1 ring-white/10">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-xs text-navy-200">
              {ROLE_LABELS[user.role] ?? user.role}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="flex min-h-tap w-full items-center gap-3 rounded-lg px-3 text-base font-semibold text-navy-100 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-60"
        >
          <LogOut className="h-5 w-5" aria-hidden />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </aside>
  );
}
