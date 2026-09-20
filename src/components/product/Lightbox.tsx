'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import { DURATION, EASE, SPRING } from '@/lib/motion'
import { cn, getSupabaseImageUrl, isCloudinaryUrl } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface LightboxProps {
  images: any[]
  title: string
  open: boolean
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}

/** Full-screen photo viewer: dark backdrop, big image, thumbnails, arrows, swipe, click-to-zoom, ← → Esc. */
export default function Lightbox({ images, title, open, index, onIndexChange, onClose }: LightboxProps) {
  const reduced = useReducedMotion()
  const [dir, setDir] = useState(1)
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const n = images.length
  useEffect(() => setMounted(true), [])

  const go = useCallback((next: number) => {
    if (n < 2) return
    setDir(next > index ? 1 : -1)
    setZoom(null)
    onIndexChange((next + n) % n)
  }, [index, n, onIndexChange])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(index + 1)
      else if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; opener?.focus?.() }
  }, [open, go, index, onClose])

  useEffect(() => { if (!open) setZoom(null) }, [open])

  if (!mounted) return null
  const src = (i: number, w: number) => getSupabaseImageUrl(images[i]?.storage_path, w)
  const main = images[index] ? src(index, 1600) : ''

  const pointer = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }
  }

  return createPortal(
    <AnimatePresence>
      {open && images.length > 0 && (
        <motion.div
          role="dialog" aria-modal="true" aria-label={`${title} — photo gallery`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DURATION.normal }}
          className="fixed inset-0 z-[110] flex flex-col bg-black/95 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between px-4 py-3 text-white sm:px-6">
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold tabular-nums">{index + 1} / {n}</span>
            <p className="mx-4 hidden min-w-0 flex-1 truncate text-center text-sm font-medium text-white/80 sm:block">{title}</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setZoom(zoom ? null : { x: 50, y: 50 })} aria-label={zoom ? 'Zoom out' : 'Zoom in'} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20">{zoom ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}</button>
              <button ref={closeRef} type="button" onClick={onClose} aria-label="Close gallery" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"><X className="h-5 w-5" /></button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={index}
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir * 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -60 }}
                transition={{ duration: DURATION.slow, ease: EASE }}
                drag={zoom ? false : 'x'} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.35}
                onDragEnd={(_, info) => { if (info.offset.x < -70 || info.velocity.x < -450) go(index + 1); else if (info.offset.x > 70 || info.velocity.x > 450) go(index - 1) }}
                className="absolute inset-0 px-2 sm:px-16"
              >
                <div
                  className={cn('relative h-full w-full overflow-hidden', zoom ? 'cursor-zoom-out' : 'cursor-zoom-in')}
                  onClick={(e) => setZoom(zoom ? null : pointer(e))}
                  onMouseMove={(e) => { if (zoom) setZoom(pointer(e)) }}
                >
                  <Image
                    src={main} alt={`${title} — photo ${index + 1} of ${n}`} fill sizes="100vw" priority draggable={false}
                    unoptimized={isCloudinaryUrl(main)}
                    className="select-none object-contain transition-transform duration-300 ease-out"
                    style={{ transform: zoom ? 'scale(2.2)' : 'scale(1)', transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : 'center' }}
                  />
                </div>
              </motion.div>
            </AnimatePresence>

            {n > 1 && (
              <>
                <button type="button" onClick={() => go(index - 1)} aria-label="Previous photo" className="absolute left-3 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/25 sm:flex"><ChevronLeft className="h-6 w-6" /></button>
                <button type="button" onClick={() => go(index + 1)} aria-label="Next photo" className="absolute right-3 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/25 sm:flex"><ChevronRight className="h-6 w-6" /></button>
              </>
            )}
          </div>

          {n > 1 && (
            <div className="flex justify-center gap-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
              {images.map((img, i) => (
                <motion.button
                  key={img.storage_path + i} type="button" onClick={() => go(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === index}
                  whileTap={{ scale: 0.94 }} transition={SPRING.snappy}
                  className={cn('relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition-all sm:h-16 sm:w-16', i === index ? 'border-green-500' : 'border-transparent opacity-55 hover:opacity-100')}
                >
                  <Image src={src(i, 160)} alt="" fill sizes="64px" unoptimized={isCloudinaryUrl(src(i, 160))} className="object-cover" />
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
