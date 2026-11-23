import Link from "next/link";
import {
  CalendarHeart, Users, QrCode, ShieldCheck, Music4, Sparkles,
  BarChart3, UserCheck, ArrowLeft, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brand } from "@/components/brand";
import { PLANS_SEED } from "@/lib/seeds";

const FEATURES = [
  { icon: Sparkles, title: "دعوات متحركة بصوت", desc: "قوالب ملكية وعصرية وتراثية، حركات قصيرة ووظيفية، ونشيد يبدأ بعد تفاعل الضيف — باحترام كامل لتقليل الحركة." },
  { icon: UserCheck, title: "تفويض بحصص ذرّية", desc: "وزّع الدعوات على مفوّضين بحدود وصلاحيات، مع سجل أرصدة يمنع التجاوز حتى في الطلبات المتزامنة." },
  { icon: Users, title: "ضيوف ومرافقون", desc: "فئات VIP وعائلات وشركات، استيراد CSV بمعاينة وتطهير تكرارات، وسياسة مرافقين واضحة لكل فئة." },
  { icon: QrCode, title: "دخول عبر QR", desc: "مسح فوري عند البوابة، منع الدخول المكرر، لوحة حضور لحظية، وإجراء يدوي مبرر عند الاستثناء." },
  { icon: BarChart3, title: "تقارير تطابق الواقع", desc: "مؤكد/معتذر/منتظر وحضور فعلي، إحصاءات لكل مفوّض وفئة وبوابة، وتصدير CSV بضغطة." },
  { icon: ShieldCheck, title: "عزل وخصوصية", desc: "بيانات كل مؤسسة معزولة بالكامل، رموز دعوات غير قابلة للتخمين، وسجل تدقيق لكل عملية حساسة." },
];

