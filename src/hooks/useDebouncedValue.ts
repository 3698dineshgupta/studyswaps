'use client';

import { useEffect, useState } from 'react';

/** The value, but only after it has stopped changing for `ms` (typing "laptop" = one search, not six). */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
