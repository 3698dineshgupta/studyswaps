'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Camera, Check, ChevronLeft, ChevronRight, ImagePlus, RotateCw, Star, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { PHOTO_MAX, PHOTO_MIN } from '@/lib/photos';
import { compressImage } from '@/lib/compressImage';
import { SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface PhotoItem {
  id: string;
  file: File;
  preview: string;
  status: 'queued' | 'uploading' | 'done' | 'error';
  progress: number;
  /** Reference returned by the server once uploaded (sent back when publishing) */
  ref?: string;
  error?: string;
}

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 10;
const PARALLEL = 3;

/** How many photos are safely uploaded (what the seller can actually publish with). */
export const uploadedCount = (items: PhotoItem[]) => items.filter((i) => i.status === 'done').length;

/** Upload one file with real progress (fetch can't report upload progress, XHR can). */
function upload(item: PhotoItem, onProgress: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/products/photos');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let json: { ref?: string; error?: string } = {};
      try { json = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && json.ref) resolve(json.ref);
      else reject(new Error(json.error || 'Upload failed'));
    };
    xhr.onerror = () => reject(new Error('Network problem — check your connection'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.timeout = 90000;
    const fd = new FormData();
    fd.append('file', item.file);
    xhr.send(fd);
  });
}

/**
 * Premium photo manager for listings: 3–6 photos, uploaded immediately with progress and retry,
 * drag to reorder (or use the arrows on touch), first photo = cover.
 */
