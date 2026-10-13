CREATE TYPE offer_status AS ENUM ('PENDING', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN', 'FULFILLED');

CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  message TEXT,
  counter_amount NUMERIC(10,2),
  counter_message TEXT,
  status offer_status NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX idx_offers_buyer ON offers(buyer_id, status);
CREATE INDEX idx_offers_seller ON offers(seller_id, status);
CREATE INDEX idx_offers_product ON offers(product_id);

CREATE UNIQUE INDEX idx_offers_one_live_per_buyer_product ON offers(product_id, buyer_id) WHERE status IN ('PENDING', 'COUNTERED');

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY offers_buyer_read ON offers FOR SELECT TO authenticated USING (buyer_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));
CREATE POLICY offers_seller_read ON offers FOR SELECT TO authenticated USING (seller_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid()));

REVOKE ALL ON offers FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON offers FROM authenticated;
GRANT SELECT ON offers TO authenticated;

CREATE TRIGGER set_updated_at_offers BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE cart_items ADD COLUMN offer_id UUID REFERENCES offers(id) ON DELETE SET NULL;

ALTER TABLE profiles ADD COLUMN telegram_chat_id BIGINT;
ALTER TABLE profiles ADD COLUMN telegram_username TEXT;
ALTER TABLE profiles ADD COLUMN telegram_link_code TEXT;
ALTER TABLE profiles ADD COLUMN telegram_link_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX idx_profiles_telegram_chat_id ON profiles(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
CREATE UNIQUE INDEX idx_profiles_telegram_link_code ON profiles(telegram_link_code) WHERE telegram_link_code IS NOT NULL;
