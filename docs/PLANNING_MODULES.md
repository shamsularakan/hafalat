# وحدات التخطيط المضافة — ليلتنا | LAYLATNA
توسيع نطاق المنصة من «إدارة الدعوات» إلى **إدارة دورة حياة المناسبة**، دون إلغاء أي وظيفة سابقة.

## 1) المبدأ
عند إنشاء مناسبة جديدة يُنشأ **تلقائيًا** من قالب نوعها:
- فئات ميزانية (بنسب من الميزانية المعتمدة)
- مهام التجهيز (بمواعيد محسوبة نسبيًا من تاريخ المناسبة)
- قائمة تجهيز (Checklist)
- جدول زمني (مراحل التجهيز / يوم المناسبة / بعد المناسبة)

8 قوالب:`wedding, engagement, graduation, conference, opening, meeting, family, festival`،
قابلة للتطبيق يدويًا من «مركز التخطيط» (يُظهر تحذيرًا قبل استبدال القوائم الحالية).

## 2) الجداول الجديدة (`db/migrations/002_planning.sql`)
| الجدول | الغرض |
|---|---|
| `event_plans` | ميزانية معتمدة + تكلفة ضيافة/شخص + ملاحظات لكل مناسبة |
| `planning_templates` | قوالب أنواع المناسبات (مهام/فئات/قوائم/جدول بصيغة JSON) |
| `budget_categories` | فئات الميزانية والمبالغ المخططة |
| `expenses` | المصروفات/المشتريات/الخدمات (حالة: planned/paid/cancelled) |
| `payments` | العربون/الدفعات/السداد/المسترد + تاريخ الاستحقاق |
| `tasks` | المهام (كانBan: todo/doing/done، أولوية، مسؤول، موعد) |
| `checklists` + `checklist_items` | قوائم التجهيز القابلة للتعديل |
| `vendors` | القاعات/المصورون/المطاعم/مقدمو الخدمات |
| `attachments` | العقود/عروض الأسعار/الفواتير/الصور (ملفات محكومة) |
| `timeline_items` | برنامج التجهيز ويوم المناسبة |
| `planning_team` | أدوار التخطيط: planner / finance / services (لكل مناسبة، متعددة لشخص واحد) |

## 3) الفصل المالي الصارم (منع العد المزدوج)
| المؤشر | التعريف |
|---|---|
| `committed` (المحجوز) | مجموع المصروفات غير الملغاة |
| `spent_actual` (المصروف الفعلي) | مجموع المصروفات بحالة `paid` |
| `paid_cash` (المدفوع نقدًا) | مجموع الدفعات بحالة `paid` (قد تشمل عربونًا لمصروف غير مسدود بالكامل) |
| `obligations` (الالتزامات) | مجموع الدفعات `pending/overdue` |
| `remaining_actual` | الميزانية − المصروف الفعلي |
| `usage_percent` | المصروف الفعلي ÷ الميزانية |
| `hospitality.estimate` | عدد المؤكدين (آخر رد لكل دعوة) × تكلفة الشخص |

هذه الأرقام **لا تُجمع مع بعضها** في التقارير؛ كل واحد يمثل زاوية مختلفة (راجع شريط التنبيه في صفحة الميزانية).

## 4) الأدوار والصلاحيات
- مالك/مدير المناسبة: كل الوحدات.
- `planner`: المهام/القوائم/الجدول/إعدادات الخطة.
- `finance`: الميزانية/المصروفات/المدفوعات/الفئات.
- `services`: الموردون/المرفقات/الإشراف على الخدمات.
- تبقى أدوار الدعوات (مفوّض/استقبال/مشرف/مصمم) **بدون تغيير**، ويمكن للشخص الجمع بين دور من دورات التخطيط ودور من أدوار الدعوات.
- التحقق في الخادم عبر `requirePlanningAccess(ctx, eventId, area)` + عزل `organization_id`.

## 5) الربط بالدعوات (المرحلة 5)
- تقدير الضيافة يُحسب من **آخر رد RSVP مؤكد** لكل دعوة (مع tie-break عبر `rowid` عند تساوي الوقت).
- بطاقات الدخول/الاستقبال تُغذّي «تقرير إغلاق المناسبة» مع الحضور الفعلي ونسبة الدخول.
- تصدير CSV من تقارير الدعوات + تقرير الإغلاق المالي.

## 6) الصفحات الجديدة
`/app/events/[id]/plan` · `/budget` · `/payments` · `/tasks` · `/vendors` · `/timeline` · `/team` · `/closing`
كلها متجاوبة RTL على 320px+، وتستخدم مكوّن الحوار الموحّد (portal إلى body).

## 7) واجهات API
- `GET/PATCH/POST /api/events/:id/planning` · `GET /api/planning-templates`
- `GET/POST /api/events/:id/tasks` · `PATCH/DELETE /api/tasks/:id`
- `GET/POST /api/events/:id/checklists` · `POST/DELETE /api/checklist-items/:id`
- `GET/POST /api/events/:id/timeline` · `PATCH/DELETE /api/timeline/:id`
- `GET/POST /api/events/:id/team` · `DELETE /api/team/:id`
- `GET /api/events/:id/finance/summary` · `GET/POST /api/events/:id/expenses|payments|budget-categories` · `PATCH/DELETE /api/expenses|payments|budget-categories/:id`
- `GET/POST /api/events/:id/vendors` · `PATCH/DELETE /api/vendors/:id`
- `GET/POST /api/events/:id/attachments` · `GET/DELETE /api/events/:id/attachments/:attachmentId`

## 8) الاختبارات
`tests/planning-finance.test.ts` — 7 اختبارات: القوالب التلقائية، تطبيق قالب صريح، الفصل المالي، آخر رد مؤكد للضيافة، فئات الميزانية، العزل بين المؤسسات، وصلاحية المسؤول المالي دون إدارة المهام.
 **`npm test`: 61/61 ناجحًا.**

## 9) المتبقي/مفتوح
- تنبيهات التذكير الفعلية ( jobs/بريد/واتساب) بالمرحلة القادمة.
- تقويم مهام تفاعلي كامل (عرض كانBan مطبّق حاليًا + تواريخ الاستحقاق).
- توقيع عقود رقمي/ربط مزود دفع فعلي للمدفوعات (حاليًا تسجيل يدوي).
- الاعتماد النهائي لاسم «ليلتنا»/النطاق وترخيص خط ثمانية.
