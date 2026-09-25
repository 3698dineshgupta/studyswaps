import Header from '@/components/layout/Header'
import MobileNav from '@/components/layout/MobileNav'
import SiteFooter from '@/components/layout/SiteFooter'
import EmptyState from '@/components/ui/EmptyState'

export const metadata = { title: 'Page not found', robots: { index: false, follow: false } }

// Served with a real 404 status (e.g. an unknown /product/<id>) so search engines drop the URL
export default function NotFound() {
  return (
    <>
      <Header />
      <main className="min-h-[60vh] pb-24 lg:pb-0">
        <EmptyState illustration="productCard" title="Page not found" text="This page or listing may have been sold, removed, or the link is wrong." action={{ label: 'Browse listings', href: '/browse' }} />
      </main>
      <SiteFooter />
      <MobileNav />
    </>
  )
}
