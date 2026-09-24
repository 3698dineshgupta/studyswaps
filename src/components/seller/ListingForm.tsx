'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ProductCard, { type CardProduct } from '@/components/marketplace/ProductCard';
import Stepper from '@/components/ui/Stepper';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { categoryMeta } from '@/components/marketplace/categoryMeta';
import { CATEGORIES, PRODUCT_CONDITIONS } from '@/lib/constants';
import type { PlaceSelection } from '@/lib/delivery';
import AddressSearch from '@/components/checkout/AddressSearch';
import PhotoUploader, { uploadedCount, type PhotoItem } from '@/components/seller/PhotoUploader';
import { PHOTO_MAX, PHOTO_MIN } from '@/lib/photos';
import { commissionFor, SELLER_COMMISSION_RATE, WITHDRAWAL } from '@/lib/pricing';
import { DURATION, EASE, SPRING } from '@/lib/motion';
import { cn, formatPrice } from '@/lib/utils';

const STEPS = ['Photos', 'Details', 'Price', 'Location', 'Preview', 'Publish'];

interface FormState {
  category: string; title: string; description: string; condition: string; brand: string; model: string; year_purchased: string;
  price: string; original_price: string; negotiable: boolean; place: PlaceSelection | null; address_line: string; landmark: string;
}
const INITIAL: FormState = { category: '', title: '', description: '', condition: 'GOOD', brand: '', model: '', year_purchased: '', price: '', original_price: '', negotiable: false, place: null, address_line: '', landmark: '' };

const label = 'mb-1.5 block text-sm font-semibold text-ink-soft';
const field = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-shadow placeholder:text-gray-400 focus:border-green-500 focus:ring-4 focus:ring-green-500/10';

/** Spells out exactly what a seller earns and when they can withdraw it. */
function FeeNotice({ price }: { price: number }) {
  const fee = commissionFor(price);
  const net = Math.round((price - fee) * 100) / 100;
  return (
    <div className="space-y-3 rounded-2xl border border-green-200 bg-green-50/70 p-4 text-sm text-green-950">
      <p className="font-display font-bold">What you&apos;ll earn</p>
      <dl className="space-y-1.5">
        <div className="flex justify-between"><dt>Your price</dt><dd className="font-semibold">{formatPrice(price)}</dd></div>
        <div className="flex justify-between"><dt>StudySwaps fee ({SELLER_COMMISSION_RATE * 100}%)</dt><dd className="font-semibold">− {formatPrice(fee)}</dd></div>
        <div className="flex justify-between border-t border-green-200 pt-1.5 text-base"><dt className="font-bold">You receive</dt><dd className="font-extrabold">{formatPrice(net)}</dd></div>
      </dl>
      <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-green-900/90">
        <li>The fee is deducted only when your item is sold. Listing is free.</li>
        <li>Your earnings are held safely once the buyer pays, and become <b>withdrawable</b> as soon as the order is delivered.</li>
        <li>Withdraw to <b>eSewa</b> from your dashboard: minimum {formatPrice(WITHDRAWAL.minAmount)}, up to {formatPrice(WITHDRAWAL.maxAmount)} per request, one request at a time, paid {WITHDRAWAL.processingText}. You must be a verified student.</li>
      </ul>
    </div>
  );
}

