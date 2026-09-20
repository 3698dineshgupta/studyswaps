import { NextRequest } from 'next/server';
import { LAUNCH_CITIES } from '@/lib/cities';

// GET /api/tiles/z/x/y — map tiles, fetched from OpenStreetMap on the server (with a proper User-Agent) and cached.
// Same-origin, so the browser's content-security rules and OSM's referrer rules never get in the way.
// Only tiles that cover our launch cities are served, so this can't be used as a free general-purpose tile proxy.

const tileX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
const tileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

function inLaunchArea(z: number, x: number, y: number) {
  return LAUNCH_CITIES.some((c) => {
    const [w, s, e, n] = c.viewbox;
    const pad = 1; // one tile of margin so panning near the edge still looks continuous
    return x >= tileX(w, z) - pad && x <= tileX(e, z) + pad && y >= tileY(n, z) - pad && y <= tileY(s, z) + pad;
  });
}

export async function GET(_req: NextRequest, { params }: { params: { z: string; x: string; y: string } }) {
  const z = Number(params.z), x = Number(params.x), y = Number(params.y);
  const ok = Number.isInteger(z) && Number.isInteger(x) && Number.isInteger(y) && z >= 10 && z <= 19 && x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z;
  if (!ok || !inLaunchArea(z, x, y)) return new Response('Tile not available here', { status: 404 });

  try {
    const res = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, {
      headers: { 'User-Agent': 'StudentMarket/1.0 (student marketplace, Nepal)' },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return new Response('Tile unavailable', { status: 502 });
    return new Response(await res.arrayBuffer(), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400, s-maxage=604800', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return new Response('Tile unavailable', { status: 502 });
  }
}
