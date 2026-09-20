'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import VerificationFlow, { VerificationPending } from '@/components/verification/VerificationFlow';
import { useAuthState } from '@/components/auth/AuthProvider';
import Button from '@/components/ui/Button';

function VerifyInner() {
  const router = useRouter();
  const next = useSearchParams().get('next');
  const { profile } = useAuthState();
  const [submitted, setSubmitted] = useState(false);
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/sell';

  const status = profile?.verification_status;
  const inReview = submitted || status === 'PENDING' || status === 'UNDER_REVIEW';

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="mb-6 flex items-center gap-3.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-600 text-white shadow-[0_8px_20px_-8px_rgba(22,163,74,0.8)]"><ShieldCheck className="h-6 w-6" /></span>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Verify to start selling</h1>
            <p className="text-sm text-ink-muted">A one-time step for sellers. Buying never needs it.</p>
          </div>
        </div>

        {status === 'VERIFIED' ? (
          <div className="space-y-4 rounded-2xl border border-gray-200/70 bg-white p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
            <h2 className="font-display text-xl font-extrabold text-ink">You&apos;re verified</h2>
            <p className="text-sm text-ink-muted">You can list items for sale right away.</p>
            <Button onClick={() => router.push(safeNext)} size="lg">Start selling</Button>
          </div>
        ) : inReview ? (
          <div className="rounded-2xl border border-gray-200/70 bg-white p-6">
            <VerificationPending><Button variant="outline" onClick={() => router.push('/')}>Back to home</Button></VerificationPending>
          </div>
        ) : (
          <VerificationFlow defaults={{ full_name: profile?.full_name, college_name: profile?.college_name ?? undefined }} onSubmitted={() => { setSubmitted(true); router.refresh(); }} />
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return <Suspense fallback={null}><VerifyInner /></Suspense>;
}