export default function ListingForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ id: string; number: string } | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));

  // Photos are uploaded as soon as they're picked; previews are the local files
  const previews = photos.map((p) => p.preview);

  // Warn before leaving with photos that haven't been published yet
  useEffect(() => {
    if (!photos.length || done) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [photos.length, done]);

  // Per-step validation before moving on
  const validate = (s: number): string | null => {
    if (s === 0) {
      if (photos.length < PHOTO_MIN) return `Add at least ${PHOTO_MIN} photo${PHOTO_MIN === 1 ? '' : 's'} to continue`;
      if (photos.length > PHOTO_MAX) return `You can upload up to ${PHOTO_MAX} photos`;
      if (photos.some((p) => p.status === 'error')) return 'Some photos failed to upload — retry or remove them';
      if (photos.some((p) => p.status !== 'done')) return 'Please wait for your photos to finish uploading';
    }
    if (s === 1) {
      if (!form.category) return 'Choose a category';
      if (form.title.trim().length < 3) return 'Give your item a title (3+ characters)';
      if (form.description.trim().length < 10) return 'Describe your item (10+ characters)';
    }
    if (s === 2) {
      const p = Number(form.price);
      if (!p || p <= 0) return 'Enter a price';
      if (form.original_price && Number(form.original_price) <= p) return 'Original price should be higher than your price';
    }
    if (s === 3) {
      if (!form.place) return 'Search for where the item is and pick it from the list';
      if (form.address_line.trim().length < 5) return 'Enter the house / street details';
      if (form.landmark.trim().length < 3) return 'Add a landmark so our rider can find it';
    }
    return null;
  };
  const next = () => { const e = validate(step); if (e) return toast.error(e); setStep((s) => s + 1); };

  const publish = async () => {
    for (let s = 0; s < 4; s++) { const e = validate(s); if (e) { toast.error(e); setStep(s); return; } }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('data', JSON.stringify({
        category: form.category, title: form.title, description: form.description, condition: form.condition,
        brand: form.brand, model: form.model, year_purchased: form.year_purchased, price: form.price, original_price: form.original_price,
        negotiable: form.negotiable, location: form.place?.label ?? '', preferred_meeting_point: '',
        photo_refs: photos.map((p) => p.ref).filter(Boolean),
        pickup: form.place ? { place: form.place, address_line: form.address_line.trim(), landmark: form.landmark.trim() } : undefined,
      }));
      const res = await fetch('/api/products', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to publish');
      setDone({ id: json.id, number: json.listing_number });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // The exact card buyers will see
  const previewProduct: CardProduct = {
    id: 'preview',
    title: form.title || 'Your item title',
    price: Number(form.price) || 0,
    original_price: form.original_price ? Number(form.original_price) : null,
    condition: form.condition,
    location: form.place?.label ?? 'Your location',
    created_at: new Date().toISOString(),
    images: previews.map((u, i) => ({ storage_path: u, is_primary: i === 0 })),
    category: CATEGORIES.find((c) => c.slug === form.category) ? { name: CATEGORIES.find((c) => c.slug === form.category)!.name, slug: form.category } : null,
    seller: { full_name: 'You', verification_status: 'VERIFIED' },
  };

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: DURATION.slow, ease: EASE }} className="rounded-3xl border border-gray-200/70 bg-white p-10 text-center shadow-soft">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING.bouncy, delay: 0.15 }} className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </motion.div>
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink">Listing submitted!</h2>
        <p className="mx-auto mt-2 max-w-md text-ink-muted">{done.number ? `Listing ${done.number} is` : 'Your listing is'} with our moderators. It goes live on the marketplace as soon as it&apos;s approved.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/profile" className="btn-primary px-6 py-3">View my listings</Link>
          <button onClick={() => { setForm(INITIAL); photos.forEach((p) => URL.revokeObjectURL(p.preview)); setPhotos([]); setStep(0); setDone(null); }} className="btn-secondary px-6 py-3">List another item</button>
        </div>
      </motion.div>
    );
  }

  return (
    <div>
      <Stepper steps={STEPS} current={step} className="mb-8" />

      <div className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-soft sm:p-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: DURATION.normal, ease: EASE }} className="space-y-6">
            {/* 1 · Photos */}
            {step === 0 && (
              <>
                <div>
                  <h2 className="font-display text-2xl font-bold text-ink">Add photos</h2>
                  <p className="mt-1 text-sm text-ink-muted">Listings need {PHOTO_MIN}–{PHOTO_MAX} real photos. Clear photos sell faster — show any scratches honestly to build trust.</p>
                </div>
                <PhotoUploader items={photos} setItems={setPhotos} />
              </>
            )}

            {/* 2 · Details */}
            {step === 1 && (
              <>
                <div><h2 className="font-display text-2xl font-bold text-ink">Tell us about it</h2><p className="mt-1 text-sm text-ink-muted">The more precise you are, the fewer questions you&apos;ll get.</p></div>
                <div>
                  <span className={label}>Category</span>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {CATEGORIES.map((c) => {
                      const { Icon } = categoryMeta(c.slug);
                      const on = form.category === c.slug;
                      return (
                        <motion.button key={c.slug} type="button" whileTap={{ scale: 0.97 }} onClick={() => set('category', c.slug)} aria-pressed={on} className={cn('flex items-center gap-2.5 rounded-xl border-2 px-3.5 py-3 text-left text-sm font-semibold transition-colors', on ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-ink-soft hover:border-gray-300')}>
                          <Icon className="h-[18px] w-[18px] shrink-0" /> <span className="truncate">{c.name}</span>
                          {on && <Check className="ml-auto h-4 w-4 shrink-0" strokeWidth={3} />}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
                <div><label className={label} htmlFor="t">Title</label><input id="t" className={field} placeholder="e.g. Engineering Mathematics — Kreyszig, 10th edition" maxLength={200} value={form.title} onChange={(e) => set('title', e.target.value)} /></div>
                <div><label className={label} htmlFor="d">Description</label><textarea id="d" rows={4} className={field} placeholder="Condition, what's included, why you're selling…" value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
                <div>
                  <span className={label}>Condition</span>
                  <div className="flex flex-wrap gap-2">
                    {PRODUCT_CONDITIONS.map((c) => (
                      <button key={c.value} type="button" onClick={() => set('condition', c.value)} aria-pressed={form.condition === c.value} className={cn('rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors', form.condition === c.value ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 text-ink-soft hover:border-gray-300')}>{c.label}</button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input label="Brand (optional)" value={form.brand} onChange={(e) => set('brand', e.target.value)} />
                  <Input label="Model (optional)" value={form.model} onChange={(e) => set('model', e.target.value)} />
                  <Input label="Year bought (optional)" type="number" value={form.year_purchased} onChange={(e) => set('year_purchased', e.target.value)} />
                </div>
              </>
            )}

            {/* 3 · Price */}
            {step === 2 && (
              <>
                <div><h2 className="font-display text-2xl font-bold text-ink">Set your price</h2><p className="mt-1 text-sm text-ink-muted">Fair prices sell fast. Showing the original price highlights the saving.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className={label} htmlFor="p">Your price (Rs.)</label><input id="p" type="number" inputMode="numeric" min={1} className={cn(field, 'text-lg font-bold')} placeholder="0" value={form.price} onChange={(e) => set('price', e.target.value)} /></div>
                  <div><label className={label} htmlFor="op">Original price (optional)</label><input id="op" type="number" inputMode="numeric" min={1} className={field} placeholder="What it cost new" value={form.original_price} onChange={(e) => set('original_price', e.target.value)} /></div>
                </div>
                {form.price && form.original_price && Number(form.original_price) > Number(form.price) && (
                  <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-green-50 p-3.5 text-sm font-medium text-green-800">
                    Buyers will see <b>{Math.round((1 - Number(form.price) / Number(form.original_price)) * 100)}% off</b> — they save {formatPrice(Number(form.original_price) - Number(form.price))}.
                  </motion.p>
                )}
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-4">
                  <input type="checkbox" checked={form.negotiable} onChange={(e) => set('negotiable', e.target.checked)} className="h-5 w-5 rounded accent-green-600" />
                  <span><span className="block text-sm font-semibold text-ink">Open to offers</span><span className="block text-xs text-ink-muted">Shows a “Negotiable” badge on your listing</span></span>
                </label>
              </>
            )}

            {/* 4 · Location */}
            {step === 3 && (
              <>
                <div><h2 className="font-display text-2xl font-bold text-ink">Where is the item?</h2><p className="mt-1 text-sm text-ink-muted">Our rider collects it from this address after a sale — you and the buyer never meet. The buyer&apos;s delivery fee is based on the distance from here, so the exact spot matters.</p></div>
                <AddressSearch label="Search the area" showMap value={form.place} onChange={(place) => set('place', place)} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className={label} htmlFor="al">House / building & street</label><input id="al" className={field} placeholder="e.g. House 23, Ward 10" value={form.address_line} onChange={(e) => set('address_line', e.target.value)} /></div>
                  <div><label className={label} htmlFor="lm">Landmark</label><input id="lm" className={field} placeholder="e.g. Near the blue gate" value={form.landmark} onChange={(e) => set('landmark', e.target.value)} /></div>
                </div>
              </>
            )}

            {/* 5 · Preview */}
            {step === 4 && (
              <>
                <div><h2 className="font-display text-2xl font-bold text-ink">Preview your listing</h2><p className="mt-1 text-sm text-ink-muted">This is exactly how buyers will see it on the marketplace.</p></div>
                <div className="mx-auto max-w-[280px] pointer-events-none select-none" aria-label="Listing preview"><ProductCard product={previewProduct} /></div>
              </>
            )}

            {/* 6 · Publish */}
            {step === 5 && (
              <>
                <div><h2 className="font-display text-2xl font-bold text-ink">Ready to publish?</h2><p className="mt-1 text-sm text-ink-muted">Moderators review new listings quickly, then it goes live.</p></div>
                <dl className="divide-y divide-gray-100 rounded-2xl border border-gray-200 text-sm">
                  {[['Title', form.title], ['Category', CATEGORIES.find((c) => c.slug === form.category)?.name], ['Condition', PRODUCT_CONDITIONS.find((c) => c.value === form.condition)?.label], ['Price', formatPrice(Number(form.price))], ['Location', form.place?.label ?? '—'], ['Photos', `${uploadedCount(photos)} / ${PHOTO_MAX}`]].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between gap-4 px-4 py-3"><dt className="text-ink-muted">{k}</dt><dd className="text-right font-semibold text-ink">{v}</dd></div>
                  ))}
                </dl>
                <FeeNotice price={Number(form.price)} />
                <p className="text-xs text-ink-muted">By publishing you confirm you own this item and it isn&apos;t on our <Link href="/policies#prohibited" target="_blank" className="font-medium text-green-700 underline-offset-2 hover:underline">prohibited items</Link> list, and you accept the <Link href="/policies#payouts" target="_blank" className="font-medium text-green-700 underline-offset-2 hover:underline">seller payout terms</Link>.</p>
              
              </>
            )}

            {/* Nav */}
            <div className="flex gap-3 pt-2">
              {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="flex-1"><ArrowLeft className="h-4 w-4" /> Back</Button>}
              {step < STEPS.length - 1 ? (
                <Button onClick={next} className="flex-1" size="lg">Continue <ArrowRight className="h-4 w-4" /></Button>
              ) : (
                <Button onClick={publish} loading={loading} className="flex-1" size="lg">Publish listing</Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
