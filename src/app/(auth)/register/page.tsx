'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Eye, EyeOff, GraduationCap, Lock, Mail, MapPin, MailCheck, Phone, ShoppingBag, Store, User } from 'lucide-react';
import AuthField from '@/components/auth/AuthField';
import Button from '@/components/ui/Button';
import { CITY_COOKIE, LAUNCH_CITIES } from '@/lib/cities';
import { DURATION, EASE, SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Role = 'buyer' | 'seller';
const STEPS = ['Your goal', 'Account', 'Details'];

const ROLES: { id: Role; title: string; Icon: typeof ShoppingBag; tag: string; points: string[] }[] = [
  { id: 'buyer', title: 'I want to buy', Icon: ShoppingBag, tag: 'No ID check needed', points: ['Browse and buy right away', 'Pay securely with eSewa', 'Delivered to your door'] },
  { id: 'seller', title: 'I want to sell', Icon: Store, tag: 'Verify your ID once', points: ['List items in minutes', 'Get paid to eSewa', 'You can buy too'] },
];

const safePath = (p: string | null) => (p && p.startsWith('/') && !p.startsWith('//') ? p : null);

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]|[A-Za-z]/.test(pw)) s++;
  return Math.min(s, 4);
}
const STRENGTH = [
  { label: 'Too short', color: 'bg-gray-200' },
  { label: 'Weak', color: 'bg-red-400' },
  { label: 'Okay', color: 'bg-amber-400' },
  { label: 'Good', color: 'bg-green-500' },
  { label: 'Strong', color: 'bg-green-600' },
];

