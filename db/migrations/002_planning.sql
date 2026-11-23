-- المرحلة 1: توسيع نموذج المناسبة من الدعوات إلى دورة حياة المناسبة الكاملة
-- ليلتنا | LAYLATNA — مخططات ترحيلية متراكمة فوق 001_init.sql

CREATE TABLE IF NOT EXISTS event_plans (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  budget_total REAL NOT NULL DEFAULT 0 CHECK (budget_total >= 0),
  hospitality_cost_per_person REAL NOT NULL DEFAULT 0 CHECK (hospitality_cost_per_person >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS planning_templates (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  tasks_json TEXT NOT NULL,
  categories_json TEXT NOT NULL,
  checklist_json TEXT NOT NULL,
  timeline_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS budget_categories (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  planned_amount REAL NOT NULL DEFAULT 0 CHECK (planned_amount >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (event_id, name)
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  category_id TEXT REFERENCES budget_categories(id) ON DELETE SET NULL,
  vendor_id TEXT,
  title TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount >= 0),
  expense_date TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','paid','cancelled')),
  notes TEXT,
  attachment_id TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_event ON expenses(event_id, status, created_at);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  expense_id TEXT REFERENCES expenses(id) ON DELETE CASCADE,
  vendor_id TEXT,
  amount REAL NOT NULL CHECK (amount >= 0),
  kind TEXT NOT NULL DEFAULT 'installment' CHECK (kind IN ('deposit','installment','full','refund')),
  due_date TEXT,
  paid_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','refunded')),
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_event ON payments(event_id, status, due_date);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  due_date TEXT,
  assignee_id TEXT REFERENCES users(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_event ON tasks(event_id, status, due_date);

CREATE TABLE IF NOT EXISTS checklists (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'custom',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'potential' CHECK (status IN ('potential','contacted','contracted','done')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_vendors_event ON vendors(event_id, category);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  uploader_id TEXT NOT NULL REFERENCES users(id),
  vendor_id TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('contract','quote','invoice','photo','other')),
  title TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_attachments_event ON attachments(event_id, kind);

CREATE TABLE IF NOT EXISTS timeline_items (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  phase TEXT NOT NULL CHECK (phase IN ('preparation','event_day','after')),
  title TEXT NOT NULL,
  description TEXT,
  starts_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  owner_id TEXT REFERENCES users(id),
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_timeline_event ON timeline_items(event_id, phase, sort_order);

-- أدوار التخطيط الجديدة (مستقلة عن event_members القديمة، والشخص يحصل على أكثر من دور)
CREATE TABLE IF NOT EXISTS planning_team (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('planner','finance','services')),
  permissions TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (event_id, user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_team_user ON planning_team(user_id, event_id);
