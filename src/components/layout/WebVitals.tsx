'use client';

import { useReportWebVitals } from 'next/web-vitals';

/** Reports Core Web Vitals (LCP, CLS, INP, FCP, TTFB) from real visitors. Tiny, anonymous, sent when the tab is idle. */
export default function WebVitals() {
  useReportWebVitals((m) => {
    if (!['LCP', 'CLS', 'INP', 'FCP', 'TTFB'].includes(m.name)) return;
    const body = JSON.stringify({
      name: m.name, value: m.value, rating: m.rating,
      path: window.location.pathname,
      device: window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
    });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/vitals', new Blob([body], { type: 'application/json' }));
    else void fetch('/api/vitals', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } });
  });
  return null;
}
