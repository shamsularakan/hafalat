-- التحديث 06: كتالوج منتجات الموردين، تقييم الموردين، ربط الجدول وقائمتي بالموردين، وضريبة المصروفات
-- ليلتنا | LAYLATNA — متوافق مع SQLite و Postgres

-- تقييم المورد بعد المناسبة (1-5) وملاحظة التقييم
ALTER TABLE vendors ADD COLUMN rating INTEGER;
ALTER TABLE vendors ADD COLUMN review TEXT;

-- الضريبة جزء من التكلفة: المبلغ يشملها، وهذا العمود يبيّن مقدارها
ALTER TABLE expenses ADD COLUMN vat_amount REAL NOT NULL DEFAULT 0;

-- خطوة جدول اليوم ← المورد المسؤول (رقم التواصل يظهر في الجدول المرسل للموردين)
ALTER TABLE timeline_items ADD COLUMN vendor_id TEXT;
-- بند قائمتي ← المورد المختار
ALTER TABLE event_supplies ADD COLUMN vendor_id TEXT;

-- كتالوج كل مورد: منتجات (بند منفرد) وباقات (مجموعة بسعر واحد) بأربعة أنواع تسعير.
-- صاحب المناسبة يتصفحها ويختار منها، فيُحسب الإجمالي تلقائيًا، واعتماد اختيار المورد يُسجَّل مصروفًا.
CREATE TABLE IF NOT EXISTS vendor_products (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'product' CHECK (kind IN ('product','package')),
  name TEXT NOT NULL,
  description TEXT,
  pricing_type TEXT NOT NULL DEFAULT 'fixed' CHECK (pricing_type IN ('fixed','per_person','per_qty','per_time')),
  unit_price REAL NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  unit TEXT,
  vat_included INTEGER NOT NULL DEFAULT 0,
  includes TEXT NOT NULL DEFAULT '[]',
  selected INTEGER NOT NULL DEFAULT 0,
  quantity REAL CHECK (quantity IS NULL OR quantity >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_vendor_products ON vendor_products(event_id, vendor_id);

-- المصروف الناتج عن اعتماد اختيارات المورد (يُحدَّث عند تعديل الاختيار)
ALTER TABLE vendors ADD COLUMN selection_expense_id TEXT;
