-- DAWAT | دعوات — المخطط الأولي (متوافق SQLite؛ قابل للترحيل إلى PostgreSQL)
-- كل جدول تابع للعميل يحمل organization_id مباشرة أو عبر علاقة محققة (سياج صلاحيات)

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  price_monthly_sar INTEGER NOT NULL DEFAULT 0,
  max_active_events INTEGER NOT NULL,
  max_guests_per_event INTEGER NOT NULL,
  max_delegates_per_event INTEGER NOT NULL,
  storage_mb INTEGER NOT NULL,
  advanced_templates INTEGER NOT NULL DEFAULT 0,
  custom_branding INTEGER NOT NULL DEFAULT 0,
  multi_seat INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','pending')),
  is_platform_admin INTEGER NOT NULL DEFAULT 0,
  email_verified INTEGER NOT NULL DEFAULT 0,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  locale TEXT NOT NULL DEFAULT 'ar',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,               -- sha256 للرمز الخام (لا يخزن الرمز الخام)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'individual' CHECK (kind IN ('individual','company')),
  logo_asset_id TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  owner_id TEXT NOT NULL REFERENCES users(id),
  retention_days INTEGER NOT NULL DEFAULT 365,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('trial','active','past_due','cancelled')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  renewal_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  amount_sar INTEGER NOT NULL,
  tax_sar INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','void','failed')),
  provider_ref TEXT,
  issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  type TEXT NOT NULL,                 -- wedding, engagement, graduation, newborn, birthday, family, corporate, conference, official, other
  host_name TEXT,                     -- صاحب المناسبة (اسم العرض)
  description TEXT,
  starts_at TEXT,                     -- UTC ISO
  ends_at TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  venue_name TEXT,
  venue_address TEXT,
  map_url TEXT,
  is_virtual INTEGER NOT NULL DEFAULT 0,
  virtual_url TEXT,
  capacity INTEGER NOT NULL DEFAULT 100,
  quota_unit TEXT NOT NULL DEFAULT 'card' CHECK (quota_unit IN ('card','person')),
  unit_locked INTEGER NOT NULL DEFAULT 0,   -- يقفل بعد أول إصدار دعوة
  cancel_returns_quota INTEGER NOT NULL DEFAULT 1,
  rsvp_deadline TEXT,
  allow_reentry INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','published','ongoing','ended','archived','cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_events_org ON events(organization_id, status, created_at);

