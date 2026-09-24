'use client';

/**
 * Step 1 of live verification: photograph the FRONT of the student ID card with the live camera (back camera on phones).
 * Like the selfie step, there is no file input anywhere — the photo can only come from the camera stream.
 * The server stores the image privately and returns a token that the selfie step must present.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle, Loader2, Lock, RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';
import { grabFrame, mapCameraError } from '@/components/verification/LiveCameraCapture';
import { AUTO, Steady, checkCard, motion, toGray, visibleRegion } from '@/lib/autoCapture';

type Phase = 'idle' | 'starting' | 'live' | 'captured' | 'uploading' | 'done' | 'error';

interface Props {
  /** Called with the server-issued token once the ID card photo is stored. */
  onComplete: (idCardToken: string) => void;
  /** Set when the card was already captured (user came back to this step). */
  captured?: boolean;
}

export default function IdCardCapture({ onComplete, captured }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startIdRef = useRef(0);
  const blobRef = useRef<Blob | null>(null);
  const previewRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const autoRef = useRef<() => void>(() => {});

  const [phase, setPhase] = useState<Phase>(captured ? 'done' : 'idle');
  const [error, setError] = useState<ReturnType<typeof mapCameraError> | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Auto-capture: what the live picture looks like right now, and how close we are to taking the photo
  const [guide, setGuide] = useState<{ text: string; ok: boolean; progress: number }>({ text: 'Fit the FRONT of your ID card inside the frame', ok: false, progress: 0 });

  const stopCamera = useCallback(() => {
    startIdRef.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop()); // camera light off
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const clearPreview = useCallback(() => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    blobRef.current = null;
    setPreviewUrl(null);
  }, []);

  const startCamera = useCallback(async () => {
    const startId = ++startIdRef.current;
    setError(null);
    setUploadError(null);
    clearPreview();
    setPhase('starting');

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPhase('error');
      setError(window.isSecureContext === false
        ? { title: 'Secure connection required', message: 'Camera access only works on a secure (HTTPS) connection.', canRetry: false }
        : { title: 'Camera not supported', message: 'This browser does not support camera access. Please use an up-to-date Chrome, Safari, Edge or Firefox.', canRetry: false });
      return;
    }

    try {
      let stream: MediaStream;
      try {
        // The BACK camera is the sharpest one for reading small text on a card
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'OverconstrainedError') stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        else throw e;
      }
      if (startId !== startIdRef.current || cancelledRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stopCamera(); return; }
      video.srcObject = stream;
      await video.play();
      setPhase('live');
    } catch (err) {
      if (startId !== startIdRef.current) return;
      stopCamera();
      setPhase('error');
      setError(mapCameraError(err));
    }
  }, [clearPreview, stopCamera]);

  useEffect(() => {
    cancelledRef.current = false;
    if (!captured) void startCamera();
    const onHide = () => { if (document.hidden && streamRef.current) { stopCamera(); setPhase((p) => (p === 'live' ? 'idle' : p)); } };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', stopCamera);
    return () => {
      cancelledRef.current = true;
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', stopCamera);
      stopCamera();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || phase !== 'live') return;
    try {
      const blob = await grabFrame(video, 1600, 0.92);
      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      previewRef.current = url;
      setPreviewUrl(url);
      stopCamera();
      setPhase('captured');
    } catch {
      stopCamera();
      setPhase('error');
      setError({ title: 'Capture failed', message: 'We could not take the photo. Please try again.', canRetry: true });
    }
  };

  autoRef.current = handleCapture;

  // Look at the live picture a few times a second. When the card has lain inside the frame, in focus and steady, for about
  // a second, take the photo by ourselves. The Capture button stays available the whole time.
  useEffect(() => {
    if (phase !== 'live') return;
    const canvas = document.createElement('canvas');
    canvas.width = AUTO.W; canvas.height = AUTO.H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const frame = { x: AUTO.W * 0.09, y: (AUTO.H - (AUTO.W * 0.82) / 1.586) / 2, w: AUTO.W * 0.82, h: (AUTO.W * 0.82) / 1.586 };
    const steady = new Steady();
    let prev: Float32Array | null = null;
    let fired = false;
    const id = setInterval(() => {
      const v = videoRef.current;
      if (fired || !v || v.readyState < 2 || !v.videoWidth) return;
      const { sx, sy, sw, sh } = visibleRegion(v.videoWidth, v.videoHeight, v.clientWidth || 4, v.clientHeight || 3);
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, AUTO.W, AUTO.H);
      const gray = toGray(ctx.getImageData(0, 0, AUTO.W, AUTO.H).data, AUTO.W * AUTO.H);
      const r = checkCard(gray, AUTO.W, AUTO.H, frame);
      const still = motion(prev, gray, AUTO.W, frame) < 6;
      prev = gray;
      let text = 'Fit the FRONT of your ID card inside the frame';
      if (r.brightness < 50) text = 'Too dark — move to a brighter place';
      else if (r.glare > 0.12) text = 'Too much glare — tilt the card slightly';
      else if (r.sides < 3) text = 'Line the card edges up with the frame';
      else if (r.sharpness < 90 || r.detail < 0.05) text = 'Move a little closer / hold still so the text is sharp';
      else if (!still) text = 'Hold steady…';
      else text = 'Perfect — hold still…';
      const good = r.ok && still;
      const hit = steady.push(good);
      setGuide((g) => (g.text === text && g.ok === good && Math.abs(g.progress - steady.progress) < 0.01 ? g : { text, ok: good, progress: steady.progress }));
      if (hit) { fired = true; autoRef.current(); }
    }, AUTO.tickMs);
    return () => clearInterval(id);
  }, [phase]);

  const handleUse = async () => {
    if (!blobRef.current) return;
    setUploadError(null);
    setPhase('uploading');
    try {
      const fd = new FormData();
      fd.append('capture', new File([blobRef.current], 'id-front.jpg', { type: 'image/jpeg' }));
      const res = await fetch('/api/identity-verification/id-card', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setPhase('captured'); setUploadError(json.error || 'Upload failed. Please try again.'); return; }
      clearPreview();
      setPhase('done');
      onComplete(json.id_card_token);
    } catch {
      setPhase('captured');
      setUploadError('Network error — check your connection and try again.');
    }
  };

  const showVideo = phase === 'starting' || phase === 'live';

  if (phase === 'done') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100"><CheckCircle className="h-7 w-7 text-green-600" /></div>
        <div>
          <p className="font-semibold text-gray-900">ID card photo saved</p>
          <p className="mt-1 text-sm text-gray-500">Next, you&apos;ll take a selfie holding this same ID card.</p>
        </div>
        {captured && <Button variant="outline" onClick={() => { setPhase('idle'); void startCamera(); }} size="sm"><RotateCcw className="h-4 w-4" /> Retake ID photo</Button>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-md sm:max-w-xl">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-900">
          <video ref={videoRef} playsInline muted autoPlay className={`absolute inset-0 h-full w-full object-cover ${showVideo ? '' : 'hidden'}`} />

          {phase === 'live' && (
            <div className="pointer-events-none absolute inset-0">
              <div className={`absolute left-1/2 top-1/2 aspect-[1.586] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-xl border-[3px] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] transition-colors ${guide.ok ? 'border-solid border-green-400' : 'border-dashed border-white/80'}`} />
              <span className="absolute inset-x-4 bottom-7 mx-auto w-fit max-w-full rounded-full bg-black/60 px-3 py-1 text-center text-xs font-semibold text-white">{guide.text}</span>
              <div className="absolute inset-x-6 bottom-3 h-1.5 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-green-400 transition-[width] duration-200" style={{ width: `${Math.round(guide.progress * 100)}%` }} /></div>
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-green-400" /> Camera ready</div>
            </div>
          )}

          {phase === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white"><Loader2 className="h-8 w-8 animate-spin" /><p className="text-sm">Requesting camera access…</p></div>
          )}

          {(phase === 'captured' || phase === 'uploading') && previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Your captured ID card" className="absolute inset-0 h-full w-full object-contain bg-black" />
          )}
          {phase === 'uploading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 text-white"><Loader2 className="h-8 w-8 animate-spin" /><p className="text-sm font-medium">Uploading securely…</p></div>
          )}

          {(phase === 'idle' || phase === 'error') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              {phase === 'error' && error ? (
                <><AlertTriangle className="h-10 w-10 text-yellow-300" /><p className="font-semibold">{error.title}</p><p className="max-w-xs text-sm text-gray-200">{error.message}</p></>
              ) : (
                <><Camera className="h-12 w-12 text-green-300" /><p className="max-w-xs text-sm text-gray-200">We&apos;ll use your back camera. Nothing is uploaded until you confirm the photo.</p></>
              )}
            </div>
          )}
        </div>

        {phase === 'live' && <p className="mt-3 text-center text-xs text-gray-500">The photo is taken automatically when your card is lined up and steady — or tap the button yourself. Use good light, no glare.</p>}
        {phase === 'captured' && !uploadError && <p className="mt-3 text-center text-sm font-semibold text-green-700">Can you read every word on the card? If not, retake it.</p>}
        {uploadError && <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{uploadError}</div>}
      </div>

      <div className="mx-auto w-full max-w-md sm:max-w-xl">
        {(phase === 'idle' || phase === 'error') && (
          <Button onClick={startCamera} fullWidth size="lg" disabled={phase === 'error' && error?.canRetry === false}><Camera className="h-5 w-5" /> Open Camera</Button>
        )}
        {phase === 'live' && <Button onClick={handleCapture} fullWidth size="lg"><Camera className="h-5 w-5" /> Capture ID card</Button>}
        {(phase === 'captured' || phase === 'uploading') && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={startCamera} disabled={phase === 'uploading'} className="flex-1" size="lg"><RotateCcw className="h-4 w-4" /> Retake</Button>
            <Button onClick={handleUse} loading={phase === 'uploading'} className="flex-1" size="lg">Use this photo</Button>
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-md rounded-xl bg-blue-50 p-3 text-xs text-blue-700 sm:max-w-xl">
        <p className="flex items-start gap-2"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Your ID photo is stored in a private, access-controlled location and seen only by our verification team.</p>
      </div>
    </div>
  );
}
