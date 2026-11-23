"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarHeart, LayoutDashboard, CalendarDays, CreditCard, Settings, LogOut, ChevronDown, ShieldCheck,
  Home, QrCode, BarChart3, LayoutGrid, Palette, Store,
} from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";

export interface SessionInfo {
  user: { id: string; name: string; email: string | null; phone?: string | null; is_platform_admin?: number };
  active_org: { id: string; name: string; kind: string; plan_id: string; role: string; is_vendor?: boolean };
  memberships: { id: string; name: string; kind: string; role: string }[];
}

const NAV = [
  { href: "/app", label: "لوحة التحكم", icon: LayoutDashboard, exact: true },
  { href: "/app/events", label: "المناسبات", icon: CalendarDays },
  { href: "/app/templates", label: "معرض القوالب", icon: Palette },
  { href: "/app/attendance", label: "الحضور", icon: QrCode },
  { href: "/app/statistics", label: "الإحصائيات", icon: BarChart3 },
  { href: "/app/billing", label: "الفوترة والباقات", icon: CreditCard, short: "الفوترة" },
  { href: "/app/settings", label: "الإعدادات والسجلات", icon: Settings, short: "الإعدادات" },
];

// شريط الجوال السفلي مطابق للواجهة المقدمة: الرئيسية / مناسباتي / الحضور / الإحصائيات / المزيد
const MOBILE_NAV = [
  { href: "/app", label: "الرئيسية", icon: Home, exact: true },
  { href: "/app/events", label: "مناسباتي", icon: CalendarDays },
  { href: "/app/attendance", label: "الحضور", icon: QrCode },
  { href: "/app/statistics", label: "الإحصائيات", icon: BarChart3 },
  { href: "/app/more", label: "المزيد", icon: LayoutGrid },
];

export function AppShell({ session, children }: { session: SessionInfo; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [orgMenu, setOrgMenu] = React.useState(false);

  const nav = React.useMemo(() => {
    // مساحة عمل المورد: بوابة المورد أولًا
    const base = session.active_org.is_vendor
      ? [{ href: "/app/vendor", label: "بوابة المورد", icon: Store, exact: false }, ...NAV]
      : NAV;
    return session.user.is_platform_admin === 1
      ? [...base, { href: "/app/admin", label: "مدير المنصة", short: "المنصة", icon: ShieldCheck, exact: false }]
      : base;
  }, [session.user.is_platform_admin, session.active_org.is_vendor]);

  async function switchOrg(orgId: string) {
    await api.post("/api/auth/switch-org", { org_id: orgId });
    setOrgMenu(false);
    router.refresh();
    window.location.href = "/app";
  }

  async function logout() {
    await api.post("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex min-h-screen">
      {/* الشريط الجانبي — سطح المكتب */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-navy-950 text-ivory lg:flex">
        <Link href="/app" className="flex justify-center py-5">
          <Brand size={38} tone="cream" />
        </Link>

        {/* مبدّل مساحة العمل */}
        <div className="relative px-4">
          <button
            onClick={() => setOrgMenu((v) => !v)}
            className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl bg-navy-900 px-3.5 py-3 text-right transition-colors hover:bg-navy-800"
            aria-expanded={orgMenu}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{session.active_org.name}</span>
              <span className="block text-[11px] text-ivory/50">
                {session.active_org.kind === "company" ? "مؤسسة" : "فرد"} · {session.active_org.role === "owner" ? "مالك" : session.active_org.role === "admin" ? "مشرف" : "عضو"}
              </span>
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-ivory/50 transition-transform", orgMenu && "rotate-180")} />
          </button>
          {orgMenu && (
            <div className="absolute inset-x-4 top-full z-30 mt-1 overflow-hidden rounded-xl border border-navy-700 bg-navy-900 shadow-xl animate-fade-in">
              {session.memberships.map((m) => (
                <button key={m.id} onClick={() => switchOrg(m.id)}
                  className={cn("block w-full cursor-pointer px-3.5 py-2.5 text-right text-sm transition-colors hover:bg-navy-800",
                    m.id === session.active_org.id ? "font-bold text-lime-400" : "text-ivory/80")}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="mt-5 flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200",
                isActive(n.href, n.exact) ? "bg-lime-400 text-navy-950" : "text-ivory/70 hover:bg-navy-900 hover:text-ivory"
              )}>
              <n.icon className="h-4.5 w-4.5" />
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-navy-800 p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-800 text-sm font-bold text-lime-400">
              {session.user.name?.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{session.user.name}</span>
              <span className="block truncate text-[11px] text-ivory/50" dir="ltr">{session.user.email ?? session.user.phone}</span>
            </span>
          </div>
          <Button variant="outline" size="sm" className="w-full border-navy-700 bg-transparent text-ivory/80 hover:bg-navy-900 hover:text-ivory" onClick={logout}>
            <LogOut className="h-4 w-4" /> خروج
          </Button>
        </div>
      </aside>

      {/* المحتوى */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ترويسة الجوال */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-navy-950/8 bg-ivory-soft/95 px-4 backdrop-blur lg:hidden">
          <Link href="/app"><Brand size={26} tone="brown" showLatin={false} /></Link>
          <div className="flex items-center gap-2">
            <select
              value={session.active_org.id}
              onChange={(e) => switchOrg(e.target.value)}
              className="max-w-36 cursor-pointer rounded-lg border border-navy-950/15 bg-white px-2 py-1.5 text-xs font-semibold"
              aria-label="مساحة العمل"
            >
              {session.memberships.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="خروج"><LogOut className="h-4.5 w-4.5" /></Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-8 lg:px-8 lg:pb-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>

        {/* تبويب سفلي — الجوال */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-navy-950/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="التنقل الرئيسي">
          {(session.active_org.is_vendor ? [{ href: "/app/vendor", label: "بوابتي", icon: Store, exact: false }, ...MOBILE_NAV.slice(1)] : MOBILE_NAV).map((n) => (
            <Link key={n.href} href={n.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition-colors",
                isActive(n.href, n.exact) ? "text-navy-950" : "text-muted"
              )}>
              <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", isActive(n.href, n.exact) && "bg-lime-100")}>
                <n.icon className="h-4.5 w-4.5" />
              </span>
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
