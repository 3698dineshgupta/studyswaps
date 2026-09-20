'use client';

/**
 * Live camera capture for identity verification.
 *
 * There is deliberately NO file input anywhere in this component: the only way to
 * produce a verification photo is a still grabbed from the live camera stream.
 * The server issues the verification session + random liveness challenge and
 * validates/stores the result — nothing security-relevant is decided here.
 *
 * Camera capture and the head-turn check are ADDITIONAL anti-fraud measures.
 * They raise the effort needed to fake an identity but do not, on their own,
 * guarantee that a photo or pre-recorded video is not being presented.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle, Loader2, Lock, RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';

type Phase = 'idle' | 'starting' | 'live' | 'challenge' | 'straighten' | 'captured' | 'uploading' | 'done' | 'error';

interface CameraError {
  title: string;
  message: string;
  /** Show "Open Camera" (true) or just let the user act on the message (false) */
  canRetry: boolean;
}

interface Challenge { id: string; text: string }

interface Props {
  /** Called with the server-issued verification id once the photo is stored. */
  onComplete: (verificationId: string) => void;
  /** Set when a capture already exists (user navigated back to this step). */
  existingVerificationId?: string;
}

const CHALLENGE_SECONDS = 3;
const STRAIGHTEN_SECONDS = 2;

/** Codes for which the only sensible action is to take a new photo */
const RETAKE_CODES = new Set(['INVALID_IMAGE', 'FILE_TOO_LARGE', 'IMAGE_TOO_SMALL', 'LIVENESS_FAILED', 'INVALID_SESSION', 'SESSION_EXPIRED', 'TOO_FAST', 'ALREADY_USED', 'MISSING_CAPTURE']);

function mapCameraError(err: unknown): CameraError {
  const name = err instanceof DOMException ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return {
        title: 'Camera permission denied',
        message: 'Please allow camera access in your browser (tap the camera/lock icon in the address bar), then press Open Camera.',
        canRetry: true,
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return { title: 'No camera found', message: 'We could not find a camera on this device. Connect a camera or use a phone or laptop with a camera.', canRetry: true };
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return { title: 'Camera is busy', message: 'Your camera is being used by another app or browser tab. Close it and press Open Camera again.', canRetry: true };
    case 'OverconstrainedError':
      return { title: 'Camera not compatible', message: 'Your camera does not support the required settings. Try a different camera or device.', canRetry: true };
    default:
      return { title: 'Could not start the camera', message: 'Something went wrong while opening the camera. Please try again.', canRetry: true };
  }
}

