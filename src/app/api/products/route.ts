import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TelegramService } from '@/lib/telegram/service';
import { ensureBucket, uploadFile, validateImageFiles } from '@/lib/storage';
import { isCloudinaryConfigured, isOwnCloudinaryProductUrl, uploadImageToCloudinary } from '@/lib/cloudinary';
import { PHOTO_MAX, PHOTO_MIN } from '@/lib/photos';
import { verifyPlace } from '@/lib/geo';
import { cityFromText, cityOfPoint, cityOrFilter, isCitySlug, withCityName } from '@/lib/cities';
import { resolveCityForUser } from '@/lib/city';
import { z } from 'zod';
import { rateLimit, LIMITS } from '@/lib/security/rateLimit';
import { verifyImage } from '@/lib/security/imageCheck';
import { logSecurity } from '@/lib/security/log';
import { notify } from '@/lib/notify';
import { listProducts } from '@/lib/productList';

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), schema.optional());

const listingSchema = z.object({
  category: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR']),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year_purchased: optionalNumber(z.number().int().min(1990).max(new Date().getFullYear())),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  // Photos already uploaded through /api/products/photos, in display order (first = cover)
  photo_refs: z.array(z.string().max(500)).max(PHOTO_MAX).optional(),
  price: z.coerce.number().positive().max(9999999),
  original_price: optionalNumber(z.number().positive().max(9999999)),
  negotiable: z.boolean().default(false),
  location: z.string().max(200).optional(),
  preferred_meeting_point: z.string().max(200).optional(),
  // Where the item is collected from (an address from our search, signed by the server)
  pickup: z.object({
    place: z.object({ label: z.string().max(300), lat: z.number(), lon: z.number(), sig: z.string(), city: z.string().optional() }),
    address_line: z.string().trim().min(5).max(200),
    landmark: z.string().trim().min(3).max(150),
  }).optional(),
});

