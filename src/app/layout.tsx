import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/layout/Providers'
import { APP_NAME, APP_TAGLINE } from '@/lib/constants'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types'
import { getFastUser } from '@/lib/auth/session'
import { cached } from '@/lib/cache'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import { createAdminClient } from '@/lib/supabase/admin'
import { CityProvider } from '@/components/city/CityProvider'
import NavigationProgress from '@/components/layout/NavigationProgress'
import WebVitals from '@/components/layout/WebVitals'
import { Suspense } from 'react'
import { cityFromCookie } from '@/lib/city'
import { cityFromText } from '@/lib/cities'

// Fonts are self-hosted at build time (no render-blocking request to Google) and only the weights we use are shipped
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-inter' })
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['500', '600', '700', '800'], display: 'swap', variable: '--font-jakarta' })

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  keywords: ['student marketplace', 'second hand', 'buy sell', 'student', 'Nepal'],
  authors: [{ name: APP_NAME }],
  openGraph: {
    title: APP_NAME,
    description: APP_TAGLINE,
    siteName: APP_NAME,
    type: 'website',
    locale: 'en_NP',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Who is signed in? Resolved on the server so the very first paint is already correct.
  // Verifying the session token locally (no network) + ONE database round trip for profile and admin role together,
  // instead of the previous three sequential ones. Cached for a few seconds: a page reload doesn't repeat the query.
  let profile: Profile | null = null
  let isAdmin = false
  try {
    const user = await getFastUser(createClient())
    if (user) {
      const row = await cached(`shell:${user.id}`, 15_000, async () => {
        const { data, error } = await createAdminClient().from('profiles').select('*, admin_roles!admin_roles_profile_id_fkey(role, is_active)').eq('auth_user_id', user.id).maybeSingle()
        if (error) console.error('[layout] profile lookup failed:', error.message) // never fail silently: a swallowed error looks like "logged out"
        return data
      })
      if (row) {
        const { admin_roles: roles, ...rest } = row as Profile & { admin_roles?: { role: string; is_active: boolean }[] }
        profile = rest as Profile
        // Only decides whether the "Admin panel" menu item is SHOWN. Every admin page and API re-checks the role itself.
        isAdmin = !!roles?.some((r) => r.is_active)
      }
    }
  } catch { /* signed out */ }

  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jakarta.variable}`}>
      <body className="min-h-screen bg-canvas antialiased">
        <Providers>
          <Suspense fallback={null}><NavigationProgress /></Suspense><WebVitals /><AuthProvider initialProfile={profile} initialIsAdmin={isAdmin}><CityProvider initialCity={cityFromCookie() ?? cityFromText(profile?.location)}>{children}</CityProvider></AuthProvider></Providers>
      </body>
    </html>
  )
}