CREATE TABLE IF NOT EXISTS event_members (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','manager','supervisor','delegate','receptionist','designer')),
  permissions TEXT NOT NULL DEFAULT '{}',   -- JSON: بوابات مسموحة، إلخ
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (event_id, user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_event_members_user ON event_members(user_id, event_id);

CREATE TABLE IF NOT EXISTS gates (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS delegations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  parent_id TEXT REFERENCES delegations(id),   -- مفوّض فرعي (مرحلة متقدمة)
  user_id TEXT REFERENCES users(id),           -- قد يكون فارغًا حتى قبول الدعوة
  invitee_name TEXT NOT NULL,
  invitee_phone TEXT,
  invitee_email TEXT,
  role TEXT NOT NULL DEFAULT 'delegate' CHECK (role IN ('delegate','supervisor')),
  quota_allocated INTEGER NOT NULL DEFAULT 0 CHECK (quota_allocated >= 0),
  quota_used INTEGER NOT NULL DEFAULT 0 CHECK (quota_used >= 0 AND quota_used <= quota_allocated),
  permissions TEXT NOT NULL DEFAULT '{}',      -- JSON flags
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','suspended','revoked','expired')),
  expires_at TEXT,
  suspended_policy TEXT NOT NULL DEFAULT 'keep' CHECK (suspended_policy IN ('keep','transfer')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by TEXT NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_delegations_event ON delegations(event_id, status);

CREATE TABLE IF NOT EXISTS quota_ledger (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  delegation_id TEXT REFERENCES delegations(id) ON DELETE CASCADE,
  invitation_id TEXT,
  delta INTEGER NOT NULL,               -- موجب: إضافة/إرجاع رصيد، سالب: استهلاك
  balance_after INTEGER,                -- رصيد المفوّض بعد العملية (إن وجد)
  reason TEXT NOT NULL,                 -- allocation, issue, cancel_return, cancel_burn, reallocate_out, reallocate_in, adjust
  note TEXT,
  actor_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ledger_delegation ON quota_ledger(delegation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_event ON quota_ledger(event_id, created_at);

CREATE TABLE IF NOT EXISTS guest_groups (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,                   -- VIP, أفراد, عائلات, شركات, مخصص
  kind TEXT NOT NULL DEFAULT 'custom' CHECK (kind IN ('vip','individuals','families','corporate','custom')),
  companion_max INTEGER NOT NULL DEFAULT 0 CHECK (companion_max >= 0),
  is_vip INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (event_id, name)
);

CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  inviter_id TEXT REFERENCES delegations(id),   -- الداعي الحالي (مفوّض) أو NULL للمالك
  original_inviter_id TEXT REFERENCES delegations(id), -- الداعي الأصلي قبل أي نقل ملكية
  group_id TEXT REFERENCES guest_groups(id),
  name TEXT NOT NULL,
  phone TEXT,                           -- للإرسال اليدوي؛ الإنتاج: تشفير أثناء التخزين
  phone_hash TEXT,                      -- sha256 للرقم المعياري (تطهير التكرارات)
  email TEXT,
  locale TEXT NOT NULL DEFAULT 'ar',
  notes TEXT,
  conflict INTEGER NOT NULL DEFAULT 0,  -- تعارض أسماء/أرقام مكتشف
  import_batch_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_phone_unique ON guests(event_id, phone_hash) WHERE phone_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guests_event ON guests(event_id, inviter_id, created_at);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  delegation_id TEXT REFERENCES delegations(id),
  token_hash TEXT NOT NULL UNIQUE,      -- sha256 للرمز الخام؛ لا يخزن الرمز أبدًا
  token_nonce TEXT NOT NULL DEFAULT '', -- عشوائية إعادة الإصدار (HMAC قابل لإعادة الاشتقاق للمشاركة)
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','delivered','seen','confirmed','declined','checked_in','no_show','cancelled','expired')),
  persons_reserved INTEGER NOT NULL DEFAULT 1 CHECK (persons_reserved >= 1),
  companions_allowed INTEGER NOT NULL DEFAULT 0 CHECK (companions_allowed >= 0),
  issued_at TEXT,
  expires_at TEXT,
  seen_at TEXT,
  cancelled_at TEXT,
  cancel_reason TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (event_id, guest_id),
  UNIQUE (delegation_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_invitations_event ON invitations(event_id, status, created_at);

CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  answer TEXT NOT NULL CHECK (answer IN ('confirmed','declined')),
  persons_confirmed INTEGER NOT NULL DEFAULT 1 CHECK (persons_confirmed >= 0),
  message TEXT,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_rsvps_invitation ON rsvps(invitation_id, occurred_at);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  gate_id TEXT REFERENCES gates(id),
  staff_id TEXT NOT NULL REFERENCES users(id),
  persons INTEGER NOT NULL DEFAULT 1 CHECK (persons >= 1),
  mode TEXT NOT NULL DEFAULT 'scan' CHECK (mode IN ('scan','manual')),
  manual_reason TEXT,
  is_reentry INTEGER NOT NULL DEFAULT 0,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_checkins_event ON checkins(event_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_checkins_invitation ON checkins(invitation_id);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL = قالب عام للمنصة
  name_ar TEXT NOT NULL,
  style TEXT NOT NULL,                  -- royal, modern, heritage, romantic, formal, corporate
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','organization','event')),
  version INTEGER NOT NULL DEFAULT 1,
  schema_json TEXT NOT NULL,            -- مشاهد/عناصر/ألوان/حركات
  locked_identity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id),
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('audio','image','logo')),
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  original_name TEXT,
  storage_key TEXT NOT NULL,            -- مسار/مفتاح التخزين الكائني
  rights_attested INTEGER NOT NULL DEFAULT 0,
  rights_note TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','quarantined','deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_media_org ON media_assets(organization_id, status);

CREATE TABLE IF NOT EXISTS invitation_designs (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  template_id TEXT REFERENCES templates(id),
  scenes_json TEXT NOT NULL,            -- نسخة التصميم (مسودة/منشورة)
  version INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','published')),
  audio_asset_id TEXT REFERENCES media_assets(id),
  published_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (event_id, state)
);

CREATE TABLE IF NOT EXISTS delivery_jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp_manual','link_copy','email','whatsapp_api')),
  state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','sent','delivered','failed','manual_sent')),
  provider_ref TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_delivery_invitation ON delivery_jobs(invitation_id, created_at);

CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp_manual',
  body TEXT NOT NULL,                   -- معاملات {اسم_الضيف} و{رابط_الدعوة} و{اسم_المناسبة}
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  event_id TEXT,
  actor_id TEXT,
  action TEXT NOT NULL,
  object_type TEXT,
  object_id TEXT,
  detail_json TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_logs(event_id, created_at);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  scope TEXT NOT NULL,                  -- issue_invitation, scan, delivery, payment
  key TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (scope, key)
);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  filename TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  inserted INTEGER NOT NULL DEFAULT 0,
  skipped_duplicates INTEGER NOT NULL DEFAULT 0,
  errors_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
