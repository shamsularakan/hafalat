-- التحديث 09: قالب الدعوة الكامل (صفحة واحدة) — لقب الضيف والتهاني
-- ليلتنا | LAYLATNA — متوافق مع SQLite و Postgres

-- لقب المدعو كما يظهر في الدعوة: «سعادة الأستاذ»، «الشيخ»، «الدكتورة»…
ALTER TABLE guests ADD COLUMN title TEXT;

-- «اترك بصمتك الجميلة»: تهنئة واحدة لكل دعوة (قابلة للتعديل)، تُفتح يوم المناسبة للحاضرين وغير الحاضرين
CREATE TABLE IF NOT EXISTS guest_wishes (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  invitation_id TEXT NOT NULL UNIQUE REFERENCES invitations(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_guest_wishes_event ON guest_wishes(event_id, created_at);
