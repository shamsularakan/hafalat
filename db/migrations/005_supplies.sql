-- التحديث 05: المستلزمات وحساب الكميات، تقسيم الضيوف رجال/نساء، وظهور خطوات اليوم للضيوف
-- ليلتنا | LAYLATNA — متوافق مع SQLite و Postgres

-- عدد الضيوف المخطط (رجال/نساء) وإعدادات الحساب
ALTER TABLE event_plans ADD COLUMN men_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE event_plans ADD COLUMN women_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE event_plans ADD COLUMN seats_per_table INTEGER NOT NULL DEFAULT 8;
ALTER TABLE event_plans ADD COLUMN reserve_percent REAL NOT NULL DEFAULT 10;
ALTER TABLE event_plans ADD COLUMN vat_rate REAL NOT NULL DEFAULT 15;
ALTER TABLE event_plans ADD COLUMN vat_enabled INTEGER NOT NULL DEFAULT 0;
-- manual = العدد المدخل يدويًا · rsvp = عدد المؤكدين من ردود الضيوف (يتحدث تلقائيًا)
ALTER TABLE event_plans ADD COLUMN headcount_source TEXT NOT NULL DEFAULT 'manual';

-- قسم الضيف: رجال / نساء (اختياري)
ALTER TABLE guests ADD COLUMN section TEXT;

-- خطوات يوم المناسبة: هل تظهر في برنامج الدعوة؟ (الموجود سابقًا يبقى ظاهرًا)
ALTER TABLE timeline_items ADD COLUMN show_to_guests INTEGER NOT NULL DEFAULT 1;
ALTER TABLE timeline_items ADD COLUMN owner_label TEXT;

-- قائمتي: بنود المستلزمات المختارة لكل مناسبة
CREATE TABLE IF NOT EXISTS event_supplies (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  item_key TEXT NOT NULL,
  category_key TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('g','w','m','t','gd','f')),
  rule_value REAL NOT NULL CHECK (rule_value >= 0),
  unit_price REAL NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  qty_override REAL CHECK (qty_override IS NULL OR qty_override >= 0),
  status TEXT NOT NULL DEFAULT 'req' CHECK (status IN ('req','sel','ok')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (event_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_supplies_event ON event_supplies(event_id, category_key);
