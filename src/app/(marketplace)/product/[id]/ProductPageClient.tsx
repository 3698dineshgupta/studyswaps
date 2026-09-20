'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import toast from 'react-hot-toast';
import {
  ArrowLeft, BadgeCheck, Check, ChevronRight, CreditCard, Heart, MapPin, MessageCircle, Share2, ShieldCheck, ShoppingBag, Tag, Truck, X, Zap,
} from 'lucide-react';
import { useProduct, useProducts } from '@/hooks/useProducts';
import { useCart } from '@/hooks/useCart';
import { useCartControls } from '@/hooks/useCartItem';
import { useWishlist } from '@/hooks/useWishlist';
import ProductGrid from '@/components/marketplace/ProductGrid';
import type { CardProduct } from '@/components/marketplace/ProductCard';
import ProductGallery, { type GalleryHandle } from '@/components/product/ProductGallery';
import CartIconLink from '@/components/cart/CartIconLink';
import { useCartUI } from '@/components/cart/CartUIProvider';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import Price from '@/components/ui/Price';
import Rating from '@/components/ui/Rating';
import { Skeleton } from '@/components/ui/Skeleton';
import { Reveal } from '@/components/ui/Reveal';
import { getSupabase } from '@/lib/supabase/lazy';
import { DELIVERY, PLATFORM_FEE } from '@/lib/pricing';
import { PRODUCT_CONDITIONS, supportWhatsAppUrl } from '@/lib/constants';
import { DURATION, EASE, SPRING, fadeUp, stagger } from '@/lib/motion';
import { cn, formatDate, formatPrice, formatRelativeTime } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

function DetailSkeleton() {
  return (
    <div className="page-container py-0 lg:py-8" role="status" aria-label="Loading listing">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <Skeleton className="-mx-4 h-[46svh] rounded-none sm:-mx-6 lg:mx-0 lg:aspect-[5/4] lg:h-auto lg:rounded-3xl" />
        <div className="space-y-4"><Skeleton className="h-5 w-40" /><Skeleton className="h-10 w-3/4" /><Skeleton className="h-9 w-40" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-14 rounded-full" /></div>
      </div>
    </div>
  );
}

/** Small round glass button used over the photo on phones. */
const glass = 'flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-lift backdrop-blur transition-transform active:scale-90';

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white px-3.5 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-ink" title={value}>{value}</p>
    </div>
  );
}

/** Seller's description, collapsed when long. */
function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 260 || text.split('\n').length > 5;
  return (
    <div>
      <motion.div initial={false} animate={{ height: 'auto' }} className={cn('relative', !open && long && 'max-h-[7.5rem] overflow-hidden')}>
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{text}</p>
        {!open && long && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />}
      </motion.div>
      {long && <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-2 text-sm font-semibold text-green-700 hover:text-green-800">{open ? 'Show less' : 'Show more'}</button>}
    </div>
  );
}