function grabFrame(video: HTMLVideoElement, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const w = Math.min(video.videoWidth, maxWidth);
    const h = Math.round((video.videoHeight / video.videoWidth) * w);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx || !w || !h) return reject(new Error('no-frame'));
    // Drawn straight from the stream, NOT mirrored, so the ID text stays readable
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode-failed'))), 'image/jpeg', quality);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function LiveCameraCapture({ onComplete, existingVerificationId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startIdRef = useRef(0);
  const analysisRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const captureRef = useRef<{ blob: Blob; frame1: Blob; frame2: Blob; token: string } | null>(null);
  const cancelledRef = useRef(false);

  const [phase, setPhase] = useState<Phase>(existingVerificationId ? 'done' : 'idle');
  const [error, setError] = useState<CameraError | null>(null);
  const [hint, setHint] = useState('Position your face and Student ID inside the guide.');
  const [prompt, setPrompt] = useState<{ text: string; seconds: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<{ message: string; retake: boolean } | null>(null);

  /* ---------------- camera lifecycle ---------------- */

  const stopCamera = useCallback(() => {
    startIdRef.current++; // invalidate any in-flight start
    if (analysisRef.current) { clearInterval(analysisRef.current); analysisRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop()); // turns the camera indicator off
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    captureRef.current = null; // discard the previous capture
  }, []);

  const startAnalysis = useCallback(() => {
    if (analysisRef.current) clearInterval(analysisRef.current);
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    // Optional browser face detection (Shape Detection API) — not available everywhere
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const FaceDetectorCtor = (window as any).FaceDetector;
    const detector = FaceDetectorCtor ? new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 1 }) : null;
    let busy = false;

    analysisRef.current = setInterval(async () => {
      const v = videoRef.current;
      if (busy || !ctx || !v || v.readyState < 2 || !v.videoWidth) return;
      busy = true;
      try {
        ctx.drawImage(v, 0, 0, 160, 120);
        const { data } = ctx.getImageData(0, 0, 160, 120);
        const gray = new Float32Array(160 * 120);
        let sum = 0;
        for (let i = 0; i < gray.length; i++) {
          const g = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
          gray[i] = g;
          sum += g;
        }
        const brightness = sum / gray.length;

        // Sharpness (variance of the Laplacian) inside the Student-ID guide area
        let n = 0, lapSum = 0, lapSq = 0;
        for (let y = 48; y < 88; y++) {
          for (let x = 84; x < 154; x++) {
            const i = y * 160 + x;
            const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - 160] - gray[i + 160];
            lapSum += lap; lapSq += lap * lap; n++;
          }
        }
        const sharpness = lapSq / n - (lapSum / n) ** 2;

        let message = 'Show your Student ID clearly';
        if (brightness < 55) message = 'Too dark — move to a brighter spot';
        else if (brightness > 210) message = 'Too bright — avoid strong light behind you';
        else if (detector) {
          const faces = await detector.detect(v).catch(() => null);
          if (faces) {
            const f = faces[0]?.boundingBox;
            if (!f) message = 'Center your face';
            else if (f.width / v.videoWidth < 0.16) message = 'Move closer';
            else if (Math.abs(f.x + f.width / 2 - v.videoWidth * 0.32) > v.videoWidth * 0.2) message = 'Center your face';
            else if (sharpness < 40) message = 'Make sure the ID text is readable';
          }
        } else if (sharpness < 40) {
          message = 'Make sure the ID text is readable';
        }
        setHint(message);
      } finally {
        busy = false;
      }
    }, 700);
  }, []);

  const startCamera = useCallback(async () => {
    const startId = ++startIdRef.current;
    setError(null);
    setUploadError(null);
    clearPreview();
    setPhase('starting');

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPhase('error');
      setError(
        window.isSecureContext === false
          ? { title: 'Secure connection required', message: 'Camera access only works on a secure (HTTPS) connection. Please open the site using https://.', canRetry: false }
          : { title: 'Camera not supported', message: 'This browser does not support camera access. Please use an up-to-date version of Chrome, Safari, Edge or Firefox.', canRetry: false }
      );
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, // FRONT camera
          audio: false,
        });
      } catch (e) {
        // Some desktops reject facingMode constraints — retry with any camera
        if (e instanceof DOMException && e.name === 'OverconstrainedError') {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw e;
        }
      }

      // Component unmounted, or another start superseded this one → release immediately
      if (startId !== startIdRef.current || cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      stream.getVideoTracks().forEach((t) => {
        t.onended = () => {
          if (streamRef.current === stream) {
            stopCamera();
            setPhase('error');
            setError({ title: 'Camera disconnected', message: 'The camera stopped working. Reconnect it and press Open Camera.', canRetry: true });
          }
        };
      });

      const video = videoRef.current;
      if (!video) { stopCamera(); return; }
      video.srcObject = stream;
      await video.play();
      setHint('Position your face and Student ID inside the guide.');
      setPhase('live');
      startAnalysis();
    } catch (err) {
      if (startId !== startIdRef.current) return;
      stopCamera();
      setPhase('error');
      setError(mapCameraError(err));
    }
  }, [clearPreview, startAnalysis, stopCamera]);

  // Open the front camera as soon as this step appears; always release it on the way out
  useEffect(() => {
    cancelledRef.current = false;
    if (!existingVerificationId) startCamera();

    const onHide = () => {
      if (document.hidden && streamRef.current) {
        stopCamera();
        setPhase((p) => (p === 'live' || p === 'challenge' || p === 'straighten' ? 'idle' : p));
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', stopCamera);

    return () => {
      cancelledRef.current = true;
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', stopCamera);
      stopCamera();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- capture (liveness challenge → still) ---------------- */

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || phase !== 'live') return;
    setUploadError(null);

    try {
      // 1. Server issues the session + random challenge
      const res = await fetch('/api/identity-verification/session', { method: 'POST' });
      const session = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError({ message: session.error || 'Could not start the verification. Please try again.', retake: false });
        return;
      }
      const challenge: Challenge = session.challenge;

      // 2. Random head-turn while we sample frames (movement evidence for the server)
      setPhase('challenge');
      const frame1 = await grabFrame(video, 320, 0.6);
      let frame2: Blob | null = null;
      for (let s = CHALLENGE_SECONDS; s > 0; s--) {
        setPrompt({ text: challenge.text, seconds: s });
        await sleep(1000);
        if (cancelledRef.current || !streamRef.current) return;
        if (s === 2) frame2 = await grabFrame(video, 320, 0.6); // mid-turn frame
      }
      if (!frame2) throw new Error('no-frame');

      // 3. Face forward, hold the ID, and take the real still
      setPhase('straighten');
      for (let s = STRAIGHTEN_SECONDS; s > 0; s--) {
        setPrompt({ text: 'Now look straight at the camera and hold your Student ID next to your face', seconds: s });
        await sleep(1000);
        if (cancelledRef.current || !streamRef.current) return;
      }
      const blob = await grabFrame(video, 1280, 0.9);

      captureRef.current = { blob, frame1, frame2, token: session.session_token };
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);

      // 4. Release the camera right after the capture
      setPrompt(null);
      stopCamera();
      setPhase('captured');
    } catch {
      setPrompt(null);
      stopCamera();
      setPhase('error');
      setError({ title: 'Capture failed', message: 'We could not capture the photo. Please try again.', canRetry: true });
    }
  };

  const handleRetake = () => {
    clearPreview(); // discard the old capture
    startCamera();
  };

  /* ---------------- upload confirmed photo ---------------- */

  const handleUse = async () => {
    const cap = captureRef.current;
    if (!cap) return;
    setUploadError(null);
    setPhase('uploading');

    try {
      const fd = new FormData();
      fd.append('session_token', cap.token);
      fd.append('capture', new File([cap.blob], 'capture.jpg', { type: 'image/jpeg' }));
      fd.append('frame_1', new File([cap.frame1], 'f1.jpg', { type: 'image/jpeg' }));
      fd.append('frame_2', new File([cap.frame2], 'f2.jpg', { type: 'image/jpeg' }));

      const res = await fetch('/api/identity-verification', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setPhase('captured');
        setUploadError({ message: json.error || 'Upload failed. Please try again.', retake: RETAKE_CODES.has(json.code) });
        return;
      }

      clearPreview();
      setPhase('done');
      onComplete(json.verification_id);
    } catch {
      // Network failure: keep the capture so the user can simply retry
      setPhase('captured');
      setUploadError({ message: 'Network error — check your connection and try again.', retake: false });
    }
  };

  /* ---------------- render ---------------- */

  const showVideo = ['starting', 'live', 'challenge', 'straighten'].includes(phase);
  const cameraActive = phase === 'live' || phase === 'challenge' || phase === 'straighten';

  if (phase === 'done') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="w-7 h-7 text-green-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">Photo captured successfully</p>
          <p className="text-sm text-gray-500 mt-1">Your live photo is stored privately and will be seen only by our verification team.</p>
        </div>
        {existingVerificationId && (
          <Button variant="outline" onClick={handleRetake} size="sm"><RotateCcw className="w-4 h-4" /> Retake</Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-md sm:max-w-xl">
        <div className="relative w-full aspect-[3/4] sm:aspect-[4/3] rounded-2xl overflow-hidden bg-gray-900">
          {/* Live feed (mirrored for a natural selfie view; the saved photo is NOT mirrored) */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`absolute inset-0 w-full h-full object-cover ${showVideo ? '' : 'hidden'}`}
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Alignment guides */}
          {cameraActive && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-[6%] top-[10%] w-[50%] h-[68%] rounded-[50%] border-[3px] border-dashed border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
              <span className="absolute left-[6%] top-[3%] w-[50%] text-center text-[11px] font-semibold text-white drop-shadow">Your face</span>
              <div className="absolute right-[4%] top-[42%] w-[38%] aspect-[1.586] rounded-lg border-[3px] border-dashed border-green-300 bg-green-300/10" />
              <span className="absolute right-[4%] top-[35%] w-[38%] text-center text-[11px] font-semibold text-green-200 drop-shadow">Student ID</span>
            </div>
          )}

          {/* Status pill */}
          {phase === 'live' && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white">
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" /> Camera ready
            </div>
          )}

          {/* Challenge / countdown overlay */}
          {(phase === 'challenge' || phase === 'straighten') && prompt && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-center text-white">
              <p className="text-base sm:text-lg font-bold leading-snug">{prompt.text}</p>
              <p className="mt-1 text-3xl font-extrabold text-green-300">{prompt.seconds}</p>
            </div>
          )}

          {phase === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm">Requesting camera access…</p>
            </div>
          )}

          {/* Captured preview */}
          {(phase === 'captured' || phase === 'uploading') && previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Your captured verification photo" className="absolute inset-0 w-full h-full object-cover" />
          )}
          {phase === 'uploading' && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3 text-white">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-medium">Uploading securely…</p>
            </div>
          )}

          {/* Idle / error placeholder */}
          {(phase === 'idle' || phase === 'error') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              {phase === 'error' && error ? (
                <>
                  <AlertTriangle className="w-10 h-10 text-yellow-300" />
                  <p className="font-semibold">{error.title}</p>
                  <p className="text-sm text-gray-200 max-w-xs">{error.message}</p>
                </>
              ) : (
                <>
                  <Camera className="w-12 h-12 text-green-300" />
                  <p className="text-sm text-gray-200 max-w-xs">We&apos;ll use your front camera. Nothing is uploaded until you confirm the photo.</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Instructions / status under the preview */}
        {phase === 'live' && (
          <div className="mt-3 space-y-1 text-center">
            <p className="text-sm font-semibold text-green-700" aria-live="polite">{hint}</p>
            <p className="text-xs text-gray-500">Make sure your face and all ID text are clearly visible.</p>
          </div>
        )}
        {phase === 'captured' && !uploadError && (
          <p className="mt-3 text-center text-sm font-semibold text-green-700">Photo captured successfully</p>
        )}
        {uploadError && (
          <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {uploadError.message}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mx-auto w-full max-w-md sm:max-w-xl">
        {(phase === 'idle' || phase === 'error') && (
          <Button onClick={startCamera} fullWidth size="lg" disabled={phase === 'error' && error?.canRetry === false}>
            <Camera className="w-5 h-5" /> Open Camera
          </Button>
        )}
        {phase === 'live' && (
          <Button onClick={handleCapture} fullWidth size="lg"><Camera className="w-5 h-5" /> Capture Photo</Button>
        )}
        {(phase === 'challenge' || phase === 'straighten') && (
          <Button fullWidth size="lg" disabled loading>Hold still…</Button>
        )}
        {(phase === 'captured' || phase === 'uploading') && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleRetake} disabled={phase === 'uploading'} className="flex-1" size="lg">
              <RotateCcw className="w-4 h-4" /> Retake
            </Button>
            {!(uploadError?.retake) && (
              <Button onClick={handleUse} loading={phase === 'uploading'} className="flex-1" size="lg">Use This Photo</Button>
            )}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-md sm:max-w-xl rounded-xl bg-blue-50 p-3 text-xs text-blue-700 space-y-1.5">
        <p className="flex items-start gap-2"><Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Your photo is stored in a private, access-controlled location and seen only by our verification team.</p>
        <p>Live capture and a quick head-turn check are extra anti-fraud steps. They help reduce fake verifications but are not a guarantee on their own.</p>
      </div>
    </div>
  );
}