function RegisterForm() {
  const router = useRouter();
  const redirectTo = safePath(useSearchParams().get('redirectTo'));
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [role, setRole] = useState<Role>('buyer');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [agree, setAgree] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '', phone: '', college: '', location: '' });
  const set = (k: keyof typeof form, v: string) => { setForm((p) => ({ ...p, [k]: v })); setErrors((p) => ({ ...p, [k]: '' })); };
  const score = useMemo(() => strength(form.password), [form.password]);

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (form.full_name.trim().length < 2) e.full_name = 'Enter your full name';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
      if (form.password.length < 8) e.password = 'Use at least 8 characters';
      if (form.confirm !== form.password) e.confirm = 'Passwords don’t match';
    }
    if (s === 2) {
      if (!/^(\+977-?)?9[78]\d{8}$/.test(form.phone.replace(/[\s-]/g, ''))) e.phone = 'Enter a valid Nepali mobile number, e.g. 98XXXXXXXX';
      if (form.college.trim().length < 2) e.college = 'Enter your college or school';
      if (!form.location) e.location = 'Choose your city';
      if (!agree) e.agree = 'Please accept the terms to continue';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const go = (to: number) => { setDir(to > step ? 1 : -1); setStep(to); setFormError(''); };
  const next = () => { if (validate(step)) go(step + 1); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) return next();
    if (!validate(2)) return;
    setLoading(true);
    setFormError('');
    try {
      // Accounts are created by our server, which limits sign-ups (per IP, per email and overall)
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: form.full_name.trim(), email: form.email.trim(), password: form.password, phone: form.phone, college: form.college.trim(), location: form.location, intent: role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not create your account.');

      const chosen = LAUNCH_CITIES.find((c) => c.name === form.location);
      if (chosen) document.cookie = `${CITY_COOKIE}=${chosen.slug}; path=/; max-age=31536000; samesite=lax`;

      if (json.signedIn) {
        router.push(redirectTo ?? (role === 'seller' ? '/sell' : '/'));
        router.refresh();
      } else {
        setSent(true);
      }
    } catch (err) {
      const msg = (err as Error).message;
      setFormError(msg || 'Could not create your account.');
      if (/already/i.test(msg)) go(1);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (
    <button type="button" onClick={() => setShowPass((s) => !s)} aria-label={showPass ? 'Hide password' : 'Show password'} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-ink">
      {showPass ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
    </button>
  );

  if (sent) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="w-full max-w-[26rem] text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING.bouncy} className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100"><MailCheck className="h-10 w-10 text-green-600" /></motion.div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Check your email</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">We sent a confirmation link to <b className="text-ink">{form.email}</b>. Open it to activate your account, then sign in.</p>
        {role === 'seller' && <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-800">When you list your first item, we&apos;ll ask you to verify your student ID — just once.</p>}
        <Link href="/login" className="btn-primary mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl text-[15px]">Go to sign in</Link>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="w-full max-w-[28rem]">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Create your account</h1>
        <p className="mt-2 text-[15px] text-ink-muted">Free to join. Takes about a minute.</p>
      </div>

      {/* Progress */}
      <ol className="mb-7 flex items-center gap-2" aria-label="Sign-up progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col gap-1.5" aria-current={i === step ? 'step' : undefined}>
            <span className="relative h-1.5 overflow-hidden rounded-full bg-gray-200"><motion.span className="absolute inset-y-0 left-0 rounded-full bg-green-600" initial={false} animate={{ width: i <= step ? '100%' : '0%' }} transition={{ duration: DURATION.slow, ease: EASE }} /></span>
            <span className={cn('text-xs font-semibold', i <= step ? 'text-green-700' : 'text-gray-400')}>{label}</span>
          </li>
        ))}
      </ol>

      <form onSubmit={submit} noValidate>
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div key={step} initial={{ opacity: 0, x: dir * 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -8 }} transition={{ duration: 0.16, ease: EASE }} className="space-y-5">
            {formError && <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {formError}</div>}

            {step === 0 && (
              <div className="space-y-3" role="radiogroup" aria-label="What brings you here?">
                {ROLES.map(({ id, title, Icon, tag, points }) => {
                  const on = role === id;
                  return (
                    <motion.button key={id} type="button" role="radio" aria-checked={on} whileTap={{ scale: 0.985 }} onClick={() => setRole(id)}
                      className={cn('relative w-full rounded-2xl border-2 p-4 text-left transition-colors', on ? 'border-green-600 bg-green-50/70' : 'border-gray-200 bg-white hover:border-gray-300')}>
                      <div className="flex items-start gap-3.5">
                        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors', on ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500')}><Icon className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2"><span className="font-display text-base font-bold text-ink">{title}</span><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', id === 'buyer' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800')}>{tag}</span></span>
                          <ul className="mt-2 space-y-1">{points.map((p) => <li key={p} className="flex items-center gap-2 text-sm text-ink-soft"><Check className="h-3.5 w-3.5 shrink-0 text-green-600" strokeWidth={3} /> {p}</li>)}</ul>
                        </span>
                        <span className={cn('mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors', on ? 'border-green-600 bg-green-600' : 'border-gray-300')}>{on && <Check className="h-3 w-3 text-white" strokeWidth={4} />}</span>
                      </div>
                    </motion.button>
                  );
                })}
                <p className="px-1 text-xs text-ink-muted">You can always change your mind — buyers can start selling later, and sellers can buy too.</p>
              </div>
            )}

            {step === 1 && (
              <>
                <AuthField label="Full name" autoComplete="name" placeholder="Your full name" icon={<User />} value={form.full_name} error={errors.full_name} onChange={(e) => set('full_name', e.target.value)} autoFocus />
                <AuthField label="Email" type="email" autoComplete="email" inputMode="email" placeholder="you@college.edu" icon={<Mail />} value={form.email} error={errors.email} onChange={(e) => set('email', e.target.value)} />
                <div>
                  <AuthField label="Password" type={showPass ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" icon={<Lock />} right={toggle} value={form.password} error={errors.password} onChange={(e) => set('password', e.target.value)} />
                  {form.password && (
                    <div className="mt-2 flex items-center gap-3" aria-live="polite">
                      <div className="flex flex-1 gap-1">{[1, 2, 3, 4].map((n) => <span key={n} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', n <= score ? STRENGTH[score].color : 'bg-gray-200')} />)}</div>
                      <span className="w-14 text-right text-xs font-semibold text-ink-muted">{STRENGTH[score].label}</span>
                    </div>
                  )}
                </div>
                <AuthField label="Confirm password" type={showPass ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat your password" icon={<Lock />} value={form.confirm} error={errors.confirm} onChange={(e) => set('confirm', e.target.value)} />
              </>
            )}

            {step === 2 && (
              <>
                <AuthField label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" placeholder="98XXXXXXXX" icon={<Phone />} value={form.phone} error={errors.phone} hint="Used only for delivery updates." onChange={(e) => set('phone', e.target.value)} autoFocus />
                <AuthField label="College or school" autoComplete="organization" placeholder="e.g. Kalika Manavgyan" icon={<GraduationCap />} value={form.college} error={errors.college} onChange={(e) => set('college', e.target.value)} />
                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Your city</span>
                  <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Your city">
                    {LAUNCH_CITIES.map((c) => {
                      const on = form.location === c.name;
                      return (
                        <motion.button key={c.slug} type="button" role="radio" aria-checked={on} whileTap={{ scale: 0.97 }} onClick={() => set('location', c.name)}
                          className={cn('flex items-center gap-2.5 rounded-xl border-2 px-3.5 py-3 text-left transition-colors', on ? 'border-green-600 bg-green-50' : errors.location ? 'border-red-300' : 'border-gray-200 hover:border-gray-300')}>
                          <MapPin className={cn('h-4 w-4 shrink-0', on ? 'text-green-600' : 'text-gray-400')} />
                          <span><span className="block text-sm font-bold text-ink">{c.name}</span><span className="text-[11px] text-ink-muted">{c.blurb}</span></span>
                        </motion.button>
                      );
                    })}
                  </div>
                  <p className={cn('mt-1.5 text-xs', errors.location ? 'font-medium text-red-600' : 'text-ink-muted')}>{errors.location || "We've launched in Kathmandu and Butwal. You'll see listings from your city."}</p>
                </div>

                {role === 'seller' && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
                    <Store className="mt-0.5 h-4 w-4 shrink-0" /> <span>Before your first listing goes live, we&apos;ll ask you to verify your student ID — a quick one-time step.</span>
                  </div>
                )}

                <div>
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-soft">
                    <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setErrors((p) => ({ ...p, agree: '' })); }} className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-green-600" />
                    <span>I agree to the <Link href="/policies#terms" target="_blank" className="font-semibold text-green-700 hover:underline">Terms of use</Link> and <Link href="/policies#privacy" target="_blank" className="font-semibold text-green-700 hover:underline">Privacy policy</Link>.</span>
                  </label>
                  {errors.agree && <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600"><AlertCircle className="h-3.5 w-3.5" /> {errors.agree}</p>}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-7 flex gap-3">
          {step > 0 && <Button type="button" variant="outline" onClick={() => go(step - 1)} className="h-12 rounded-xl border-gray-200 px-5 text-ink-soft hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /> Back</Button>}
          <Button type="submit" loading={loading} className="h-12 flex-1 rounded-xl text-[15px] shadow-[0_14px_30px_-14px_rgba(22,163,74,0.9)]">
            {step === 2 ? 'Create account' : <>Continue <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </div>
      </form>

      <p className="mt-7 text-center text-sm text-ink-muted">Already have an account? <Link href={redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/login'} className="font-semibold text-green-700 hover:text-green-800">Sign in</Link></p>
    </motion.div>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={null}><RegisterForm /></Suspense>;
}
