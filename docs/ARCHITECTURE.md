# البنية التقنية — DAWAT

## الطبقات

```
┌────────────────────────────────────────────────────────┐
│ الواجهة: Next.js App Router (RTL)                      │
│  /app لوحة التحكم · /i/[token] صفحة الضيف · تسويق/أسعار │
├────────────────────────────────────────────────────────┤
│ API: route handlers خفيفة                              │
│  مصادقة (cookies) → buildCtx → خدمة → استجابة موحدة     │
├────────────────────────────────────────────────────────┤
│ الخدمات: src/server/services (نقية، بلا HTTP)          │
│  events guests delegations invitations rsvp checkins   │
│  reports designs media billing                         │
├────────────────────────────────────────────────────────┤
│ النواة: src/lib                                        │
│  permissions (عزل/أدوار) · tokens · auth · audit       │
│  plans (حدود) · errors · db (وصول + معاملات + ترحيل)    │
├────────────────────────────────────────────────────────┤
│ التخزين: SQLite node:sqlite + ملفات وسائط محلية        │
└────────────────────────────────────────────────────────┘
```

**مبدأ الاختبارية:** كل خدمة تستقبل `Ctx = {db, actor, ip}` ولا تقرأ cookies أو Request.
الاختبارات تبني قواعد معزولة في الذاكرة وتستدعي الخدمات مباشرة؛ مسارات API مجرد غلاف رقيق.

## قابلية الترحيل إلى PostgreSQL

- كل SQL مكتوب بصيغة قياسية مشتركة (لا دوال خاصة بـ SQLite عدا `strftime` في القيم الافتراضية
  و`INSERT … ON CONFLICT` وهي مدعومة في Postgres أيضًا؛ `MAX()` في UPDATE تُستبدل بـ `GREATEST` عند الترحيل).
- الترحيلات ملفات SQL مرقمة في `db/migrations` مع جدول `schema_migrations`.
- عند اعتماد Supabase/Neon: تُضاف migrations مكافئة لـ Postgres + سياسات RLS كطبقة دفاع ثانية،
  وتُستبدل طبقة `DB` بتنفيذ pg مع الحفاظ على توقيع `get/all/run/tx` نفسه.
- المعاملات الذرّية `BEGIN IMMEDIATE` تقابل `BEGIN` + `SELECT … FOR UPDATE` على صف التفويض في Postgres.

## نموذج العزل والصلاحيات

1. **جلسة:** cookie `dawat_session` (رمز عشوائي 32B، يُخزن sha256 فقط) → مستخدم.
2. **منظمة نشطة:** cookie `dawat_org` + تحقق عضوية؛ وإلا أول عضوية (مالك أولًا).
3. **سياج المستأجر:** كل تحميل كيان يمر بـ `organization_id` (AC-01: حتى بتغيير معرّف الرابط → NOT_FOUND).
4. **دور فعّال على المناسبة:** عضوية `event_members` أعلى رتبة، أو اشتقاق من دور المنظمة
   (مالك المنظمة → owner، مشرفها → manager)، أو ملكية مباشرة.
5. **تفويض:** للمفوّض/المشرف تُحمّل `delegations` النشطة وتُفحص أعلام الصلاحيات
   (`can_issue, can_send, can_cancel, allow_vip, allow_companions, allowed_group_ids, can_view_all…`).
6. **استقبال:** `assertGateAccess` يحصر الموظف ببوابات تكليفه (AC-10).

## الحصص الذرّية (AC-02 / AC-03 / AC-11)

- وحدة الحصة لكل مناسبة: `card` (دعوة=وحدة) أو `person` (1 + مرافقو الفئة). تُقفل `unit_locked` بعد أول إصدار.
- الإصدار داخل `tx(BEGIN IMMEDIATE)`:
  فحص حالة المناسبة → ملكية الضيف/التفويض → VIP/الفئات → الحصة المتبقية → سعة المناسبة
  → إنشاء/تحديث الدعوة (token_hash) → خصم `quota_used` → قيد `quota_ledger` → قفل الوحدة → idempotency.
- SQLite كاتب واحد + IMMEDIATE يضمن تسلسل الفحص والخصم؛ طلبان متوازيان على الحافة: واحد فقط ينجح.
- الإلغاء: يعيد الحصة (`cancel_return`) أو يبقيها (`cancel_burn`) حسب `events.cancel_returns_quota`، بقيد ledger وسبب.
- إعادة التخصيص بين مفوّضين: نقل من غير المستخدم فقط، بسبب إلزامي وقيدَي out/in.
- المفوّض الفرعي (مشرف): يأخذ من حصة المشرف نفسه — لا تُخلق حصة إضافية.
- idempotency: جدول `idempotency_keys` (scope+key) للإصدار والمسح؛ و`UNIQUE(delegation_id, idempotency_key)` على الدعوات.

## رموز الدعوات وQR

- `token = base64url(HMAC-SHA256(DAWAT_SECRET, invitationId:nonce))[:43]` — غير قابل للتخمين.
- يُخزن `sha256(token)` فقط؛ يُعاد اشتقاق الرمز للمشاركة من (id, nonce) دون تخزين الخام.
- إعادة الإصدار بعد الإلغاء تولّد nonce جديدًا → الرابط القديم يموت فورًا.
- الصلاحية: `ends_at + 24h` (أو `starts_at + 48h`)، وحالة `cancelled/expired` تمنان الوصول (AC-07).
- QR = رابط الدعوة فقط؛ يولّد SVG عند الطلب بعد تحقق صلاحية الرمز.

## الوسائط

- رفع multipart → تحقق نوع/حجم (صوت ≤15MB، صور ≤5MB؛ منع SVG والتنفيذيات) → تأكيد حقوق للصوت إلزامي.
- تخزين `data/uploads/{orgId}/{assetId}.{ext}`؛ الإنتاج: Object Storage + CDN بروابط موقعة.
- وصول المالك: `/api/assets/:id` (عضوية المنظمة). وصول الضيف: `/api/i/:token/audio` و`/api/i/:token/asset/:assetId`
  (مربوطة بتصميم دعوة صالحة فقط، مع دعم Range للصوت على iOS/Android).
- حذف مرن (soft delete): `status='deleted'` + إزالة الملف + تدقيق.

## الأداء والحمل (القسم 10)

- المسح عملية قصيرة داخل معاملة واحدة؛ تحديد معدل 240/دقيقة لكل موظف.
- لوحة الحضور: polling كل 20 ثانية (ضمن 15–60 الموصى بها) — لا استدعاءات كل ثانية.
- صفحات الضيوف وAPI: `Cache-Control: no-store` + `X-Robots-Tag: noindex`.
- WAL + busy_timeout=5000؛ فهارس على event_id/delegation_id/status/created_at.
- لاحقًا: صفوف jobs للإرسال/التذكير مع backoff وDLQ، وبث أحداث بدل polling عند الحاجة.

## بيئات وأسرار

- `.env.example` بلا أسرار؛ أسرار dev/staging/prod منفصلة. `DAWAT_SECRET` إلزامي التغيير في الإنتاج.
- CI (GitHub Actions): typecheck + tests + build + migrations smoke على Node 24.
- النسخ الاحتياطي: `npm run backup` (VACUUM INTO حي + integrity_check)؛ الاستعادة موثقة ومختبرة (AC-15).
