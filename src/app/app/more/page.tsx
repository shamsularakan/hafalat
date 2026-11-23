"use client";
import * as React from "react";
import Link from "next/link";
import { Settings, CreditCard, ShieldCheck, FileText, Users, Heart, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";

const ITEMS = [
  { href: "/app/settings", label: "الإعدادات والسجلات", desc: "مساحة العمل، الأعضاء، قوالب الرسائل، والتدقيق", icon: Settings },
  { href: "/app/billing", label: "الفوترة والباقات", desc: "الاشتراك الحالي، الفواتير، والترقية", icon: CreditCard },
  { href: "/app/admin", label: "لوحة مدير المنصة", desc: "الإشراف العام والباقات والقوالب (للمدير فقط)", icon: ShieldCheck },
  { href: "/app/events", label: "كل المناسبات", desc: "الدعوات، الضيوف، المفوّضون، والتقارير", icon: FileText },
  { href: "/app/events", label: "فريق التنظيم", desc: "الأدوار والصلاحيات لكل مناسبة", icon: Users },
  { href: "/", label: "عن ليلتنا", desc: "الصفحة التعريفية والأسعار", icon: Heart },
];

export default function MorePage() {
  return (
    <div className="space-y-5 animate-fade-up">
      <div className="rounded-card bg-navy-950 p-5 text-ivory">
        <h1 className="text-2xl font-extrabold">المزيد</h1>
        <p className="mt-1 text-sm text-ivory/70">كل أقسام المنصة في مكان واحد.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map((it) => (
          <Link key={it.href + it.label} href={it.href}>
            <Card className="flex items-center justify-between gap-3 transition-transform hover:-translate-y-0.5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-100 text-navy-950"><it.icon className="h-5 w-5" /></span>
                <div><p className="text-sm font-bold">{it.label}</p><p className="text-xs text-muted">{it.desc}</p></div>
              </div>
              <ArrowLeft className="h-4 w-4 shrink-0 text-muted" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
