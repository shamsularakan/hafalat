-- التحديث 08: بوابة المورد ودليل الموردين
-- المورد حساب حقيقي (مساحة عمل) يدير ملفه ومنتجاته وتوفره حسب التاريخ، ويرى حجوزاته.
-- صاحب المناسبة يتصفح الدليل ويضيف المورد لمناسبته، فتظهر منتجاته محدّثة تلقائيًا.

CREATE TABLE IF NOT EXISTS vendor_profiles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT,
  phone TEXT,
  description TEXT,
  -- عدد المناسبات التي يخدمها المورد في اليوم الواحد (القاعة غالبًا 1)
  daily_capacity INTEGER NOT NULL DEFAULT 1 CHECK (daily_capacity >= 1),
  is_public INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_dir ON vendor_profiles(is_public, category, city);

CREATE TABLE IF NOT EXISTS catalog_products (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  kind TEXT NOT NULL DEFAULT 'product' CHECK (kind IN ('product','package')),
  name TEXT NOT NULL,
  description TEXT,
  pricing_type TEXT NOT NULL DEFAULT 'fixed' CHECK (pricing_type IN ('fixed','per_person','per_qty','per_time')),
  unit_price REAL NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  unit TEXT,
  vat_included INTEGER NOT NULL DEFAULT 0,
  includes TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_catalog_products ON catalog_products(profile_id, active);

-- أيام لا يستقبل فيها المورد حجوزات (إجازة، صيانة، حجز من خارج المنصة)
CREATE TABLE IF NOT EXISTS vendor_blocked_dates (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES vendor_profiles(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  note TEXT,
  UNIQUE (profile_id, day)
);

-- ربط مورد المناسبة بملفه في الدليل، ومنتجات المناسبة بمنتجات الكتالوج
ALTER TABLE vendors ADD COLUMN profile_id TEXT;
ALTER TABLE vendor_products ADD COLUMN catalog_product_id TEXT;
-- المنتج المختار سابقًا ثم أوقفه المورد يبقى ظاهرًا مع تنبيه
ALTER TABLE vendor_products ADD COLUMN unavailable INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_vendors_profile ON vendors(profile_id);
