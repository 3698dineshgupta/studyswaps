'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { MapPin, Store } from 'lucide-react';
import Price from '@/components/ui/Price';
import SellerBadge from '@/components/shared/SellerBadge';
import { RevealGroup, RevealItem } from '@/components/ui/Reveal';
import type { CardProduct } from '@/components/marketplace/ProductCard';
import SectionHeading from './SectionHeading';
import { SERVICE_CITIES } from '@/lib/delivery';
import { SPRING, fadeUp } from '@/lib/motion';
import { cn, getSupabaseImageUrl, isCloudinaryUrl } from '@/lib/utils';

const cityOf = (location?: string | null) => SERVICE_CITIES.find((c) => location?.toLowerCase().includes(c.toLowerCase()));

/**
 * "Find it near your campus": real listings grouped by city, with doorstep delivery from the seller.
 * (Distances are calculated at checkout from the exact address; here we group by city.)
 */
export default function NearYouSection({ products }: { products: CardProduct[] }) {
  const [city, setCity] = useState<string>('All');
  const shown = useMemo(() => products.filter((p) => city === 'All' || cityOf(p.location) === city).slice(0, 4), [products, city]);
  const cities = ['All', ...SERVICE_CITIES];

  return (
    <section aria-labelledby="near-heading" className="page-container py-14 sm:py-20">
      <SectionHeading eyebrow="Local" title="Find it near your campus" text="We collect from the seller and deliver to your door — no awkward meetups, and the closer the seller, the lower your delivery fee." />
      <span id="near-heading" className="sr-only">Listings near your campus</span>

      <LayoutGroup id="near-tabs">
        <div role="tablist" aria-label="City" className="mb-6 flex flex-wrap gap-2">
          {cities.map((c) => (
            <button key={c} role="tab" aria-selected={city === c} onClick={() => setCity(c)} className={cn('relative rounded-full px-4 py-2 text-sm font-semibold transition-colors', city === c ? 'text-white' : 'text-ink-soft hover:bg-white hover:shadow-soft')}>
              {city === c && <motion.span layoutId="near-pill" transition={SPRING.snappy} className="absolute inset-0 rounded-full bg-ink" />}
              <span className="relative">{c}</span>
            </button>
          ))}
        </div>
      </LayoutGroup>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={city} variants={fadeUp} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.12 } }}>
          {shown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-10 text-center text-sm text-ink-muted">
              No listings in {city} yet — <Link href="/sell" className="font-semibold text-green-700 hover:underline">be the first to sell here</Link>.
            </div>
          ) : (
            <RevealGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {shown.map((p) => {
                const img = (p.images ?? p.product_images)?.[0];
                const src = img ? getSupabaseImageUrl(img.storage_path, 480) : null;
                const seller = p.seller ?? p.profiles;
                return (
                  <RevealItem key={p.id}>
                    <Link href={`/product/${p.id}`} className="card-hover group flex h-full flex-col">
                      <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                        {src && <Image src={src} alt={p.title} fill sizes="(max-width:640px) 100vw, 25vw" unoptimized={isCloudinaryUrl(src)} className="object-cover transition-transform duration-500 group-hover:scale-105" />}
                        <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-green-700 shadow-soft backdrop-blur">
                          <Store className="h-3 w-3" /> Doorstep delivery
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <h3 className="line-clamp-1 font-display text-[15px] font-semibold text-ink">{p.title}</h3>
                        <Price value={p.price} original={p.original_price} />
                        <div className="mt-auto space-y-2 border-t border-gray-100 pt-3">
                          <p className="flex items-center gap-1.5 text-xs text-ink-muted"><MapPin className="h-3.5 w-3.5 text-green-600" /> {p.location}</p>
                          <SellerBadge name={seller?.full_name} photo={seller?.profile_photo} verified={seller?.verification_status === 'VERIFIED'} />
                        </div>
                      </div>
                    </Link>
                  </RevealItem>
                );
              })}
            </RevealGroup>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
