-- التحديث 02: مكتبة القوالب والإصدارات غير القابلة للتغيير
ALTER TABLE templates ADD COLUMN category TEXT NOT NULL DEFAULT 'wedding';
ALTER TABLE templates ADD COLUMN is_premium INTEGER NOT NULL DEFAULT 0;
ALTER TABLE templates ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE templates ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS template_publications (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id),
  version INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'published' CHECK (state IN ('published','unpublished')),
  schema_json TEXT NOT NULL,
  published_by TEXT REFERENCES users(id),
  published_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (template_id, version)
);

CREATE TABLE IF NOT EXISTS design_versions (
  id TEXT PRIMARY KEY,
  design_id TEXT NOT NULL REFERENCES invitation_designs(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  version INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('draft','published')),
  scenes_json TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (design_id, version)
);

CREATE TABLE IF NOT EXISTS template_favorites (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, template_id)
);

UPDATE templates SET category = 'wedding' WHERE id IN ('tpl-royal') AND category = 'wedding';
UPDATE templates SET category = 'modern' WHERE id IN ('tpl-modern') AND category = 'wedding';
UPDATE templates SET category = 'heritage' WHERE id IN ('tpl-heritage') AND category = 'wedding';
UPDATE templates SET category = 'romantic' WHERE id = 'tpl-romantic' AND category = 'wedding';
UPDATE templates SET category = 'conference' WHERE id = 'tpl-formal' AND category = 'wedding';
UPDATE templates SET category = 'meeting' WHERE id = 'tpl-corporate' AND category = 'wedding';
UPDATE templates SET category = 'graduation' WHERE id = 'tpl-plan-graduation';
