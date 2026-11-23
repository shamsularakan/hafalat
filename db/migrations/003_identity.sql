-- تحديث الهوية البصرية: استبدال لوحة DAWAT القديمة بلوحة ليلتنا
-- آمن للتكرار: يعمل على قوالب المنصة وتصاميم الدعوات المخزنة سابقًا

UPDATE templates SET schema_json = json_set(json_set(json_set(json_set(json_set(json_set(schema_json,
  '$.palette.bg', '#4A3B36'), '$.palette.card', '#5A4A44'), '$.palette.primary', '#C99A6B'),
  '$.palette.accent', '#C99A6B'), '$.palette.text', '#FBF8F5'), '$.palette.muted', '#C9B7A6')
WHERE id = 'tpl-royal';

UPDATE templates SET schema_json = json_set(json_set(json_set(json_set(json_set(json_set(schema_json,
  '$.palette.bg', '#EDE9E6'), '$.palette.card', '#FFFFFF'), '$.palette.primary', '#4A3B36'),
  '$.palette.accent', '#C99A6B'), '$.palette.text', '#4A3B36'), '$.palette.muted', '#8A7A70')
WHERE id = 'tpl-modern';

UPDATE templates SET schema_json = json_set(json_set(json_set(json_set(json_set(json_set(schema_json,
  '$.palette.bg', '#5A4A44'), '$.palette.card', '#4A3B36'), '$.palette.primary', '#C99A6B'),
  '$.palette.accent', '#E2D3C3'), '$.palette.text', '#FBF8F5'), '$.palette.muted', '#C9B7A6')
WHERE id = 'tpl-heritage';

UPDATE templates SET schema_json = json_set(json_set(json_set(json_set(json_set(json_set(schema_json,
  '$.palette.bg', '#6B574F'), '$.palette.card', '#5A4A44'), '$.palette.primary', '#E2D3C3'),
  '$.palette.accent', '#C99A6B'), '$.palette.text', '#FBF8F5'), '$.palette.muted', '#D6C4B4')
WHERE id = 'tpl-romantic';

UPDATE templates SET schema_json = json_set(json_set(json_set(json_set(json_set(json_set(schema_json,
  '$.palette.bg', '#4F6B5F'), '$.palette.card', '#3F574C'), '$.palette.primary', '#F6F1EC'),
  '$.palette.accent', '#C99A6B'), '$.palette.text', '#FBF8F5'), '$.palette.muted', '#CFDAD2')
WHERE id = 'tpl-formal';

UPDATE templates SET schema_json = json_set(json_set(json_set(json_set(json_set(json_set(schema_json,
  '$.palette.bg', '#EDE9E6'), '$.palette.card', '#FFFFFF'), '$.palette.primary', '#4A3B36'),
  '$.palette.accent', '#C99A6B'), '$.palette.text', '#4A3B36'), '$.palette.muted', '#8A7A70')
WHERE id = 'tpl-corporate';

-- تصاميم الدعوات المنشورة/المسودة القديمة
UPDATE invitation_designs SET scenes_json = json_set(json_set(json_set(json_set(json_set(json_set(scenes_json,
  '$.palette.bg', '#4A3B36'), '$.palette.card', '#5A4A44'), '$.palette.primary', '#C99A6B'),
  '$.palette.accent', '#C99A6B'), '$.palette.text', '#FBF8F5'), '$.palette.muted', '#C9B7A6')
WHERE json_valid(scenes_json) = 1
  AND (scenes_json LIKE '%#B1E449%' OR scenes_json LIKE '%#111827%' OR scenes_json LIKE '%#E7EBD7%');
