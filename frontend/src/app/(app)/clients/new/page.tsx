import { requireRole } from '@/lib/session';
import NewClientForm from './form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function NewClientPage() {
  await requireRole(['ADMIN']);
  return (
    <div className="max-w-xl space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-2 text-base font-semibold text-teal-700 hover:underline">
        <ArrowLeft className="h-5 w-5" aria-hidden /> Back to clients
      </Link>
      <h1 className="text-3xl font-bold text-navy-900">Add a client company</h1>
      <NewClientForm />
    </div>
  );
}
