'use client';

/**
 * A one-time nudge for signed-in users who haven't connected Telegram yet: "get these instantly". Shown at most
 * once a day (never if already connected, never on /profile where the full Notifications tab already covers this,
 * and never again once dismissed for good). Mounted once, site-wide, in the root layout.
 */

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { CheckCircle2, ExternalLink, Send } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useAuthState } from '@/components/auth/AuthProvider';

const SHOWN_KEY = 'sm_telegram_prompt_shown_at';
const DISMISSED_KEY = 'sm_telegram_prompt_dismissed';
const SHOW_AFTER_MS = 2500; // let the page settle first — never greet with a popup on first paint
const RESHOW_AFTER_MS = 24 * 60 * 60 * 1000;
const POLL_MS = 3000;
const POLL_MAX_MS = 5 * 60 * 1000;

export default function TelegramConnectPrompt() {
  const { profile } = useAuthState();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [linkInfo, setLinkInfo] = useState<{ deepLink: string; code: string; expiresInMinutes: number } | null>(null);
  const [connected, setConnected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, []);

  useEffect(() => {
    if (!profile || pathname?.startsWith('/profile')) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
      const last = Number(localStorage.getItem(SHOWN_KEY) || 0);
      if (Date.now() - last < RESHOW_AFTER_MS) return;
    } catch { /* localStorage unavailable (private window) — just skip the nag */ return; }

    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/telegram/link');
        const data = await res.json().catch(() => ({}));
        if (data.configured && !data.connected) {
          setOpen(true);
          try { localStorage.setItem(SHOWN_KEY, String(Date.now())); } catch { /* ignore */ }
        }
      } catch { /* no popup if the check fails — never worth bothering the user over */ }
    }, SHOW_AFTER_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, pathname]);

  const dismiss = (forGood: boolean) => {
    setOpen(false);
    if (forGood) { try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* ignore */ } }
  };

  const connect = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/telegram/link', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not start the connection');
      setLinkInfo(data);
      window.open(data.deepLink, '_blank');

      const startedAt = Date.now();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        if (Date.now() - startedAt > POLL_MAX_MS) { if (pollRef.current) clearInterval(pollRef.current); return; }
        const r = await fetch('/api/telegram/link');
        const s = await r.json().catch(() => ({}));
        if (s.connected) {
          if (pollRef.current) clearInterval(pollRef.current);
          setConnected(true);
          try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* ignore */ }
          toast.success('Telegram connected!');
        }
      }, POLL_MS);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={() => dismiss(false)} title={connected ? 'Connected!' : 'Get instant notifications'} size="sm">
      {connected ? (
        <div className="space-y-4 py-2 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
          <p className="text-sm text-ink-soft">You&apos;ll get a Telegram message the moment something needs your attention.</p>
          <Button onClick={() => setOpen(false)} fullWidth>Done</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">Connect Telegram to hear about new offers, order updates and payments the moment they happen — in addition to email.</p>

          {linkInfo ? (
            <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
              <p className="text-ink-soft">Opened Telegram for you. If it didn&apos;t open, tap below and send <span className="font-mono font-semibold text-ink">/start</span>:</p>
              <a href={linkInfo.deepLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 break-all font-semibold text-green-700 hover:underline">
                Open Telegram <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
              <p className="text-xs text-ink-muted">Code expires in {linkInfo.expiresInMinutes} minutes. This closes automatically once you&apos;ve connected.</p>
            </div>
          ) : (
            <Button onClick={connect} loading={connecting} fullWidth><Send className="h-4 w-4" /> Connect Telegram</Button>
          )}

          <div className="flex items-center justify-center gap-4 pt-1 text-xs">
            <button type="button" onClick={() => dismiss(false)} className="font-semibold text-ink-muted hover:text-ink">Maybe later</button>
            <button type="button" onClick={() => dismiss(true)} className="text-ink-muted/70 hover:text-ink-muted">Don&apos;t ask again</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
