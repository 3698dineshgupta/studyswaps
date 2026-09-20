'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronLeft, ChevronRight, ImageOff, Maximize2 } from 'lucide-react'
import Lightbox from './Lightbox'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { DURATION, EASE } from '@/lib/motion'
import { cn, getSupabaseImageUrl, isCloudinaryUrl } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface GalleryHandle {
  /** The photo currently on screen (fly-to-cart clones this) */
  currentImage: () => HTMLImageElement | null
}

interface ProductGalleryProps {
  images: any[]
  title: string
  /** Buttons pinned over the photo on phones (back / save / share / cart) */
  overlay?: React.ReactNode
}

/** Animated "2 / 6" that rolls when the number changes. */
function Counter({ index, total, className }: { index: number; total: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur', className)} aria-live="polite" aria-label={`Photo ${index + 1} of ${total}`}>
      <span className="relative inline-flex h-4 w-2.5 justify-center overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={index} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.18 }} className="absolute leading-4">{index + 1}</motion.span>
        </AnimatePresence>
      </span>
      / {total}
    </span>
  )
}

/**
 * The hero of the product page. Desktop: big photo with crossfade, hover zoom, arrows, thumbnails.
 * Phones: edge-to-edge swipeable strip (native scroll-snap, so vertical page scrolling is never blocked).
 * Either way, tapping/clicking the photo opens the full-screen viewer.
 */
const ProductGallery = forwardRef<GalleryHandle, ProductGalleryProps>(function ProductGallery({ images, title, overlay }, ref) {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const [full, setFull] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const n = images.length

  useImperativeHandle(ref, () => ({
    currentImage: () => rootRef.current?.querySelector<HTMLImageElement>('img[data-current-photo]') ?? null,
  }))

  const url = (i: number, w: number) => getSupabaseImageUrl(images[i].storage_path, w)

  const go = useCallback((next: number) => {
    if (n < 2) return
    const t = (next + n) % n
    setDir(next > index ? 1 : -1)
    setIndex(t)
    // keep the phone strip in step when changed from elsewhere (e.g. the full-screen viewer)
    const el = trackRef.current
    if (el && Math.round(el.scrollLeft / el.clientWidth) !== t) el.scrollTo({ left: t * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' })
  }, [index, n, reduced])

  // Phone strip: which slide is centred → index
  const onScroll = useCallback(() => {
    const el = trackRef.current
    if (!el || !el.clientWidth) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    setIndex((cur) => (cur === i ? cur : i))
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1) }
    if (e.key === 'Enter' && e.target === e.currentTarget) setFull(true)
  }

  // Zoom follows the pointer (no re-render: only CSS variables change)
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--zx', `${((e.clientX - r.left) / r.width) * 100}%`)
    e.currentTarget.style.setProperty('--zy', `${((e.clientY - r.top) / r.height) * 100}%`)
  }

  useEffect(() => { setIndex(0) }, [n])

  if (!n) {
    return (
      <div ref={rootRef as any} className="relative -mx-4 flex h-[46svh] items-center justify-center bg-gray-100 text-gray-300 sm:-mx-6 lg:mx-0 lg:aspect-[5/4] lg:h-auto lg:rounded-3xl">
        <ImageOff className="h-10 w-10" />
        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] lg:hidden">{overlay}</div>
      </div>
    )
  }

  return (
    <motion.div
      ref={rootRef}
      // No opacity:0 start: the main photo is the page's largest element and must be visible without waiting for JavaScript
      initial={false}
      className="space-y-3"
    >
      {desktop ? (
        <>
          <div
            tabIndex={0} onKeyDown={onKeyDown} aria-label={`${title} photos. Use the arrow keys to browse, Enter to enlarge.`}
            onMouseMove={onMove}
            onClick={() => setFull(true)}
            className="group relative aspect-[5/4] cursor-zoom-in overflow-hidden rounded-3xl border border-gray-200/70 bg-gray-100 shadow-soft outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
            style={{ ['--zx' as any]: '50%', ['--zy' as any]: '50%' }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={index}
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir * 36 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -36 }}
                transition={{ duration: DURATION.slow, ease: EASE }}
                className="absolute inset-0"
              >
                <Image
                  {...{ 'data-current-photo': true }}
                  src={url(index, 1200)} alt={`${title} — photo ${index + 1} of ${n}`} fill priority sizes="(min-width:1024px) 55vw, 100vw"
                  unoptimized={isCloudinaryUrl(url(index, 1200))}
                  className="object-cover transition-transform duration-500 ease-out [@media(hover:hover)]:group-hover:scale-[1.45]"
                  style={{ transformOrigin: 'var(--zx) var(--zy)' }}
                />
              </motion.div>
            </AnimatePresence>

            {n > 1 && [{ d: -1, Icon: ChevronLeft, side: 'left-3', label: 'Previous photo' }, { d: 1, Icon: ChevronRight, side: 'right-3', label: 'Next photo' }].map(({ d, Icon, side, label }) => (
              <motion.button key={label} type="button" whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); go(index + d) }} aria-label={label} className={cn('absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-lift backdrop-blur transition-opacity hover:bg-white [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100', side)}>
                <Icon className="h-5 w-5" />
              </motion.button>
            ))}
            <Counter index={index} total={n} className="absolute bottom-3 right-3 z-10" />
            <span className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink-soft opacity-0 shadow-soft backdrop-blur transition-opacity group-hover:opacity-100"><Maximize2 className="h-3 w-3" /> Click to enlarge</span>
          </div>

          {n > 1 && (
            <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
              {images.map((img, i) => (
                <button key={img.storage_path + i} type="button" onClick={() => go(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === index}
                  className={cn('relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-2xl border-2 bg-gray-100 transition-all', i === index ? 'border-green-600 shadow-soft' : 'border-transparent opacity-65 hover:opacity-100')}>
                  <Image src={url(i, 200)} alt="" fill sizes="76px" unoptimized={isCloudinaryUrl(url(i, 200))} className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        // Phones: full-bleed strip, ~46% of the screen; swipe = native horizontal scroll with snap
        <div className="relative -mx-4 sm:-mx-6">
          <div
            ref={trackRef} onScroll={onScroll}
            className="no-scrollbar flex h-[46svh] min-h-[300px] snap-x snap-mandatory overflow-x-auto overscroll-x-contain bg-gray-100"
          >
            {images.map((img, i) => (
              <button key={img.storage_path + i} type="button" onClick={() => setFull(true)} aria-label={`Enlarge photo ${i + 1} of ${n}`} className="relative h-full w-full shrink-0 snap-center">
                <Image
                  {...(i === index ? { 'data-current-photo': true } : {})}
                  src={url(i, 900)} alt={`${title} — photo ${i + 1} of ${n}`} fill priority={i === 0} sizes="100vw"
                  unoptimized={isCloudinaryUrl(url(i, 900))} className="object-cover"
                />
              </button>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" />
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">{overlay}</div>
          {n > 1 && <Counter index={index} total={n} className="absolute bottom-3 right-3" />}
          {n > 1 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3.5 flex justify-center gap-1.5" aria-hidden>
              {images.map((_, i) => <span key={i} className={cn('h-1.5 rounded-full bg-white transition-all duration-300', i === index ? 'w-5 opacity-100' : 'w-1.5 opacity-60')} />)}
            </div>
          )}
        </div>
      )}

      <Lightbox images={images} title={title} open={full} index={index} onIndexChange={go} onClose={() => setFull(false)} />
    </motion.div>
  )
})

export default ProductGallery
