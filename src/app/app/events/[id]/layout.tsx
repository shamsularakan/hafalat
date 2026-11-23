"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, UserCheck, Palette, Send, QrCode, BarChart3, Shield,
  ClipboardList, Wallet, ReceiptText, ListTodo, Truck, CalendarClock, Flag, LayoutGrid, PackageCheck, DoorOpen,
} from "lucide-react";
import { EventProvider, useEvent } from "@/components/event-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { statusTone, formatDateShort, cn } from "@/lib/utils";
import { EVENT_STATUS_AR } from "@/lib/types";

const ROLES_ALL = ["owner", "manager", "supervisor", "delegate", "receptionist", "designer"];

type Tab = { seg: string; label: string; icon: any; roles: string[] };

const TABS: Tab[] = [
  { seg: "", label: "نظرة عامة", icon: LayoutDashboard, roles: ROLES_ALL },
  { seg: "plan", label: "مركز التخطيط", icon: ClipboardList, roles: ROLES_ALL },
  { seg: "supplies", label: "قائمتي والكميات", icon: PackageCheck, roles: ROLES_ALL },
  { seg: "budget", label: "الميزانية", icon: Wallet, roles: ROLES_ALL },
  { seg: "payments", label: "المدفوعات", icon: ReceiptText, roles: ROLES_ALL },
  { seg: "tasks", label: "المهام", icon: ListTodo, roles: ROLES_ALL },
  { seg: "vendors", label: "الموردون والمرفقات", icon: Truck, roles: ROLES_ALL },
  { seg: "timeline", label: "الجدول الزمني", icon: CalendarClock, roles: ROLES_ALL },
  { seg: "team", label: "فريق التنظيم", icon: Shield, roles: ROLES_ALL },
  { seg: "closing", label: "تقرير الإغلاق", icon: Flag, roles: ROLES_ALL },
  { seg: "guests", label: "الضيوف", icon: Users, roles: ["owner", "manager", "supervisor", "delegate"] },
  { seg: "delegates", label: "المفوّضون", icon: UserCheck, roles: ["owner", "manager", "supervisor", "delegate"] },
  { seg: "design", label: "تصميم الدعوة", icon: Palette, roles: ["owner", "manager", "designer"] },
  { seg: "send", label: "الإرسال", icon: Send, roles: ["owner", "manager", "supervisor", "delegate"] },
  { seg: "checkin", label: "الاستقبال", icon: QrCode, roles: ["owner", "manager", "supervisor", "receptionist"] },
  { seg: "reports", label: "تقارير الدعوات", icon: BarChart3, roles: ["owner", "manager", "supervisor", "delegate"] },
  { seg: "staff", label: "الطاقم والبوابات", icon: DoorOpen, roles: ["owner", "manager"] },
];

const GROUPS = [
  { title: "التخطيط والمتابعة", segs: ["", "plan", "supplies", "budget", "payments", "tasks", "timeline", "closing"] },
  { title: "الموردون والفريق", segs: ["vendors", "team", "staff"] },
  { title: "الدعوات والضيوف", segs: ["guests", "delegates", "design", "send", "checkin", "reports"] },
];

const QUICK = ["plan", "supplies", "budget", "tasks"];

function EventHeader() {
  const { event, role } = useEvent();
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = React.useState(false);
  const base = `/app/events/${event.id}`;
  const visible = TABS.filter((t) => t.roles.includes(role));
  const bySeg = (seg: string) => visible.find((t) => t.seg === seg);
  const hrefOf = (seg: string) => (seg ? `${base}/${seg}` : base);
  const isActive = (seg: string) => (seg ? pathname.startsWith(hrefOf(seg)) : pathname === base);
  const current = visible.find((t) => isActive(t.seg)) ?? visible[0];
  const CurrentIcon = current?.icon ?? LayoutDashboard;

  function go(seg: string) {
    setMenu(false);
    router.push(hrefOf(seg));
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <Link href="/app/events" className="hover:text-navy-950">المناسبات</Link>
            <span>/</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold">{event.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatDateShort(event.starts_at, event.timezone)}
            {event.venue_name ? ` · ${event.venue_name}` : ""}
            {` · دورك: ${role === "owner" ? "مالك" : role === "manager" ? "مدير" : role === "supervisor" ? "مشرف" : role === "delegate" ? "مفوّض" : role === "receptionist" ? "استقبال" : "مصمم"}`}
          </p>
        </div>
        <Badge tone={statusTone(event.status)} className="mt-1 text-sm">
          {EVENT_STATUS_AR[event.status as keyof typeof EVENT_STATUS_AR] ?? event.status}
        </Badge>
      </div>

      {/* سطح المكتب: شريط أفقي كامل */}
      <nav className="hidden gap-1 overflow-x-auto rounded-xl bg-navy-950/5 p-1 lg:flex" aria-label="أقسام المناسبة">
        {visible.map((t) => {
          const active = isActive(t.seg);
          return (
            <Link key={t.seg} href={hrefOf(t.seg)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-all duration-200 sm:text-sm",
                active ? "bg-white text-navy-950 shadow-sm" : "text-muted hover:text-navy-950"
              )}>
              <t.icon className="h-4 w-4" /> {t.label}
            </Link>
          );
        })}
      </nav>

      {/* الجوال: القسم الحالي + اختصارات + قائمة مرتبة بكل الأقسام */}
      <div className="space-y-2 lg:hidden">
        <div className="flex items-center justify-between gap-3 rounded-card border border-navy-950/8 bg-white p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-navy-950">
              <CurrentIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-muted">القسم الحالي</p>
              <p className="truncate font-bold">{current?.label}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setMenu(true)} className="shrink-0">
            <LayoutGrid className="h-4 w-4" /> كل الأقسام
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {QUICK.map((seg) => {
            const t = bySeg(seg);
            if (!t) return <span key={seg} />;
            const active = isActive(seg);
            return (
              <Link key={seg} href={hrefOf(seg)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-center text-[10px] font-bold transition-all",
                  active ? "border-lime-400 bg-lime-100 text-navy-950" : "border-navy-950/8 bg-white text-muted"
                )}>
                <t.icon className="h-4.5 w-4.5" />
                <span className="leading-tight">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <Dialog open={menu} onClose={() => setMenu(false)} title="كل أقسام المناسبة" wide>
        <div className="space-y-5">
          {GROUPS.map((g) => {
            const items = g.segs.map(bySeg).filter(Boolean) as Tab[];
            if (items.length === 0) return null;
            return (
              <div key={g.title}>
                <p className="mb-2 text-xs font-extrabold text-muted">{g.title}</p>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((t) => {
                    const active = isActive(t.seg);
                    return (
                      <button key={t.seg} onClick={() => go(t.seg)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-right text-sm font-bold transition-all active:scale-[0.98]",
                          active ? "border-lime-500 bg-lime-100 text-navy-950" : "border-navy-950/8 bg-white hover:border-lime-400"
                        )}>
                        <t.icon className="h-4.5 w-4.5 shrink-0 text-gold-500" />
                        <span className="truncate">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Dialog>
    </div>
  );
}

export default function EventLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  return (
    <EventProvider eventId={params.id}>
      <EventHeader />
      {children}
    </EventProvider>
  );
}
