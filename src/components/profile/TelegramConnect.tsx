'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, ExternalLink, Loader2, Send } from 'lucide-react';
import Button from '@/components/ui/Button';

type Status = { connected: boolean; username: string | null; configured: boolean };
type LinkInfo = { deepLink: string; code: string; expiresInMinutes: number };

const POLL_MS = 3000;
const POLL_MAX_MS = 5 * 60 * 1000;

/**
 * Lets a signed-in user connect their own Telegram account for instant notifications (offers, order updates),
 * in addition to email. Self-fetches its status — the parent profile page passes it nothing.
 */
export default function TelegramConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const loadStatus = async (): Promise<Status | null> => {
    try {
      const res = await fetch('/api/telegram/link');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load Telegram status');
      setStatus(data);
      return data as Status;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);
  useEffect(() => () => stopPolling(), []);

  const connect = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/telegram/link', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not start the connection');
      setLinkInfo(data);
      window.open(data.deepLink, '_blank');

      const startedAt = Date.now();
      stopPolling();
      pollRef.current = setInterval(async () => {
        if (Date.now() - startedAt > POLL_MAX_MS) { stopPolling(); return; }
        const fresh = await loadStatus();
        if (fresh?.connected) { stopPolling(); setLinkInfo(null); toast.success('Telegram connected!'); }
      }, POLL_MS);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect Telegram? You will stop getting instant notifications there.')) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/telegram/link', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not disconnect');
      toast.success('Telegram disconnected');
      setStatus((s) => (s ? { ...s, connected: false, username: null } : s));
      setLinkInfo(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking Telegram status…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Telegram notifications</h2>
        <p className="mt-1 text-sm text-ink-muted">Get a Telegram message the moment someone makes an offer on your listing, or when your order status changes — in addition to email.</p>
      </div>

      {!status?.configured ? (
        <p className="rounded-xl bg-gray-50 p-3.5 text-sm text-ink-muted">Telegram notifications aren&apos;t set up on this site yet.</p>
      ) : status.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-green-800">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
            <span className="truncate">Connected{status.username ? ` as @${status.username}` : ''}</span>
          </p>
          <Button variant="outline" size="sm" onClick={disconnect} loading={disconnecting}>Disconnect</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Button onClick={connect} loading={connecting}><Send className="h-4 w-4" /> Connect Telegram</Button>
          {linkInfo && (
            <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
              <p className="text-ink-soft">Opened Telegram for you. If it didn&apos;t open, tap below and send <span className="font-mono font-semibold text-ink">/start</span>:</p>
              <a href={linkInfo.deepLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 break-all font-semibold text-green-700 hover:underline">
                Open Telegram <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
              <p className="text-xs text-ink-muted">Code expires in {linkInfo.expiresInMinutes} minutes. This page will update automatically once you&apos;ve connected.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
