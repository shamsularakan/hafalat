# ليلتنا | LAYLATNA

منصة عربية SaaS شاملة لـ **تخطيط المناسبات وإدارتها من الفكرة إلى الإغلاق**: ميزانية ومصروفات ومدفوعات،
مهام وقوائم تجهيز وموردون وعقود ومرفقات وجدول زمني وفريق تنظيم،
إلى جانب الدعوات المتحركة بالصوت والتفويض بالحصص والضيوف والمرافقين وتأكيد الحضور QR والتقارير والاشتراكات.

> الاسم الجديد «ليلتنا» مقترح ويحتاج التحقق من توفر العلامة والنطاق قبل الاعتماد النهائي. الكود والمتغيرات الداخلية تحتفظ باسم `dawat` كاسم تقني فقط (`DAWAT_DB_PATH` …) لاستقرار الإعدادات.
> نُفذ وفق الوثيقة الأصلية 1.0 + تحديث نطاق «ليلتنا» الموسّع — راجع [تقرير المراحل](docs/PHASE_REPORT.md)، [الهوية البصرية](docs/IDENTITY.md)، [محرك القوالب](docs/TEMPLATE_ENGINE.md)، [وحدات التخطيط](docs/PLANNING_MODULES.md)، و[معايير القبول](docs/ACCEPTANCE.md).
> حالة المنتج: **الإصدار 0.3 — منصة دورة حياة المناسبة (MVP موسّع)**.

## البدء السريع

```bash
npm install
copy .env.example .env.local      # في PowerShell: Copy-Item .env.example .env.local
npm run migrate                   # ترحيلات + بذر الباقات والقوالب
npm run seed                      # بيانات تجريبية غير حقيقية (اختياري)
npm run dev                       # http://localhost:3000
```

 للإنتاج المحلي: `npm run build` ثم `npm start`.

### حسابات تجريبية (بعد `npm run seed`)

| الدور | البريد | كلمة المرور |
|---|---|---|
| مالك المناسبة | `demo@dawat.local` | `Demo1234!` |
| مفوّض دعوات | `delegate@dawat.local` | `Demo1234!` |
| موظف استقبال | `gate@dawat.local` | `Demo1234!` |

يفترض البذر مناسبة زفاف منشورة بتصميم ملكي، 12 ضيفًا، 10 دعوات، ردود RSVP، وعمليتَي دخول،
ومناسبة تخرج مسودة. روابط الدعوات تُطبع في نهاية البذر.

## الأوامر

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | تطوير (Next.js) |
| `npm run build` / `npm start` | بناء وتشغيل إنتاجي |
| `npm test` | اختبارات القبول والوحدات (Vitest — 64 اختبارًا) |
| `npm run typecheck` | فحص TypeScript صارم |
| `npm run migrate` | تطبيق الترحيلات وبذر الباقات/القوالب/قوالب التخطيط |
| `npm run seed` | بذر تجريبي غير حقيقي |
| `npm run backup` | نسخة احتياطية حية متسقة (VACUUM INTO) مع فحص سلامة |
| `npm run set-admin -- <email>` | منح صلاحية مدير المنصة (`--revoke` للسحب) |

## التقنيات

- **الواجهة:** React 19 + TypeScript + Next.js 15 (App Router) + Tailwind CSS v4، مكونات بنمط shadcn/ui، عربي RTL أولًا، متجاوب جوال/حاسوب.
- **الحركة:** Motion for React — حركات قصيرة ووظيفية (150–600ms)، transform/opacity، واحترام `prefers-reduced-motion`.
- **الخادم:** Route handlers موثقة JSON بأخطاء موحدة `{ok, error:{code,message}, request_id}`،/services نقية قابلة للاختبار بلا اعتماد على HTTP.
- **قاعدة البيانات:** SQLite (`node:sqlite`) للتطوير والاختبارات عبر طبقة وصول واحدة؛ SQL قياسي قابل للترحيل إلى PostgreSQL (Supabase/Neon) — انظر [البنية](docs/ARCHITECTURE.md).
- **الوسائط:** تخزين كائني محلي `data/uploads` بروابط مضبوطة (ملكية/رمز دعوة)؛ الإنتاج S3/R2 + CDN.
- **الدفع:** واجهة مزود قابلة للاستبدال؛ الوضع الحالي `stub` (محاكاة محلية بلا حركة مالية).
- **QR:** توليد `qrcode` (SVG) ومسح `jsqr` بالكاميرا داخل المتصفح — لا تُرفع صور للخادم.

