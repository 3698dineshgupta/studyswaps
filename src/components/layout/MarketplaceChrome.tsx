'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/layout/Header'

/**
 * The marketplace header. On a phone, the product page replaces it with a full-bleed photo that carries its own
 * back / save / share / cart buttons, so the header is hidden there (`contents` keeps the header sticky on larger screens).
 */
export default function MarketplaceChrome() {
  const onProduct = usePathname()?.startsWith('/product/')
  return (
    <div className={onProduct ? 'hidden lg:contents' : 'contents'}>
      <Header />
    </div>
  )
}
