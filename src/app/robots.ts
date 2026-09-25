import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/constants'

// Sign-in-only areas just redirect to /login, so crawlers gain nothing from them.
// /login, /register and /forgot-password are deliberately NOT blocked here: they carry a noindex tag that Google must be able to read.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/checkout', '/cart', '/orders', '/dashboard', '/profile', '/sell', '/verify', '/chat', '/notifications', '/wishlist'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