## الخط الطباعي (ثمانية)

الوثيقة تشترط خط ثمانية **من ملفات مرخصة يقدمها صاحب المشروع**. لم تُضمَّن أي ملفات خطوط في المستودع.
عند توفر الترخيص: ضع `ThmanyahSans-*.woff2` و`ThmanyahSerif-*.woff2` في `public/fonts/thmanyah/`
وفعّل `@font-face` في `src/app/globals.css` (الأسماء محجوزة مسبقًا في الـ tokens).
البديل الحالي: خطوط نظام عربية آمنة (Segoe UI/Tahoma) مع Serif للعناوين الفنية.

## البنية

```
db/migrations/001_init.sql   المخطط الأساسي (22 جدولًا) + فهارس وقيود
db/migrations/002_planning.sql  جداول التخطيط/الميزانية/المهام/الموردون/المرفقات/الفريق
db/seed.ts                   بذر تجريبي غير حقيقي
scripts/backup.ts            نسخ احتياطي حي + فحص سلامة
scripts/set-admin.ts         منح/سحب صلاحية مدير المنصة
src/lib/                     db, auth, permissions, tokens, errors, plans, seeds, planning-seeds, csv, dates, api
src/server/services/         events, guests, delegations, invitations, rsvp, checkins, reports, designs, media, billing,
                             planning, finance, resources + لوحة مدير المنصة
src/app/api/                 ~70 مسار REST (منها /api/admin/* ووحدات التخطيط)
src/app/                     landing, pricing, login, register, /app, /app/admin, /app/events/[id]/*
                             (plan, budget, payments, tasks, vendors, timeline, team, closing + وحدات الدعوات), /i/[token]
src/components/              ui (نمط shadcn), app-shell, invitation-card, qr-scanner, guest-client…
tests/                       10 ملفات اختبار — 64 اختبارًا (AC-01..AC-15 + التخطيط/المالية)
docs/                        ARCHITECTURE, API, ERD, PHASE_REPORT, ACCEPTANCE, COMPETITOR_*, PLANNING_MODULES
```

## الأمان والخصوصية (ملخص)

- عزل كامل بين المؤسسات في كل استعلام (`organization_id`) + أدوار فعّالة على المناسبة — اختبارات AC-01.
- الحصص تُصدر داخل معاملات `BEGIN IMMEDIATE` ذرّية؛ سجل `quota_ledger` لكل حركة — AC-02/03/11.
- رموز الدعوات: HMAC غير قابل للتخمين، يُخزن `sha256` فقط، إبطال/إعادة إصدار عبر nonce، وصلاحية مرتبطة بنهاية المناسبة.
- QR يحتوي الرابط فقط — بلا بيانات شخصية. صفحة الضيف لا تكشف أي ضيف آخر.
- كلمات المرور scrypt، جلسات httpOnly/SameSite، تحديد معدل، تحقق مدخلات، منع SVG/التنفيذيات بالرفع، تأكيد حقوق الصوت.
- سجل تدقيق للعمليات الحساسة بلا رموز خام أو محتوى حساس.
- **قبل الإطلاق:** مراجعة PDPL، سياسة خصوصية وشروط استخدام معتمدة، 2FA للمشرفين، تشفير أعمدة الهواتف، مزود دفع معتمد، واختبارات استعادة دورية. راجع [تقرير المراحل](docs/PHASE_REPORT.md).

## الترخيص

انظر [LICENSE](LICENSE) — المكونات الخاصة مملوكة لمشروع DAWAT. مراجع التصميم (DesignBookmark وغيرها) للإلهام فقط ولا يُنسخ منها محتوى محمي.
