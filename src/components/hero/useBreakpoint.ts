'use client';

import { useEffect, useState } from 'react';
import type { Breakpoint } from './types';

/**
 * Current screen size class. `ready` stays false until the browser has measured it, so the
 * hero never renders the wrong number of objects during hydration.
 */
export function useBreakpoint(): { bp: Breakpoint; ready: boolean } {
  const [state, setState] = useState<{ bp: Breakpoint; ready: boolean }>({ bp: 'desktop', ready: false });

  useEffect(() => {
    const tablet = window.matchMedia('(min-width: 640px)');
    const desktop = window.matchMedia('(min-width: 1024px)');
    const update = () => setState({ bp: desktop.matches ? 'desktop' : tablet.matches ? 'tablet' : 'mobile', ready: true });
    update();
    tablet.addEventListener('change', update);
    desktop.addEventListener('change', update);
    return () => {
      tablet.removeEventListener('change', update);
      desktop.removeEventListener('change', update);
    };
  }, []);

  return state;
}