// GET /api/products — public search/browse
// Serverless hosts (Vercel) stop a function after 10 s by default; uploads and payment checks may need longer
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const sp = new URL(request.url).searchParams;
    const n = (v: string | null) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);

    // Launch cities: a Butwal shopper sees Butwal listings, a Kathmandu shopper sees Kathmandu ones
    const cityParam = sp.get('city');
    const city = cityParam === 'all' ? null : isCitySlug(cityParam) ? cityParam : await resolveCityForUser(supabase);

    const result = await listProducts(supabase, {
      q: sp.get('q') || sp.get('search') || '',
      category: sp.get('category') || '',
      condition: sp.get('condition') || '',
      minPrice: n(sp.get('minPrice') ?? sp.get('min_price')),
      maxPrice: n(sp.get('maxPrice') ?? sp.get('max_price')),
      negotiable: sp.get('negotiable') === 'true',
      sort: sp.get('sort') || 'newest',
      page: n(sp.get('page')),
      pageSize: n(sp.get('pageSize') ?? sp.get('limit')) ?? 20,
      city,
    });

    // The listing is PUBLIC data (only ACTIVE items, identical for everyone), so when the city is explicit it can be
    // cached briefly by the browser and any CDN. When the city came from the visitor's cookie it varies per person: don't.
    const cacheable = cityParam === 'all' || isCitySlug(cityParam);
    return NextResponse.json(result, { headers: { 'Cache-Control': cacheable ? 'public, max-age=15, s-maxage=30, stale-while-revalidate=120' : 'private, no-store' } });
  } catch (error) {
    console.error('[API] Products GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
// POST /api/products — create listing (verified students only)
// multipart: data (JSON), photos[]
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, verification_status, account_status, location, college_name, is_seller')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (profile.verification_status !== 'VERIFIED') {
      return NextResponse.json({ error: 'Only verified students can create listings' }, { status: 403 });
    }
    if (profile.account_status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Your account is not active' }, { status: 403 });
    }

    const limited = await rateLimit(request, LIMITS.listing, user.id);
    if (limited) return limited;

    const formData = await request.formData();

    let raw: unknown;
    try {
      raw = JSON.parse(String(formData.get('data') ?? '{}'));
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }
    const parsed = listingSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please check the listing details', details: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    const photos = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
    // Photos arrive either pre-uploaded (refs, the normal path) or as files. Either way: 3 to 6, enforced here too.
    const refs = data.photo_refs ?? [];
    const trusted = (r: string) => (r.startsWith('https://') ? isOwnCloudinaryProductUrl(r) : r.startsWith(`${profile.id}/`) && !r.includes('..'));
    if (refs.some((r) => !trusted(r))) return NextResponse.json({ error: 'One of the photos is not valid. Please upload it again.' }, { status: 400 });
    if (new Set(refs).size !== refs.length) return NextResponse.json({ error: 'The same photo was added twice' }, { status: 400 });
    const photoCount = refs.length + photos.length;
    if (photoCount < PHOTO_MIN) return NextResponse.json({ error: `Please upload at least ${PHOTO_MIN} photos` }, { status: 400 });
    if (photoCount > PHOTO_MAX) return NextResponse.json({ error: `You can upload up to ${PHOTO_MAX} photos` }, { status: 400 });
    let photoError = photos.length ? validateImageFiles(photos, { min: 0, max: PHOTO_MAX, label: 'photos' }) : null;
    // Trust the bytes, not the Content-Type header
    for (const p of photos) { if (photoError) break; const v = await verifyImage(p); if (!v.ok) photoError = v.error; }
    if (photoError) { logSecurity('upload_rejected', request, { userId: user.id, reason: photoError }); return NextResponse.json({ error: photoError }, { status: 400 }); }

    const admin = createAdminClient();

    const { data: category } = await admin
      .from('categories')
      .select('id, name')
      .eq('slug', data.category)
      .maybeSingle();
    if (!category) {
      return NextResponse.json({ error: 'Choose a valid category' }, { status: 400 });
    }

    const pickup = data.pickup && verifyPlace(data.pickup.place) ? data.pickup : null;
    // Listings must be inside a launch city; the location text always carries that city's name (used for city filtering)
    const listingCity = pickup ? cityOfPoint(pickup.place.lat, pickup.place.lon) : cityFromText(data.location);
    if (!listingCity) return NextResponse.json({ error: 'We currently serve Kathmandu and Butwal. Please choose a location inside one of them.' }, { status: 400 });
    const listingLocation = withCityName(pickup?.place.label ?? data.location ?? '', listingCity);
    const { data: product, error: productError } = await admin.from('products').insert({
        seller_id: profile.id,
        category_id: category.id,
        title: data.title,
        description: data.description,
        brand: data.brand || null,
        model: data.model || null,
        condition: data.condition,
        price: data.price,
        original_price: data.original_price ?? null,
        is_negotiable: data.negotiable,
        location: listingLocation,
        preferred_meeting_point: data.preferred_meeting_point || null,
        year_purchased: data.year_purchased ?? null,
        quantity: data.quantity,
        status: 'PENDING_REVIEW',
      }).select('id, listing_number').single();

    if (productError || !product) throw productError;

    if (pickup) {
      const { error: pickupError } = await admin.from('product_pickups').insert({
        product_id: product.id,
        latitude: pickup.place.lat,
        longitude: pickup.place.lon,
        address: pickup.address_line + ', ' + pickup.place.label,
        landmark: pickup.landmark,
      });
      if (pickupError) console.error('[products] pickup location not saved (run migration 006):', pickupError.message);
    }

    // Photos: Cloudinary resizes/compresses on upload and serves from a CDN.
    // Without Cloudinary credentials, fall back to a public Supabase bucket.
    const useCloudinary = isCloudinaryConfigured();
    if (!useCloudinary) await ensureBucket(admin, 'product-images', true);
    const imageRows: { product_id: string; storage_path: string; is_primary: boolean; sort_order: number }[] = [];
    const paths = [...refs];
    for (const file of photos) {
      paths.push(useCloudinary
        ? (await uploadImageToCloudinary(file, 'studentmarket/products')).url
        : await uploadFile(admin, 'product-images', profile.id, file));
    }
    paths.forEach((storage_path, i) => imageRows.push({ product_id: product.id, storage_path, is_primary: i === 0, sort_order: i }));
    const { error: imageError } = await admin.from('product_images').insert(imageRows);
    if (imageError) throw imageError;

    // First listing makes the user a seller (DB trigger creates their wallet)
    if (!profile.is_seller) {
      await admin.from('profiles').update({ is_seller: true }).eq('id', profile.id);
    }

    await admin.from('audit_logs').insert({
      actor_id: profile.id,
      actor_email: user.email,
      action: 'LISTING_CREATED',
      entity_type: 'product',
      entity_id: product.id,
      new_data: { title: data.title, price: data.price },
    });

    // Tell the seller we have it (email + in-app); they'll hear again when a moderator decides
    await notify(profile.id, { type: 'LISTING_STATUS', title: 'We received your listing', body: `"${data.title}" is waiting for approval. A moderator will review it soon — you'll get an email as soon as it goes live.`, actionUrl: '/dashboard/listings', email: { subject: 'We received your listing on StudentMarket', cta: 'View my listings' } });

    // Alert moderators on Telegram; on failure queue a retry instead of failing the request
    try {
      const result = await TelegramService.archiveListing({
        listingId: product.id,
        listingNumber: product.listing_number,
        sellerId: profile.id,
        sellerName: profile.full_name,
        college: profile.college_name || '—',
        title: data.title,
        category: category.name,
        condition: data.condition,
        price: data.price,
        location: data.location || profile.location || 'Nepal',
        isNegotiable: data.negotiable,
        description: data.description,
      });
      if (!result.ok) throw new Error(result.error);
    } catch (telegramError) {
      console.error('[Telegram] Listing archive failed:', telegramError);
      await admin.from('telegram_sync_jobs').insert({
        entity_type: 'product',
        entity_id: product.id,
        operation: 'ARCHIVE_LISTING',
        status: 'FAILED',
        last_error: String(telegramError),
        next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    }

    return NextResponse.json(
      { success: true, id: product.id, listing_number: product.listing_number, status: 'PENDING_REVIEW' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Product POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
