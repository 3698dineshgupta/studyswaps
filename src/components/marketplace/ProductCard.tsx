'use client'

import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence, motion } from 'motion/react'
import { Heart, ImageOff } from 'lucide-react'
import Price from '@/components/ui/Price'
import LocationBadge from '@/components/ui/LocationBadge'
import SellerBadge from '@/components/shared/SellerBadge'
import AddToCartButton from '@/components/cart/AddToCartButton'
import { useWishlist } from '@/hooks/useWishlist'
import { PRODUCT_CONDITIONS } from '@/lib/constants'
import { SPRING } from '@/lib/motion'
import { cn, formatRelativeTime, getSupabaseImageUrl, isCloudinaryUrl } from '@/lib/utils'

/** Loose on purpose: list, wishlist and search endpoints return slightly different shapes. */
export interface CardProduct {
  id: string
  title: string
  price: number
  original_price?: number | null
  condition?: string
  location?: string | null
  created_at?: string
  is_negotiable?: boolean
  /** Units in stock (defaults to 1 — most listings are one-of-a-kind) */
  quantity?: number
  images?: { storage_path: string; is_primary?: boolean }[]
  product_images?: { storage_path: string; is_primary?: boolean }[]
  seller?: { full_name?: string; verification_status?: string; profile_photo?: string | null } | null
  profiles?: { full_name?: string; verification_status?: string; profile_photo?: string | null } | null
  category?: { name: string; slug: string } | null
  categories?: { name: string; slug: string } | null
}

interface ProductCardProps {
  product: CardProduct
  /** Load the image eagerly (use for the first row above the fold) */
  priority?: boolean
  className?: string
}

function WishlistButton({ productId, title }: { productId: string; title: string }) {
  const { isWishlisted, toggle } = useWishlist()
  const wished = isWishlisted(productId)
  return (
    <motion.button
      type="button"
      onClick={() => toggle(productId)}
      whileTap={{ scale: 0.82 }}
      whileHover={{ scale: 1.08 }}
      aria-pressed={wished}
      aria-label={wished ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`}
      className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-soft backdrop-blur transition-colors hover:bg-white"
    >
      <AnimatePresence initial={false}>
        {wished && (
          <motion.span
            key="ring"
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-rose-400"
            initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 1.8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
      <motion.span key={String(wished)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={SPRING.bouncy} className="flex">
        <Heart className={cn('h-[18px] w-[18px] transition-colors', wished ? 'fill-rose-500 text-rose-500' : 'text-ink-soft')} />
      </motion.span>
    </motion.button>
  )
}

export function ProductCard({ product, priority = false, className }: ProductCardProps) {
  const images = product.images ?? product.product_images ?? []
  const primary = images.find((i) => i.is_primary) ?? images[0]
  const src = primary ? getSupabaseImageUrl(primary.storage_path, 560) : null

  const seller = product.seller ?? product.profiles
  const category = product.category ?? product.categories
  const condition = PRODUCT_CONDITIONS.find((c) => c.value === product.condition)
  const discount = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0

  return (
    <article className={cn('group card-hover relative flex h-full flex-col has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-green-500 has-[a:focus-visible]:ring-offset-2', className)}>
      {/* Image is the visual focus */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {src ? (
          <Image
            src={src}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
            unoptimized={isCloudinaryUrl(src) || src.startsWith('blob:')}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300"><ImageOff className="h-8 w-8" /></div>
        )}

        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between">
          <div className="flex flex-wrap gap-1">
            {condition && (
              <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink-soft shadow-soft backdrop-blur">{condition.label}</span>
            )}
          </div>
          <WishlistButton productId={product.id} title={product.title} />
        </div>

        {discount > 0 && (
          <span className="absolute bottom-2.5 left-2.5 rounded-md bg-green-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-soft">-{discount}%</span>
        )}

        {/* Quick add — sits above the stretched link, so tapping it never opens the product */}
        <div className="absolute bottom-2.5 right-2.5 z-10">
          <AddToCartButton product={product} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        {category?.name && <span className="text-[11px] font-semibold uppercase tracking-wider text-green-700">{category.name}</span>}

        <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-ink">
          {/* Stretched link: the whole card is clickable without nesting the heart button inside an <a> */}
          <Link href={`/product/${product.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.title}
          </Link>
        </h3>

        <Price value={product.price} original={product.original_price} size="md" />

        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
          <SellerBadge name={seller?.full_name} photo={seller?.profile_photo} verified={seller?.verification_status === 'VERIFIED'} />
          <LocationBadge location={product.location} className="max-w-[45%]" />
        </div>
        {product.created_at && <p className="text-[11px] text-ink-muted">{formatRelativeTime(product.created_at)}</p>}
      </div>
    </article>
  )
}

export default ProductCard
