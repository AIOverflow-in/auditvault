import { redirect } from 'next/navigation';
import { Anchor } from 'lucide-react';
import { readSession } from '@/lib/session';
import LoginForm from './login-form';

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect('/dashboard');

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Hero panel — full bleed on desktop, hidden on mobile. The maritime
          gradient + a quiet wordmark says "professional", not flashy. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-maritime-hero p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Anchor className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <p className="font-display text-xl font-bold leading-tight">AuditVault</p>
            <p className="text-xs uppercase tracking-[0.2em] text-teal-200">
              by Nivyash
            </p>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="av-eyebrow text-teal-200/90">Maritime audit management</p>
          <h1 className="mt-4 font-display text-5xl font-bold tracking-display leading-[1.05]">
            Every audit, every report,
            <br />
            every ship — in one place.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-navy-100/90">
            Replace email and WeTransfer. Track each inspection from enquiry to
            sign-off; share reports with the right vessels, securely.
          </p>
        </div>

        <p className="text-sm text-navy-200/80">
          Built for Nivyash Maritime Consultancy.
        </p>

        {/* Soft compass-rose motif in the corner — single SVG, never drawn
            attention to itself but adds "this was made with care". */}
        <svg
          aria-hidden
          className="pointer-events-none absolute -right-20 -bottom-24 h-96 w-96 opacity-[0.07]"
          viewBox="0 0 200 200"
          fill="none"
        >
          <circle cx="100" cy="100" r="98" stroke="white" strokeWidth="1" />
          <circle cx="100" cy="100" r="70" stroke="white" strokeWidth="1" />
          <circle cx="100" cy="100" r="40" stroke="white" strokeWidth="1" />
          <path d="M100 0 L105 95 L100 100 L95 95 Z" fill="white" />
          <path d="M100 200 L105 105 L100 100 L95 105 Z" fill="white" />
          <path d="M0 100 L95 95 L100 100 L95 105 Z" fill="white" />
          <path d="M200 100 L105 95 L100 100 L105 105 Z" fill="white" />
        </svg>
      </aside>

      {/* Form panel */}
      <section className="flex items-center justify-center bg-white p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile-only brand mark */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-white">
              <Anchor className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <p className="font-display text-xl font-bold leading-tight text-navy-900">
                AuditVault
              </p>
              <p className="text-xs uppercase tracking-[0.18em] text-teal-700">
                by Nivyash
              </p>
            </div>
          </div>

          <h2 className="font-display text-3xl font-bold tracking-display text-navy-900">
            Welcome back
          </h2>
          <p className="mt-2 text-navy-700">
            Sign in to continue to your audit workspace.
          </p>

          <div className="mt-8">
            <LoginForm />
          </div>

          <p className="mt-10 text-sm text-navy-600">
            Trouble signing in? Reach the Nivyash office at{' '}
            <a
              href="mailto:admin@nivyash.com"
              className="font-semibold text-teal-700 hover:underline"
            >
              admin@nivyash.com
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
