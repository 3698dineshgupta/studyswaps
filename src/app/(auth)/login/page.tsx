'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import AuthField from '@/components/auth/AuthField';
import Button from '@/components/ui/Button';
import { EASE } from '@/lib/motion';

/** Only same-site paths, so a crafted link can't bounce someone to another website after login. */
const safePath = (p: string | null) => (p && p.startsWith('/') && !p.startsWith('//') ? p : null);

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = safePath(params.get('redirectTo') ?? params.get('next'));
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.email) errs.email = 'Enter your email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'That doesn’t look like an email';
    if (!form.password) errs.password = 'Enter your password';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;
    setLoading(true);
    try {
      // Sign-in goes through our server, which limits guessing (8 tries per account / 15 min) and sets the session
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email.trim(), password: form.password }) });
      const json = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const mins = Math.max(1, Math.ceil(Number(res.headers.get('Retry-After') || 60) / 60));
        throw new Error(`Too many attempts. For your safety, please wait about ${mins} minute${mins === 1 ? '' : 's'} and try again.`);
      }
      if (!res.ok) throw new Error(json.error || 'Sign-in failed. Please try again.');

      setDone(true);
      router.push(redirectTo ?? (json.intent === 'seller' ? '/sell' : '/'));
      router.refresh();
    } catch (err) {
      setFormError((err as Error).message);
      setLoading(false);
    }
  };

  const toggle = (
    <button type="button" onClick={() => setShowPass((s) => !s)} aria-label={showPass ? 'Hide password' : 'Show password'} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-ink">
      {showPass ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="w-full max-w-[26rem]">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Welcome back</h1>
        <p className="mt-2 text-[15px] text-ink-muted">Sign in to buy, sell and track your orders.</p>
        {redirectTo && <p className="mt-3 rounded-xl bg-green-50 px-3.5 py-2.5 text-sm text-green-800">Sign in to continue where you left off.</p>}
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <AnimatePresence>
          {formError && (
            <motion.div role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {formError}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <AuthField label="Email" type="email" autoComplete="email" inputMode="email" placeholder="you@college.edu" icon={<Mail />} value={form.email} error={errors.email}
          onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setErrors((p) => ({ ...p, email: '' })); }} autoFocus />
        <AuthField label="Password" type={showPass ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" icon={<Lock />} right={toggle} value={form.password} error={errors.password}
          onChange={(e) => { setForm((p) => ({ ...p, password: e.target.value })); setErrors((p) => ({ ...p, password: '' })); }} />

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-semibold text-green-700 hover:text-green-800">Forgot password?</Link>
        </div>

        <Button type="submit" loading={loading || done} fullWidth size="lg" className="h-12 rounded-xl text-[15px] shadow-[0_14px_30px_-14px_rgba(22,163,74,0.9)]">
          {done ? 'Signing you in…' : <>Sign in <ArrowRight className="h-4 w-4" /></>}
        </Button>
      </form>

      <div className="my-7 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-gray-400"><span className="h-px flex-1 bg-gray-200" /> New here? <span className="h-px flex-1 bg-gray-200" /></div>

      <Link href={redirectTo ? `/register?redirectTo=${encodeURIComponent(redirectTo)}` : '/register'} className="group flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:border-green-300 hover:shadow-soft">
        <span>
          <span className="block font-display text-[15px] font-bold text-ink">Create a free account</span>
          <span className="text-xs text-ink-muted">Shop right away. Verify your ID only if you want to sell.</span>
        </span>
        <ArrowRight className="h-5 w-5 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-green-600" />
      </Link>
    </motion.div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
