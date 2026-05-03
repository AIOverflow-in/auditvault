import { redirect } from 'next/navigation';
import { readSession } from '@/lib/session';
import LoginForm from './login-form';
import { Anchor } from 'lucide-react';

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect('/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-50 p-6">
      <div className="av-card w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white">
            <Anchor className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy-900">AuditVault</h1>
            <p className="text-navy-700">Maritime audit platform</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