const STEPS = [
  { n: "١", t: "أنشئ مناسبتك", d: "زواج، تخرج، مولود، مؤتمر… معالج خطوات بحفظ تلقائي وتاريخ هجري/ميلادي." },
  { n: "٢", t: "صمّم دعوتك", d: "اختر قالبًا، عدّل النصوص والألوان والحركة، وارفع نشيدك المرخّص." },
  { n: "٣", t: "وزّع وأرسل", d: "أضف ضيوفك أو استوردهم، فوّض بحصص، وشارك روابط خاصة وQR." },
  { n: "٤", t: "استقبل وتابع", d: "ردود RSVP، مسح عند البوابة، ولوحة تقارير لحظية حتى إغلاق المناسبة." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* ترويسة */}
      <header className="sticky top-0 z-40 border-b border-navy-950/8 bg-ivory-soft/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Brand size={30} tone="brown" showLatin={false} />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-muted sm:flex">
            <a href="#features" className="transition-colors hover:text-navy-950">المزايا</a>
            <a href="#how" className="transition-colors hover:text-navy-950">كيف تعمل</a>
            <Link href="/pricing" className="transition-colors hover:text-navy-950">الأسعار</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login"><Button variant="ghost" size="sm">دخول</Button></Link>
            <Link href="/register"><Button size="sm">ابدأ مجانًا</Button></Link>
          </div>
        </div>
      </header>

      {/* البطل */}
      <section className="relative overflow-hidden bg-navy-950 text-ivory">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-lime-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-brand-orange/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:py-28 lg:grid-cols-2 lg:items-center">
          <div className="animate-fade-up">
            <Badge tone="lime" className="mb-5">منصة عربية مستقلة · RTL أولًا</Badge>
            <h1 className="font-display text-4xl font-bold leading-[1.25] sm:text-5xl sm:leading-[1.25]">
              من أول فكرة،
              <br />
              <span className="text-lime-400">حتى آخر ضيف</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-ivory/75">
              خطّط مناسبتك بالكامل في مكان واحد: ميزانية ومصروفات ومدفوعات، مهام وموردون وجدول زمني،
              ثم دعوات متحركة بصوت مرخّص وتأكيد حضور ودخول منظّم عبر QR — لكل أنواع المناسبات.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register">
                <Button size="lg">أنشئ مناسبتك الأولى <ArrowLeft className="h-4.5 w-4.5" /></Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-ivory/25 bg-transparent text-ivory hover:bg-ivory/10 hover:border-ivory/50">اطّلع على الباقات</Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-ivory/50">الباقة المجانية: مناسبة واحدة و30 ضيفًا — بلا بطاقة دفع.</p>
          </div>

          {/* معاينة دعوة شكلية */}
          <div className="mx-auto w-full max-w-xs animate-pop">
            <div className="invitation-frame relative overflow-hidden rounded-[2rem] border border-ivory/15 bg-navy-900 p-6 shadow-2xl">
              <div className="flex h-full flex-col items-center justify-between text-center">
                <span className="text-3xl text-lime-400">✦</span>
                <div>
                  <p className="text-xs tracking-widest text-ivory/60">نتشرف بحضوركم</p>
                  <p className="font-display mt-3 text-2xl font-bold leading-relaxed text-ivory">حفل الخطوبة</p>
                  <p className="mt-2 text-sm text-ivory/70">الخميس ٢٠ جمادى الآخرة</p>
                  <p className="text-xs text-ivory/50">قاعة الياسمين — الرياض</p>
                </div>
                <div className="w-full space-y-3">
                  <div className="rounded-xl bg-lime-400 py-2.5 text-sm font-bold text-navy-950">فتح الدعوة ♪</div>
                  <div className="flex items-center justify-center gap-2 text-[10px] text-ivory/40">
                    <Music4 className="h-3.5 w-3.5" /> الصوت يبدأ بعد تفاعلك
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* المزايا */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-bold">كل ما تحتاجه المناسبة، بلا فوضى</h2>
          <p className="mt-3 text-muted">وحدات مصممة لتعمل معًا: من الدعوة إلى التقرير الختامي.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-card border border-navy-950/8 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-lime-100 text-navy-950 transition-colors group-hover:bg-lime-400">
                <f.icon className="h-5.5 w-5.5" />
              </span>
              <h3 className="mb-2 font-bold">{f.title}</h3>
              <p className="text-sm leading-7 text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* الخطوات */}
      <section id="how" className="scroll-mt-20 bg-ivory/60 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display mb-12 text-center text-3xl font-bold">أربع خطوات من الفكرة إلى الاستقبال</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="relative rounded-card bg-white p-6 shadow-sm">
                <span className="font-display absolute -top-4 right-5 flex h-9 w-9 items-center justify-center rounded-full bg-navy-950 text-lg font-bold text-lime-400">{s.n}</span>
                <h3 className="mb-2 mt-3 font-bold">{s.t}</h3>
                <p className="text-sm leading-7 text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* لمحة أسعار */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold">باقات تناسب حجم مناسبتك</h2>
            <p className="mt-2 text-sm text-muted">أسعار تجريبية مقترحة — تُراجع بعد قياس تكلفة التشغيل.</p>
          </div>
          <Link href="/pricing"><Button variant="outline">التفاصيل الكاملة <ArrowLeft className="h-4 w-4" /></Button></Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS_SEED.map((p) => (
            <div key={p.id} className={`rounded-card border p-6 ${p.id === "pro" ? "border-lime-400 bg-navy-950 text-ivory shadow-xl" : "border-navy-950/8 bg-white"}`}>
              {p.id === "pro" && <Badge tone="lime" className="mb-3">الأكثر اختيارًا</Badge>}
              <h3 className="font-bold">{p.name_ar}</h3>
              <p className="mt-2 text-3xl font-extrabold tabular-nums">
                {p.price_monthly_sar === 0 ? "مجانًا" : `${p.price_monthly_sar} ر.س`}
                {p.price_monthly_sar > 0 && <span className={`text-xs font-medium ${p.id === "pro" ? "text-ivory/60" : "text-muted"}`}> / شهريًا</span>}
              </p>
              <ul className={`mt-4 space-y-2 text-sm ${p.id === "pro" ? "text-ivory/80" : "text-muted"}`}>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-lime-500" /> {p.max_active_events} مناسبة نشطة</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-lime-500" /> {p.max_guests_per_event.toLocaleString("ar")} ضيف</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-lime-500" /> {p.max_delegates_per_event} مفوّض</li>
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ختام */}
      <section className="bg-navy-950 py-16 text-center text-ivory">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="font-display text-3xl font-bold leading-relaxed">جاهز تدعو بطريقة تليق بمناسبتك؟</h2>
          <p className="mt-3 text-ivory/70">ابدأ مجانًا خلال دقيقة — وأنشئ أول دعوة متحركة اليوم.</p>
          <Link href="/register" className="mt-7 inline-block"><Button size="lg">ابدأ الآن <ArrowLeft className="h-4.5 w-4.5" /></Button></Link>
        </div>
      </section>

      <footer className="border-t border-navy-950/8 bg-ivory-soft py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-muted">
          <p>© 2026 ليلتنا | LAYLATNA — اسم عمل مبدئي لحين اعتماد العلامة والنطاق.</p>
          <div className="flex gap-4">
            <Link href="/pricing" className="hover:text-navy-950">الأسعار</Link>
            <Link href="/login" className="hover:text-navy-950">دخول</Link>
            <span>الخصوصية والشروط: قيد الاعتماد القانوني</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
