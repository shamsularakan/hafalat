-- التحديث 10: الفزعة (من يساعد في المناسبة) وبطاقات الشكر، وإثبات ملكية رقم الجوال
-- ليلتنا | LAYLATNA — متوافق مع SQLite و Postgres

CREATE TABLE IF NOT EXISTS event_helpers (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  -- المهمة: الاستقبال، القهوة، المواقف…
  task TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','accepted','declined')),
  -- رابط الفزعة المختصر /f/<رمز> — شخصي لكل فزعة
  link_code TEXT NOT NULL UNIQUE,
  -- يُربط بحساب صاحب الرقم بعد إثبات ملكيته
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  request_sent_at TEXT,
  responded_at TEXT,
  -- بطاقة الشكر: تُصدر تلقائيًا عند انتهاء المناسبة
  thanked_at TEXT,
  thanks_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (event_id, phone_hash)
);
CREATE INDEX IF NOT EXISTS idx_helpers_phone ON event_helpers(phone_hash);
CREATE INDEX IF NOT EXISTS idx_helpers_event ON event_helpers(event_id, status);

-- نص بطاقة الشكر لكل مناسبة (قابل للتعديل)
ALTER TABLE event_plans ADD COLUMN thanks_message TEXT;

-- وقت إثبات ملكية الرقم (بفتح رابط وصل على واتساب وهو مسجّل الدخول)
ALTER TABLE users ADD COLUMN phone_verified_at TEXT;
