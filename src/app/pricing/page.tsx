import Link from "next/link";
import { Check, Minus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLANS_SEED } from "@/lib/seeds";

export const metadata = { title: "الأسعار والباقات" };

const ROWS: { label: string; values: (p: typeof PLANS_SEED[number]) => React.ReactNode }[] = [
  { label: "مناسبات نشطة", values: (p) => p.max_active_events },
  { label: "ضيوف لكل مناسبة", values: (p) => p.max_guests_per_event.toLocaleString("ar") },
  { label: "مفوّضون لكل مناسبة", values: (p) => p.max_delegates_per_event },
  { label: "تخزين الوسائط", values: (p) => p.storage_mb >= 1024 ? `${p.storage_mb / 1024} GB` : `${p.storage_mb} MB` },
  { label: "قوالب متقدمة", values: (p) => p.advanced_templates ? <Check className="h-4.5 w-4.5 text-success" /> : <Minus className="h-4.5 w-4.5 text-muted" /> },
  { label: "علامة مخصصة", values: (p) => p.custom_branding ? <Check className="h-4.5 w-4.5 text-success" /> : <Minus className="h-4.5 w-4.5 text-muted" /> },
  { label: "مقاعد متعددة", values: (p) => p.multi_seat ? <Check className="h-4.5 w-4.5 text-success" /> : <Minus className="h-4.5 w-4.5 text-muted" /> },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-navy-950/8 bg-ivory-soft">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-extrabold">دعوات <span className="text-sm font-semibold text-muted">DAWAT</span></Link>
          <div className="flex gap-2">
            <Link href="/login"><Button variant="ghost" size="sm">دخول</Button></Link>
            <Link href="/register"><Button size="sm">ابدأ مجانًا</Button></Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-12 text-center">
          <Badge tone="lime" className="mb-4">أسعار تجريبية لاختبار السوق</Badge>
          <h1 className="font-display text-4xl font-bold">اختر الباقة المناسبة لحجمك</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted">
            الأسعار أدناه مقترحات أولية وليست التزامًا تسعيريًا. حدود الرسائل والتخزين والدعم
            تُضبط بالمبالغ الفعلية بعد تجربة تكلفة التشغيل. رسوم قنوات المراسلة (مثل واتساب API)
            منفصلة عن الاشتراك.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS_SEED.map((p) => (
            <div key={p.id} className={`flex flex-col rounded-card border p-6 ${p.id === "pro" ? "border-lime-400 bg-navy-950 text-ivory shadow-xl lg:-translate-y-2" : "border-navy-950/8 bg-white"}`}>
              <h2 className="font-bold">{p.name_ar}</h2>
              <p className="mt-3 text-4xl font-extrabold tabular-nums">
                {p.price_monthly_sar === 0 ? "٠" : p.price_monthly_sar}
                <span className={`text-sm font-semibold ${p.id === "pro" ? "text-ivory/60" : "text-muted"}`}> ر.س / شهريًا</span>
              </p>
              <p className={`mt-1 text-xs ${p.id === "pro" ? "text-ivory/50" : "text-muted"}`}>أو سنويًا بخصم شهرين</p>
              <ul className={`mt-5 flex-1 space-y-2.5 text-sm ${p.id === "pro" ? "text-ivory/85" : "text-muted"}`}>
                {ROWS.map((r) => (
                  <li key={r.label} className="flex items-center justify-between gap-2">
                    <span>{r.label}</span>
                    <span className="font-bold tabular-nums">{r.values(p)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register" className="mt-6">
                <Button className="w-full" variant={p.id === "pro" ? "primary" : "outline"}>
                  {p.price_monthly_sar === 0 ? "ابدأ مجانًا" : "اشترك الآن"} <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {[
            { t: "تجربة وترقية وهبوط", d: "غيّر باقتك في أي وقت؛ الحدود تُفرض فورًا على المناسبات والضيوف والمفوّضين." },
            { t: "فوترة واضحة", d: "فواتير شهرية/سنوية حسب وضع المنشأة القانوني، والضرائب تُراجع مع مختص قبل الإطلاق." },
            { t: "الدفع عبر مزود معتمد", d: "بيانات البطاقات لا تمر بخوادمنا؛ التكامل خلف واجهة قابلة للاستبدال مع webhook موقّع." },
          ].map((x) => (
            <div key={x.t} className="rounded-card border border-navy-950/8 bg-white p-5">
              <h3 className="mb-1.5 font-bold">{x.t}</h3>
              <p className="text-sm leading-7 text-muted">{x.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
