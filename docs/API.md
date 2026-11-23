# عقود API — DAWAT

كل الاستجابات JSON بالبنية الموحدة:

```json
// نجاح
{ "ok": true, "data": { … }, "request_id": "uuid" }
// خطأ
{ "ok": false, "error": { "code": "QUOTA_EXCEEDED", "message": "رسالة عربية قابلة للترجمة", "details": null }, "request_id": "uuid" }
```

رموز الأخطاء الثابتة: `UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION, QUOTA_EXCEEDED, CAPACITY_EXCEEDED, CONFLICT, INVALID_TOKEN, EXPIRED, DUPLICATE_ENTRY, REENTRY_DENIED, EVENT_CLOSED, UNIT_LOCKED, PLAN_LIMIT, RATE_LIMITED, DECLINED_INVITATION, NOT_IMPLEMENTED, INTERNAL`.

المصادقة: cookie جلسة `dawat_session` (httpOnly, SameSite=Lax). المنظمة النشطة: `dawat_org`.
مفاتيح idempotency: حقل `idempotency_key` بالجسم أو ترويسة `Idempotency-Key` (إصدار الدعوات/المسح/الإرسال).

## Auth
| Method | Path | الحماية | الوظيفة |
|---|---|---|---|
| POST | /api/auth/register | عام + معدل 5/ساعة/IP | حساب + مساحة عمل + اشتراك مجاني |
| POST | /api/auth/login | عام + معدل 10/دقيقة | جلسة |
| POST | /api/auth/logout | جلسة | إبطال الجلسة |
| GET | /api/auth/session | عام | المستخدم/المنظمة/العضويات |
| POST | /api/auth/switch-org | جلسة + عضوية | تبديل المنظمة النشطة |

## Events
| Method | Path | الحماية |
|---|---|---|
| GET/POST | /api/events | عضوية منظمة (POST: حد الباقة) |
| GET/PATCH | /api/events/:id | وصول مناسبة (PATCH: owner/manager) |
| POST | /api/events/:id/status | owner/manager — انتقالات مشروطة |
| POST | /api/events/:id/clone | owner/manager |
| GET/POST | /api/events/:id/gates | وصول/إدارة |
| GET/POST | /api/events/:id/members | owner/manager — طاقم وبوابات |
| GET/POST | /api/events/:id/groups | وصول/إدارة — فئات ومرافقون |
| PATCH | /api/groups/:id | owner/manager |

## Guests
| Method | Path | الحماية |
|---|---|---|
| GET/POST | /api/events/:id/guests | نطاق المناسبة + رؤية المفوّض لضيوفه فقط |
| POST | /api/events/:id/guests/import | dryRun معاينة ثم تأكيد؛ أخطاء صفوف وتكرارات |
| GET | /api/events/:id/guests/export | CSV ضمن الصلاحية |
| PATCH | /api/guests/:id | مالك ضيف/مدير |
| POST | /api/guests/:id/transfer | owner/manager — يبقى الداعي الأصلي |

## Delegation & Quota
| Method | Path | الحماية |
|---|---|---|
| GET/POST | /api/events/:id/delegations | owner/manager/supervisor (بإذن) |
| PATCH | /api/delegations/:id | owner/manager — حصة/صلاحيات/إيقاف |
| POST | /api/delegations/reallocate | owner/manager/supervisor — بسبب إلزامي |
| GET | /api/events/:id/ledger | سجل الأرصدة (المفوّض: تفويضه فقط) |

## Invitations & Delivery
| Method | Path | الحماية |
|---|---|---|
| GET | /api/events/:id/invitations | نطاق + فلاتر status/delegation/q |
| POST | /api/events/:id/invitations | إصدار ذرّي {guest_id, delegation_id?, idempotency_key?} |
| GET | /api/invitations/:id | تفاصيل + رابط معاد الاشتقاق |
| POST | /api/invitations/:id/cancel | {reason} — سياسة إرجاع الحصة |
| POST | /api/invitations/:id/delivery | {channel: whatsapp_manual/link_copy/email} منع تكرار 60ث |

## Guest public (بلا حساب — رمز الدعوة)
| Method | Path | الوظيفة |
|---|---|---|
| GET | /api/i/:token | حمولة آمنة + تسجيل «شوهدت» |
| POST | /api/i/:token/rsvp | {answer, persons?, message?} ضمن حد المرافقين |
| GET | /api/i/:token/qr.svg | QR الرابط فقط |
| GET | /api/i/:token/audio | بث Range مربوط بالدعوة |
| GET | /api/i/:token/asset/:assetId | شعار/خلفية التصميم فقط |
| GET | /api/i/:token/calendar.ics | إضافة للتقويم |

## Check-in
| Method | Path | الحماية |
|---|---|---|
| POST | /api/checkins/scan | موظف/بوابة + idempotency؛ {token, gate_id?, persons?} |
| POST | /api/checkins/manual | سبب إلزامي + override موثق |
| GET | /api/events/:id/live | لوحة لحظية (polling 20ث) |

## Design & Media
| Method | Path | الحماية |
|---|---|---|
| GET | /api/templates | عامة + قوالب المنظمة |
| GET/PUT | /api/events/:id/design | مسودة {template_id, schema, audio_asset_id} |
| POST | /api/events/:id/design/publish | نشر بإصدار جديد |
| POST | /api/uploads | multipart: file, kind, rights_attested — نوع/حجم/ملكية |
| GET/DELETE | /api/assets/:id | ملكية المنظمة |
| GET | /api/events/:id/media | قائمة الوسائط |

## Reports
| Method | Path | الحماية |
|---|---|---|
| GET | /api/events/:id/analytics | إحصاءات مطابقة للسجلات (AC-12) |
| GET | /api/events/:id/export?kind= | summary/guests/invitations/checkins CSV |

## Billing & Ops
| Method | Path | الحماية |
|---|---|---|
| GET | /api/billing | اشتراك + فواتير + استخدام |
| POST | /api/billing/checkout | مالك المنظمة — {plan_id, cycle} (stub حاليًا) |
| POST | /api/webhooks/payment | توقيع `x-webhook-signature` إلزامي |
| GET | /api/audit | owner/admin — سجل التدقيق |
| GET/PATCH | /api/org | إعدادات مساحة العمل والاحتفاظ |
| POST | /api/org/members | owner/admin — عضو مؤسسة |
| GET/POST | /api/message-templates | قوالب نصوص بمعاملات |