function ProductView({ product, id }: { product: any; id: string }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const gallery = useRef<GalleryHandle>(null);
  const { isWishlisted, toggle } = useWishlist();
  const { addToCart, isAdding } = useCart();
  const { fly, cancelFly } = useCartUI();

  const seller = product.seller;
  const images: any[] = product.images || product.product_images || [];
  const condition = PRODUCT_CONDITIONS.find((c) => c.value === product.condition);
  const wished = isWishlisted(product.id);
  const sold = product.status === 'SOLD' || (product.quantity ?? 1) <= 0;
  const verified = seller?.verification_status === 'VERIFIED';

  // Same cart as everywhere else: the card's controls, fed this product
  const cardProduct = useMemo<CardProduct>(() => ({
    id: product.id, title: product.title, price: Number(product.price), original_price: product.original_price, location: product.location,
    quantity: product.quantity ?? 1, images,
  }), [product, images]);
  const { quantity: inCart, add, decrement } = useCartControls(cardProduct);

  // Secondary content (reviews, seller's other items, similar products) loads AFTER the main product is on screen,
  // so it never competes with the photo, title, price and Add to Cart for bandwidth or CPU.
  const [later, setLater] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLater(true), 700); return () => clearTimeout(t); }, []);

  const { data: reviews } = useQuery({
    queryKey: ['seller-reviews', seller?.id], enabled: !!seller?.id && later,
    queryFn: async () => (await (await getSupabase()).from('reviews').select('id, rating, title, content, created_at').eq('seller_id', seller.id).order('created_at', { ascending: false }).limit(3)).data ?? [],
  });
  const { data: listingCount } = useQuery({
    queryKey: ['seller-listing-count', seller?.id], enabled: !!seller?.id && later,
    queryFn: async () => (await (await getSupabase()).from('products').select('id', { count: 'exact', head: true }).eq('seller_id', seller.id).eq('status', 'ACTIVE')).count ?? 0,
  });
  const { data: more } = useQuery({
    queryKey: ['seller-more', seller?.id, id], enabled: !!seller?.id && later,
    queryFn: async () => {
      const { data } = await (await getSupabase()).from('products')
        .select('id, title, price, original_price, condition, location, is_negotiable, quantity, created_at, profiles!products_seller_id_fkey(full_name, verification_status, profile_photo), product_images(storage_path, is_primary), categories(name, slug)')
        .eq('seller_id', seller.id).eq('status', 'ACTIVE').neq('id', id).order('created_at', { ascending: false }).limit(5);
      return ((data ?? []) as any[]).map((p) => ({ ...p, images: p.product_images, seller: p.profiles, category: p.categories })) as CardProduct[];
    },
  });
  const { data: similar } = useProducts({ category: product.category?.slug, limit: 8 }, undefined, later);
  const similarProducts = useMemo(() => {
    const own = new Set([id, ...(more ?? []).map((m) => m.id)]);
    return (similar?.products ?? []).filter((p: any) => !own.has(p.id)).slice(0, 5);
  }, [similar, more, id]);

  // ---- actions
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.title, text: `${product.title} on StudentMarket`, url });
      else { await navigator.clipboard.writeText(url); toast.success('Link copied'); }
    } catch { /* cancelled */ }
  };

  const onAdd = (e: React.MouseEvent<HTMLElement>) => {
    if (inCart > 0) { router.push('/cart'); return; }
    const photo = gallery.current?.currentImage() ?? null;
    const r = photo?.getBoundingClientRect();
    // Take off from the photo when it's on screen; otherwise from the button that was pressed
    const visible = !!r && r.bottom > 72 && r.top < window.innerHeight - 72;
    let flight: string | null = null;
    if (!add(() => cancelFly(flight))) return;
    flight = fly(visible ? photo : e.currentTarget, photo);
  };

  const onBuyNow = () => {
    if (inCart > 0) { router.push('/checkout'); return; }
    addToCart({ productId: product.id }, { onSuccess: () => router.push('/checkout'), onError: (e: Error) => { if (/already/i.test(e.message)) router.push('/checkout'); } });
  };

  const specs: [string, string | undefined][] = [
    ['Condition', condition?.label], ['Category', product.category?.name],
    ['Purchased', product.year_purchased ? String(product.year_purchased) : undefined],
    ['Brand', product.brand], ['Model', product.model],
    ['Listed', product.created_at ? formatRelativeTime(product.created_at) : undefined],
  ];
  const chips = specs.filter(([, v]) => v) as [string, string][];

  const wishBtn = (cls: string) => (
    <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => toggle(product.id)} aria-pressed={wished} aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'} className={cls}>
      <motion.span key={String(wished)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={SPRING.bouncy} className="flex"><Heart className={cn('h-5 w-5', wished && 'fill-rose-500 text-rose-500')} /></motion.span>
    </motion.button>
  );

  const cartButton = (className?: string) => inCart > 0 ? (
    <div className={cn('flex gap-2', className)}>
      <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => router.push('/cart')} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-2 border-green-600 bg-green-50 px-4 text-sm font-bold text-green-800">
        <Check className="h-4 w-4" strokeWidth={3} /> In cart · View cart
      </motion.button>
      <button type="button" onClick={() => decrement()} aria-label="Remove from cart" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-white text-gray-400 transition-colors hover:border-red-200 hover:text-red-500"><X className="h-4 w-4" /></button>
    </div>
  ) : (
    <motion.button type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={onAdd} disabled={sold} aria-label={`Add ${product.title} to cart`} className={cn('flex h-12 items-center justify-center gap-2 rounded-full border-2 border-ink bg-white px-5 text-sm font-bold text-ink transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50', className)}>
      <ShoppingBag className="hidden h-4 w-4 min-[400px]:block" /> <span className="whitespace-nowrap">Add to Cart</span>
    </motion.button>
  );

  return (
    <div className="page-container pb-28 pt-0 lg:pb-10 lg:pt-6">
      <nav aria-label="Breadcrumb" className="mb-5 hidden items-center gap-1.5 text-sm text-ink-muted lg:flex">
        <Link href="/browse" className="hover:text-ink">Marketplace</Link>
        {product.category && (<><ChevronRight className="h-3.5 w-3.5" /><Link href={`/browse?category=${product.category.slug}`} className="hover:text-ink">{product.category.name}</Link></>)}
        <ChevronRight className="h-3.5 w-3.5" /><span className="truncate text-ink-soft">{product.title}</span>
      </nav>

      <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <div className="lg:sticky lg:top-32">
          <ProductGallery
            ref={gallery} images={images} title={product.title}
            overlay={(
              <>
                <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push('/browse'))} aria-label="Go back" className={glass}><ArrowLeft className="h-5 w-5" /></button>
                <div className="flex items-center gap-2">
                  {wishBtn(glass)}
                  <button type="button" onClick={share} aria-label="Share" className={glass}><Share2 className="h-[18px] w-[18px]" /></button>
                  <div className="[&_a]:h-10 [&_a]:w-10 [&_a]:bg-white/90 [&_a]:text-ink [&_a]:shadow-lift [&_a]:backdrop-blur"><CartIconLink /></div>
                </div>
              </>
            )}
          />
        </div>

        <motion.div variants={stagger(0.07, 0.05)} initial={false} animate="show" className="space-y-6">
          <motion.div variants={fadeUp} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {verified && <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-green-800"><BadgeCheck className="h-3.5 w-3.5" /> Verified student</span>}
              <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-800"><Truck className="h-3.5 w-3.5" /> Doorstep delivery</span>
              {condition && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">{condition.label}</span>}
              {sold && <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-700">Sold</span>}
            </div>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">{product.title}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <Price value={Number(product.price)} original={product.original_price} size="xl" showDiscount />
              {product.negotiable && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">Negotiable</span>}
            </div>
            {seller?.seller_rating > 0 && <Rating value={seller.seller_rating} count={seller.seller_review_count} size="md" />}
          </motion.div>

          <motion.dl variants={fadeUp} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {chips.map(([k, v]) => <Chip key={k} label={k} value={v} />)}
            <Chip label="Location" value={(product.location || 'Nepal').split(',').slice(0, 2).join(',').trim()} />
            <Chip label="Delivery" value="To your door" />
          </motion.dl>

          {/* Desktop actions (phones use the sticky bar) */}
          <motion.div variants={fadeUp} className="hidden space-y-3 lg:block">
            <div className="flex gap-3">
              {cartButton('flex-1')}
              <motion.button type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={onBuyNow} disabled={sold || isAdding} className="btn-primary h-12 flex-1 rounded-full text-sm font-bold shadow-[0_14px_30px_-12px_rgba(22,163,74,0.8)]"><Zap className="h-4 w-4" /> Buy Now</motion.button>
              {wishBtn(cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition-colors', wished ? 'border-rose-300 bg-rose-50' : 'border-gray-200 bg-white text-gray-400 hover:border-rose-300 hover:text-rose-400'))}
            </div>
            <p className="flex items-center gap-2 text-xs text-ink-muted"><CreditCard className="h-3.5 w-3.5 text-green-600" /> Secure payment via eSewa · Rs. {DELIVERY.baseFee} delivery within {DELIVERY.baseKm} km · Rs. {PLATFORM_FEE} platform fee</p>
          </motion.div>

          <motion.section variants={fadeUp} className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-soft" aria-labelledby="about-h">
            <h2 id="about-h" className="mb-2 font-display text-lg font-bold text-ink">About this item</h2>
            <Description text={product.description || 'The seller has not added a description yet.'} />
          </motion.section>

          {/* Seller */}
          <motion.section variants={fadeUp} className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-soft" aria-labelledby="seller-h">
            <h2 id="seller-h" className="sr-only">Seller</h2>
            <div className="flex items-center gap-3.5">
              <Avatar name={seller?.full_name} src={seller?.profile_photo} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-bold text-ink">{seller?.full_name}</p>
                {verified && <p className="flex items-center gap-1 text-xs font-semibold text-green-700"><BadgeCheck className="h-3.5 w-3.5" /> Verified student</p>}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
                  <Rating value={seller?.seller_rating} count={seller?.seller_review_count} />
                  {!!listingCount && <span>{listingCount} {listingCount === 1 ? 'listing' : 'listings'}</span>}
                  {seller?.total_sales ? <span>{seller.total_sales} sold</span> : null}
                  {seller?.created_at && <span>Joined {formatDate(seller.created_at)}</span>}
                </div>
              </div>
            </div>
            <a href={supportWhatsAppUrl(`Hi StudentMarket support, I have a question about "${product.title}" (ID: ${product.id})`)} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-4 w-full justify-center px-4 py-2.5 text-sm"><MessageCircle className="h-4 w-4" /> Contact support</a>
          </motion.section>

          {/* Location */}
          <motion.section variants={fadeUp} className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-soft" aria-labelledby="loc-h">
            <h2 id="loc-h" className="mb-3 font-display text-lg font-bold text-ink">Location &amp; delivery</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700"><MapPin className="h-[18px] w-[18px]" /></span><div><p className="text-sm font-semibold text-ink">{(product.location || 'Nepal').split(',').slice(0, 3).join(',').trim()}</p><p className="text-xs text-ink-muted">Where the item is. The exact address stays private.</p></div></div>
              <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Truck className="h-[18px] w-[18px]" /></span><div><p className="text-sm font-semibold text-ink">Delivered to your address</p><p className="text-xs text-ink-muted">{formatPrice(DELIVERY.baseFee)} within {DELIVERY.baseKm} km, +{formatPrice(DELIVERY.perExtraKm)} per extra km. No meet-ups — we collect and deliver.</p></div></div>
            </div>
          </motion.section>

          <motion.section variants={fadeUp} className="rounded-2xl bg-green-50/70 p-5 ring-1 ring-green-200/60" aria-labelledby="trust-h">
            <h2 id="trust-h" className="mb-2.5 flex items-center gap-2 font-display text-base font-bold text-green-950"><ShieldCheck className="h-5 w-5 text-green-700" /> Buy with confidence</h2>
            <ul className="grid gap-1.5 text-sm text-green-900 sm:grid-cols-2">
              {['Verified student seller', 'Secure payment via eSewa', 'We collect & deliver — no meet-ups', 'Report problems before you confirm'].map((t) => <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-green-700" strokeWidth={3} /> {t}</li>)}
            </ul>
            <Link href="/policies#refunds" className="mt-3 inline-block text-xs font-semibold text-green-800 underline-offset-2 hover:underline">Read our refund &amp; delivery policy</Link>
          </motion.section>
        </motion.div>
      </div>

      {/* Reviews (real ones only) */}
      {reviews && reviews.length > 0 && (
        <Reveal>
          <section className="mt-12 rounded-2xl border border-gray-200/70 bg-white p-6 shadow-soft" aria-labelledby="reviews-h">
            <div className="mb-4 flex items-center justify-between"><h2 id="reviews-h" className="font-display text-xl font-bold text-ink">Seller reviews</h2><Rating value={seller?.seller_rating} count={seller?.seller_review_count} size="md" /></div>
            <ul className="divide-y divide-gray-100">
              {reviews.map((r: any) => (
                <li key={r.id} className="py-4 first:pt-0 last:pb-0"><Rating value={r.rating} />{r.title && <p className="mt-1 font-semibold text-ink">{r.title}</p>}{r.content && <p className="mt-0.5 text-sm text-ink-soft">{r.content}</p>}<p className="mt-1 text-xs text-ink-muted">{formatDate(r.created_at)}</p></li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      {!!more?.length && (
        <section className="mt-12" aria-labelledby="more-h">
          <h2 id="more-h" className="section-title mb-6 flex items-center gap-2.5"><Tag className="h-6 w-6 text-green-600" /> More from {seller?.full_name?.split(' ')[0] ?? 'this seller'}</h2>
          <ProductGrid products={more} onView />
        </section>
      )}

      {similarProducts.length > 0 && (
        <section className="mt-12" aria-labelledby="similar-h">
          <h2 id="similar-h" className="section-title mb-6">Similar products</h2>
          <ProductGrid products={similarProducts} onView />
        </section>
      )}

      {/* Phone buy bar */}
      <motion.div
        data-bottom-bar
        initial={reduced ? { opacity: 0 } : { y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: DURATION.slow, ease: EASE, delay: 0.2 }}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/70 bg-white/90 shadow-[0_-12px_30px_-18px_rgba(20,23,28,0.35)] backdrop-blur-xl lg:hidden"
      >
        <div className="flex items-center gap-3 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          <div className="min-w-0 shrink-0">
            <p className="text-[11px] font-medium text-ink-muted">Price</p>
            <p className="font-display text-xl font-extrabold leading-none text-ink">{formatPrice(Number(product.price))}</p>
          </div>
          {cartButton('flex-1 [&>button:first-child]:px-3')}
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onBuyNow} disabled={sold || isAdding} className="btn-primary h-12 flex-1 rounded-full px-4 text-sm font-bold shadow-[0_12px_26px_-12px_rgba(22,163,74,0.85)]">Buy Now</motion.button>
        </div>
      </motion.div>
    </div>
  );
}

/** The listing arrives already rendered by the server (`initialProduct`), so there is no client-side fetch waterfall. */
export default function ProductPageClient({ id, initialProduct }: { id: string; initialProduct: any }) {
  const { data: product, isLoading } = useProduct(id, initialProduct);
  if (isLoading) return <DetailSkeleton />;
  if (!product) return <EmptyState illustration="productCard" title="Product not found" text="This listing may have been sold or removed by the seller." action={{ label: 'Browse listings', href: '/browse' }} />;
  return <ProductView key={product.id} product={product} id={id} />;
}
