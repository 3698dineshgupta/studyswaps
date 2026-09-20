# Hero artwork

Drop real artwork here and point to it from the config — no other code changes needed.

- **Products:** in `src/components/hero/products.ts` set `image: '/hero/macbook.png'` on any product.
  Transparent PNG/WebP, roughly square (about 400×400 px), object centred with a little padding.
- **Student:** in `src/components/hero/Hero.tsx` pass `<HeroScene studentImage="/hero/student.png" />`.
  Transparent PNG/WebP, portrait ~400×450 px.

Anything without an `image` keeps its built-in vector illustration.
