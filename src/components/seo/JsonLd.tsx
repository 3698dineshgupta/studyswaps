import { serializeJsonLd } from '@/lib/jsonld'

/** Server-rendered schema.org data block. A non-executable data script, so the nonce-based CSP does not touch it. */
export default function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
}
