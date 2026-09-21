# StudySwaps 🛍️

> **Buy • Sell • Save Money • Support Fellow Students**

A verified-student-only second-hand marketplace built for Nepal. Students can list used textbooks, electronics, uniforms, and accessories — buying and selling exclusively within their campus community.

---

## Features

- 🎓 **Verified Students Only** — ID-based verification before buying or selling
- 💳 **eSewa Payments** — Nepal's leading digital wallet, server-side HMAC verification
- 💼 **Seller Wallet** — Pending → Available escrow, withdrawal to eSewa/bank
- 📦 **Order Tracking** — Full state machine from placement to confirmed delivery
- 🤖 **Telegram Archival** — Admin channel archives all listings and verifications (server-side only)
- 💬 **In-App Chat** — Buyer/seller messaging per order
- 🛡️ **Dispute System** — Admin-mediated resolution with refund support
- 📱 **Mobile-First** — Bottom navigation, responsive cards, PWA-ready

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth + DB | Supabase (PostgreSQL + RLS) |
| Storage | Supabase Storage |
| Payments | eSewa Nepal |
| Notifications | Telegram Bot API |
| Cache | Redis (optional) |
| Deployment | Docker + docker-compose |

---

## Quick Start

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- An [eSewa Merchant Account](https://esewa.com.np) (use test credentials for development)
- A [Telegram Bot](https://core.telegram.org/bots) and admin channel

### 1. Clone & Install

```bash
git clone <repo-url>
cd studentmarket
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local`. See [Environment Variables](#environment-variables) below.

### 3. Database Setup

Install the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
```

Run migrations in order:

```bash
supabase db push
```

Or apply manually via the Supabase SQL editor:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_functions_triggers.sql
```

### 4. Storage Buckets

Create these buckets in your Supabase dashboard (Storage → New Bucket):

| Bucket Name | Public |
|------------|--------|
| `product-images` | ✅ Yes |
| `verification-documents` | ❌ No (RLS protected) |
| `avatars` | ✅ Yes |

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. First Admin User

After registering, manually set your role in Supabase:

```sql
UPDATE profiles SET role = 'SUPER_ADMIN' WHERE auth_user_id = 'your-auth-uuid';
```

Then access the admin panel at `/admin`.

---

## Environment Variables

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
INTERNAL_SECRET=your-long-random-secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# eSewa (use test credentials for development)
NEXT_PUBLIC_ESEWA_PRODUCT_CODE=EPAYTEST
ESEWA_SECRET_KEY=8gBm/:&EnhH.1/q     # test key
ESEWA_MERCHANT_ID=your-merchant-id
NEXT_PUBLIC_ESEWA_GATEWAY_URL=https://rc-epay.esewa.com.np  # sandbox
# Production: https://epay.esewa.com.np

# Telegram
TELEGRAM_BOT_TOKEN=123456789:AABBcc...
TELEGRAM_ADMIN_CHAT_ID=-1001234567890
TELEGRAM_ARCHIVE_CHANNEL_ID=-1009876543210  # optional separate archive

# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379
```

### eSewa Test Credentials

| Field | Value |
|-------|-------|
| Gateway | `https://rc-epay.esewa.com.np/api/epay/main/v2/form` |
| Product Code | `EPAYTEST` |
| Secret Key | `8gBm/:&EnhH.1/q` |
| Test eSewa ID | `9806800001` |
| Password | `Nepal@123` |
| MPIN | `1122` |

---

## Project Structure

```
studentmarket/
├── src/
│   ├── app/
│   │   ├── (auth)/           # Login, Register, Forgot Password
│   │   ├── (marketplace)/    # Browse, Product, Cart, Checkout, Orders, Wishlist
│   │   ├── admin/            # Admin dashboard (role-protected)
│   │   ├── api/              # All API routes
│   │   │   ├── verification/
│   │   │   ├── products/
│   │   │   ├── cart/
│   │   │   ├── orders/
│   │   │   ├── payments/esewa/
│   │   │   ├── wallet/
│   │   │   ├── upload/
│   │   │   └── admin/
│   │   ├── dashboard/        # Seller dashboard
│   │   ├── verify/           # Student verification flow
│   │   ├── sell/             # Create listing
│   │   ├── profile/
│   │   └── chat/
│   ├── components/
│   │   ├── admin/
│   │   ├── layout/
│   │   ├── marketplace/
│   │   ├── orders/
│   │   ├── seller/
│   │   ├── shared/
│   │   ├── ui/
│   │   ├── verification/
│   │   └── wallet/
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCart.ts
│   │   └── useProducts.ts
│   ├── lib/
│   │   ├── esewa/
│   │   ├── supabase/
│   │   ├── telegram/
│   │   ├── wallet/
│   │   ├── constants.ts
│   │   └── utils.ts
│   ├── middleware.ts
│   └── types/
│       └── index.ts
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql
        ├── 002_rls_policies.sql
        └── 003_functions_triggers.sql
```

---

## User Flows

### 1. Student Verification

```
Register → Upload Student ID (front + back) → Admin reviews → Approved → Full access
```

Verification expires after 1 year; students must re-verify.

### 2. Buying

```
Browse → Add to Cart → Checkout → eSewa payment → Seller accepts → Delivery → Confirm receipt
```

Funds held in escrow until buyer confirms receipt.

### 3. Selling

```
Verify → Create Listing → Pending Review → Active → Buyer places order → Pack & deliver → Funds released
```

Platform takes a 3% fee on each sale.

### 4. Disputes

```
Buyer raises dispute → Admin notified → Review evidence → Resolve / Refund / Reject
```

---

## Payment Flow (eSewa)

```
1. POST /api/payments/esewa/initiate
   - Creates payment record with transaction UUID
   - Returns signed form parameters

2. Client submits form to eSewa gateway

3. eSewa redirects back to /api/payments/esewa/verify (GET)
   - Also sends POST callback

4. Server verifies HMAC signature
5. Server calls eSewa verification API to confirm
6. Order status → PAYMENT_CONFIRMED
7. Seller pending balance credited
```

---

## Deployment

### Docker

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f app
```

### docker-compose.yml includes

- `app` — Next.js application
- `redis` — Optional caching layer

### Environment in Production

Set all `.env.local` variables as environment variables in your hosting platform, or mount them as Docker secrets.

**Production eSewa URL:** `https://epay.esewa.com.np/api/epay/main/v2/form`

---

## Admin Panel

Access at `/admin` (requires `ADMIN` or `SUPER_ADMIN` role).

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/admin` | Stats overview |
| Users | `/admin/users` | Manage student accounts |
| Verification | `/admin/verification` | Review ID submissions |
| Listings | `/admin/listings` | Moderate product listings |
| Orders | `/admin/orders` | Monitor all orders |
| Disputes | `/admin/disputes` | Resolve disputes |

---

## Database Schema Overview

Key tables:

| Table | Description |
|-------|-------------|
| `profiles` | Extended user data, verification/account status |
| `student_profiles` | College, student ID, DOB |
| `verification_requests` | ID submissions for review |
| `verification_documents` | Uploaded document paths |
| `products` | Listings |
| `product_images` | Storage paths for listing photos |
| `categories` | Product categories |
| `carts` / `cart_items` | Shopping cart |
| `orders` / `order_items` | Placed orders |
| `deliveries` / `delivery_events` | Delivery tracking |
| `payments` | Payment records (eSewa + others) |
| `wallets` / `wallet_ledger` | Seller balance, transaction history |
| `withdrawals` | Withdrawal requests |
| `messages` | Order-scoped chat messages |
| `disputes` | Buyer/seller disputes |
| `audit_logs` | Full audit trail |
| `telegram_sync_jobs` | Retry queue for Telegram |

All tables have Row Level Security (RLS) enforced. See `002_rls_policies.sql`.

---

## Security Notes

- All payments verified server-side (HMAC + eSewa verification API)
- Documents in private Supabase Storage buckets (signed URLs only)
- Telegram bot token never exposed to client
- Internal API routes protected by `INTERNAL_SECRET` header
- Admin routes protected by role check in both middleware and API handlers
- Optimistic locking on wallet balance updates prevents race conditions

---

## Development Tips

### Seed Data

Run this in Supabase SQL editor to add categories:

```sql
INSERT INTO categories (name, slug, description, icon_emoji, display_order) VALUES
  ('Textbooks', 'textbooks', 'Course books and study materials', '📚', 1),
  ('Electronics', 'electronics', 'Laptops, phones, calculators', '💻', 2),
  ('Stationery', 'stationery', 'Pens, notebooks, art supplies', '✏️', 3),
  ('Uniforms', 'uniforms', 'College uniforms and lab coats', '👕', 4),
  ('Instruments', 'instruments', 'Musical and scientific instruments', '🎸', 5),
  ('Sports', 'sports', 'Sports equipment and gear', '⚽', 6),
  ('Furniture', 'furniture', 'Hostel furniture and room items', '🪑', 7),
  ('Other', 'other', 'Everything else', '📦', 8);
```

### Local Telegram Testing

Use `ngrok` to expose localhost for Telegram webhooks:

```bash
npx ngrok http 3000
# Update NEXT_PUBLIC_APP_URL to your ngrok URL
```

---

## License

MIT — free to use, modify, and distribute.

---

*Built with ❤️ for students, by students.*