export default function PhotoUploader({ items, setItems }: { items: PhotoItem[]; setItems: React.Dispatch<React.SetStateAction<PhotoItem[]>> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const started = useRef(new Set<string>());

  const patch = useCallback((id: string, p: Partial<PhotoItem>) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...p } : i))), [setItems]);

  // Start queued uploads, PARALLEL at a time
  useEffect(() => {
    const active = items.filter((i) => i.status === 'uploading').length;
    items.filter((i) => i.status === 'queued' && !started.current.has(i.id)).slice(0, Math.max(0, PARALLEL - active)).forEach((item) => {
      started.current.add(item.id);
      patch(item.id, { status: 'uploading', progress: 0 });
      upload(item, (progress) => patch(item.id, { progress }))
        .then((ref) => patch(item.id, { status: 'done', progress: 100, ref }))
        .catch((e: Error) => patch(item.id, { status: 'error', error: e.message }))
        .finally(() => started.current.delete(item.id));
    });
  }, [items, patch]);

  // Free the preview URLs when the form goes away
  const previewsRef = useRef<string[]>([]);
  previewsRef.current = items.map((i) => i.preview);
  useEffect(() => () => previewsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const addFiles = async (list: FileList | File[]) => {
    const incoming = Array.from(list);
    const room = PHOTO_MAX - items.length;
    if (room <= 0) { toast(`You can upload up to ${PHOTO_MAX} photos`); return; }
    const good = incoming.filter((f) => {
      if (!ACCEPT.includes(f.type)) { toast.error(`${f.name}: only JPG, PNG or WebP photos`); return false; }
      if (f.size > MAX_MB * 1024 * 1024) { toast.error(`${f.name} is over ${MAX_MB} MB`); return false; }
      return true;
    });
    if (good.length > room) toast(`You can upload up to ${PHOTO_MAX} photos — added the first ${room}`);
    // Shrink each photo first (fast uploads on mobile data; also keeps requests under serverless size limits)
    const shrunk = await Promise.all(good.slice(0, room).map(compressImage));
    const fresh: PhotoItem[] = shrunk.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, preview: URL.createObjectURL(file), status: 'queued', progress: 0,
    }));
    if (fresh.length) setItems((cur) => [...cur, ...fresh]);
  };

  const remove = (id: string) => setItems((cur) => { const g = cur.find((i) => i.id === id); if (g) URL.revokeObjectURL(g.preview); return cur.filter((i) => i.id !== id); });
  const move = (from: number, to: number) => setItems((cur) => { if (to < 0 || to >= cur.length || from === to) return cur; const n = [...cur]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n; });
  const makeCover = (i: number) => move(i, 0);
  const retry = (id: string) => { started.current.delete(id); patch(id, { status: 'queued', progress: 0, error: undefined }); };

  const count = items.length;
  const done = uploadedCount(items);
  const full = count >= PHOTO_MAX;
  const short = count < PHOTO_MIN;
  const uploading = items.some((i) => i.status === 'queued' || i.status === 'uploading');
  const failed = items.some((i) => i.status === 'error');

  const input = <input ref={inputRef} type="file" multiple accept={ACCEPT.join(',')} className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />;
  const pick = () => !full && inputRef.current?.click();

  return (
    <div className="space-y-5">
      {/* Counter + required-photo progress */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: PHOTO_MAX }).map((_, i) => (
            <motion.span key={i} animate={{ scale: i < count ? 1 : 0.85, backgroundColor: i < count ? '#16a34a' : i < PHOTO_MIN ? '#fcd34d' : '#e5e7eb' }} transition={SPRING.snappy} className="h-2 w-6 rounded-full sm:w-8" />
          ))}
        </div>
        <p className={cn('rounded-full px-3 py-1 text-sm font-bold tabular-nums', short ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800')} aria-live="polite">{count} / {PHOTO_MAX} photos</p>
      </div>

      {count === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          onClick={pick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick())}
          aria-label="Add product photos"
          className={cn('flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-all', dragOver ? 'scale-[1.01] border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50/60 hover:border-green-400 hover:bg-green-50/50')}
        >
          <motion.span animate={dragOver ? { y: -6, scale: 1.1 } : { y: 0, scale: 1 }} transition={SPRING.bouncy} className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-green-600 shadow-soft"><Camera className="h-8 w-8" /></motion.span>
          <p className="font-display text-lg font-bold text-ink">{dragOver ? 'Drop to upload' : 'Add product photos'}</p>
          <p className="mt-1 text-sm font-medium text-ink-soft">Upload {PHOTO_MIN}–{PHOTO_MAX} clear photos</p>
          <p className="mt-1 max-w-xs text-sm text-ink-muted">Show the product from different angles. JPG, PNG or WebP, up to {MAX_MB} MB each.</p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_-10px_rgba(22,163,74,0.9)]"><ImagePlus className="h-4 w-4" /> Choose photos</span>
          {input}
        </div>
      ) : (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } setDragId(null); }}
        >
          {items.map((it, i) => (
            <li
              key={it.id}
              draggable={it.status !== 'uploading'}
              onDragStart={(e) => { setDragId(it.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', it.id); }}
              onDragEnter={() => { if (dragId && dragId !== it.id) { const from = items.findIndex((x) => x.id === dragId); if (from >= 0) move(from, i); } }}
              onDragEnd={() => setDragId(null)}
              className={cn('relative', dragId === it.id && 'opacity-60')}
            >
              <motion.div layout transition={SPRING.soft} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={cn('group relative aspect-[4/3] overflow-hidden rounded-2xl border bg-gray-100 shadow-soft', i === 0 ? 'border-green-500 ring-2 ring-green-500/30' : 'border-gray-200', dragId === it.id && 'scale-[0.97]')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.preview} alt={`Photo ${i + 1}`} draggable={false} className={cn('h-full w-full object-cover transition-opacity', it.status !== 'done' && 'opacity-60')} />

                {i === 0 && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-green-600 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-soft"><Star className="h-3 w-3 fill-current" /> Cover</span>}
                <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-black/55 px-1.5 text-[11px] font-bold text-white backdrop-blur">{i + 1}</span>

                {/* upload state */}
                {(it.status === 'queued' || it.status === 'uploading') && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8" role="progressbar" aria-valuenow={it.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading photo ${i + 1}`}>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/30"><motion.div className="h-full rounded-full bg-white" animate={{ width: `${Math.max(6, it.progress)}%` }} transition={{ duration: 0.2 }} /></div>
                    <p className="mt-1 text-[11px] font-semibold text-white">{it.status === 'queued' ? 'Waiting…' : `Uploading ${it.progress}%`}</p>
                  </div>
                )}
                {it.status === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-950/60 p-3 text-center text-white">
                    <AlertCircle className="h-6 w-6" />
                    <p className="text-xs font-semibold">Upload failed</p>
                    <p className="line-clamp-1 text-[10px] text-white/80">{it.error}</p>
                    <button type="button" onClick={() => retry(it.id)} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-red-700"><RotateCw className="h-3 w-3" /> Retry</button>
                  </div>
                )}
                {it.status === 'done' && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING.bouncy} className="absolute bottom-2 left-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-white shadow-soft" aria-label="Uploaded"><Check className="h-3 w-3" strokeWidth={3.5} /></motion.span>
                )}

                {/* actions */}
                <div className={cn('absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 p-2 transition-opacity', it.status === 'done' ? 'sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100' : 'hidden')}>
                  <span className="mr-auto" />
                  {i > 0 && <button type="button" onClick={() => move(i, i - 1)} aria-label={`Move photo ${i + 1} earlier`} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink"><ChevronLeft className="h-4 w-4" /></button>}
                  {i < count - 1 && <button type="button" onClick={() => move(i, i + 1)} aria-label={`Move photo ${i + 1} later`} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink"><ChevronRight className="h-4 w-4" /></button>}
                  {i !== 0 && <button type="button" onClick={() => makeCover(i)} className="whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-ink">Set cover</button>}
                  <button type="button" onClick={() => remove(it.id)} aria-label={`Remove photo ${i + 1}`} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                {it.status === 'error' && <button type="button" onClick={() => remove(it.id)} aria-label={`Remove photo ${i + 1}`} className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
              </motion.div>
            </li>
          ))}

          <AnimatePresence initial={false}>
            {!full && (
              <motion.li key="add" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button type="button" onClick={pick} aria-label="Add photo" className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/60 text-gray-400 transition-colors hover:border-green-400 hover:bg-green-50/50 hover:text-green-600">
                  <ImagePlus className="h-7 w-7" /><span className="text-sm font-semibold">Add photo</span>
                </button>
              </motion.li>
            )}
          </AnimatePresence>
        </ul>
      )}
      {count > 0 && input}

      {/* Validation */}
      <div aria-live="polite" className="min-h-[24px]">
        {short ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-700"><AlertCircle className="h-4 w-4 shrink-0" /> {count === 0 ? `Add at least ${PHOTO_MIN} photos to continue` : `Add ${PHOTO_MIN - count} more photo${PHOTO_MIN - count === 1 ? '' : 's'} — at least ${PHOTO_MIN} are needed`}</p>
        ) : failed ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-red-700"><AlertCircle className="h-4 w-4 shrink-0" /> Some photos failed to upload — retry or remove them to continue</p>
        ) : uploading ? (
          <p className="text-sm font-medium text-ink-muted">Uploading your photos… {done} of {count} done</p>
        ) : full ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-green-700"><Check className="h-4 w-4" /> Maximum {PHOTO_MAX} photos — you can upload up to {PHOTO_MAX} photos</p>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-green-700"><Check className="h-4 w-4" /> Looks good — you can add up to {PHOTO_MAX - count} more</p>
        )}
      </div>

      {/* Guidance */}
      <div className="rounded-2xl border border-gray-200/70 bg-gray-50/70 p-4">
        <p className="text-sm font-semibold text-ink">Upload clear photos of the actual product.</p>
        <p className="mt-0.5 text-xs text-ink-muted">Use real photos of the item you&apos;re selling — not stock images. Buyers trust what they can see.</p>
        <ul className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-ink-soft">
          {['Front view', 'Back or side view', 'Close-up of details or wear'].map((t) => <li key={t} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 ring-1 ring-gray-200"><Check className="h-3 w-3 text-green-600" strokeWidth={3} /> {t}</li>)}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">The first photo is your <b className="text-ink-soft">cover</b>. Drag photos to reorder them, or use the arrows.</p>
      </div>
    </div>
  );
}
