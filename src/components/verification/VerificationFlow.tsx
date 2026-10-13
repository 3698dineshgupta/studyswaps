'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Check, Clock, Lock, ShieldCheck, Timer } from 'lucide-react';
import toast from 'react-hot-toast';
import VerificationStepper from '@/components/verification/VerificationStepper';
import DocumentUpload, { DOCUMENT_TYPES, type DocumentTypeId } from '@/components/verification/DocumentUpload';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { DURATION, EASE, SPRING } from '@/lib/motion';

const STEPS = [
  { label: 'Start' },
  { label: 'Document' },
  { label: 'Details' },
  { label: 'Review' },
  { label: 'Submit' },
];

export interface VerificationFlowProps {
  defaults?: { full_name?: string; college_name?: string };
  /** Called after the request is submitted */
  onSubmitted: () => void;
}

const card = 'rounded-2xl border border-gray-200/70 bg-white p-5 sm:p-6';
const h2 = 'font-display text-xl font-extrabold text-ink';

/**
 * The seller identity-verification journey: upload a photo of any one ID document → details → review → submit.
 * Used both on the /verify page and inside the "verify to start selling" popup.
 */
export default function VerificationFlow({ defaults, onSubmitted }: VerificationFlowProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  // Server-issued id of the uploaded document (never a file or path — the browser can't supply an image)
  const [verificationId, setVerificationId] = useState('');
  const [documentType, setDocumentType] = useState<DocumentTypeId | null>(null);
  const [form, setForm] = useState({ full_name: defaults?.full_name ?? '', date_of_birth: '', college_name: defaults?.college_name ?? '', student_id_number: '' });
  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!verificationId || !documentType) { toast.error('Please upload your document first'); setStep(1); return; }
    if (!form.full_name || !form.college_name) { toast.error('Please fill all required fields'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/verification/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_type: documentType, verification_id: verificationId, form }) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // The upload can no longer be used → send the user back to upload a new one
        if (['ALREADY_USED', 'MISSING_DOCUMENT', 'INVALID_DOCUMENT_TYPE', 'DOCUMENT_EXPIRED'].includes(err.code)) { setVerificationId(''); setStep(1); }
        throw new Error(err.error || 'Submission failed');
      }
      onSubmitted();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const back = (to: number) => <Button variant="outline" onClick={() => setStep(to)} className="flex-1"><ArrowLeft className="h-4 w-4" /> Back</Button>;

  return (
    <div className="space-y-6">
      <VerificationStepper steps={STEPS} currentStep={step} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: DURATION.normal, ease: EASE }} className={card}>
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className={h2}>Verify your student identity</h2>
                <p className="mt-1 text-sm text-ink-muted">Sellers are verified once so buyers can trust who they buy from. It takes about a minute.</p>
              </div>
              <ul className="space-y-2.5">
                {[
                  { Icon: ShieldCheck, t: 'Keeps the marketplace fraud-free', d: 'Every seller has a real ID on file.' },
                  { Icon: Lock, t: 'Private by design', d: 'Your document is stored privately and seen only by our review team.' },
                  { Icon: Timer, t: 'Reviewed within 24 hours', d: 'You get a notification the moment you are approved.' },
                ].map(({ Icon, t, d }) => (
                  <li key={t} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700"><Icon className="h-[18px] w-[18px]" /></span>
                    <span><span className="block text-sm font-semibold text-ink">{t}</span><span className="text-xs text-ink-muted">{d}</span></span>
                  </li>
                ))}
              </ul>
              <div className="rounded-xl border border-dashed border-gray-300 p-3.5 text-sm text-ink-soft"><b className="text-ink">Have ready:</b> a photo of any one of your school ID, college/university ID, citizenship certificate or national ID card.</div>
              <Button onClick={() => setStep(1)} fullWidth size="lg">Get started</Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div><h2 className={h2}>Upload your document</h2><p className="mt-1 text-sm text-ink-muted">Choose which document you have, then upload a clear photo of it — from your camera or your gallery.</p></div>
              <DocumentUpload uploaded={!!verificationId} initialDocumentType={documentType} onComplete={(id, type) => { setVerificationId(id); setDocumentType(type); setStep(2); }} />
              <div className="flex gap-3">{back(0)}{verificationId && <Button onClick={() => setStep(2)} className="flex-1" size="lg">Next</Button>}</div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className={h2}>Your details</h2>
              <Input label="Full name" placeholder="As shown on your document" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required />
              <Input label="Date of birth" type="date" value={form.date_of_birth} onChange={(e) => update('date_of_birth', e.target.value)} />
              <Input label="College / school name" placeholder="XYZ College" value={form.college_name} onChange={(e) => update('college_name', e.target.value)} required />
              <Input label="Student ID / roll number" placeholder="12345" value={form.student_id_number} onChange={(e) => update('student_id_number', e.target.value)} />
              <div className="flex gap-3">{back(1)}<Button onClick={() => { if (!form.full_name || !form.college_name) { toast.error('Fill the required fields'); return; } setStep(3); }} className="flex-1" size="lg">Next</Button></div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div><h2 className={h2}>Review</h2><p className="mt-1 text-sm text-ink-muted">Make sure everything is correct.</p></div>
              <dl className="space-y-2.5 rounded-xl bg-gray-50 p-4 text-sm">
                {[['Name', form.full_name], ['Date of birth', form.date_of_birth || '—'], ['College / school', form.college_name], ['Student ID no.', form.student_id_number || '—'], ['Document', documentType ? DOCUMENT_TYPES.find((d) => d.id === documentType)?.label : 'Missing'], ['Uploaded', verificationId ? 'Yes ✓' : 'Missing']].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4"><dt className="text-ink-muted">{k}</dt><dd className="text-right font-semibold text-ink">{v}</dd></div>
                ))}
              </dl>
              <div className="flex gap-3">{back(2)}<Button onClick={() => { if (!verificationId || !documentType) { toast.error('Please upload your document first'); setStep(1); return; } setStep(4); }} className="flex-1" size="lg">Looks good</Button></div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className={h2}>Submit for review</h2>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">By submitting, you confirm the details are accurate and belong to you. False information may lead to account suspension.</div>
              <ul className="space-y-2 text-sm text-ink-soft">
                {['Your document is stored privately and reviewed only by our verification team.', 'Review typically takes up to 24 hours.', 'You will get a notification once you are verified.'].map((t) => <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" strokeWidth={3} />{t}</li>)}
              </ul>
              <div className="flex gap-3">{back(3)}<Button onClick={handleSubmit} loading={loading} className="flex-1" size="lg">Submit verification</Button></div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Shown after a request has been submitted (or while one is already in review). */
export function VerificationPending({ children }: { children?: React.ReactNode }) {
  return (
    <div className="space-y-4 py-4 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING.bouncy} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100"><Clock className="h-10 w-10 text-green-600" /></motion.div>
      <h2 className="font-display text-2xl font-extrabold text-ink">Verification in review</h2>
      <p className="mx-auto max-w-sm text-sm text-ink-muted">Thanks! Our team is checking your document — usually within 24 hours. We&apos;ll notify you as soon as you can start selling.</p>
      {children}
    </div>
  );
}
