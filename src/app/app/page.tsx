"use client";
import * as React from "react";
import Link from "next/link";
import { CalendarDays, Plus, Users, QrCode, ArrowLeft, Sparkles, Mail, HandHeart } from "lucide-react";
import { api } from "@/lib/client";
import { formatDateShort, statusTone } from "@/lib/utils";
import { EVENT_STATUS_AR, INVITATION_STATUS_AR } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading, ErrorState, EmptyState } from "@/components/ui/feedback";

export default function DashboardPage() {
  const [events, setEvents] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState("");
  const [mine, setMine] = React.useState<{ inv: any; help: any } | null>(null);

  const load = React.useCallback(() => {
    api.get<any[]>("/api/events").then(setEvents).catch((e) => setError(e.message));
    Promise.all([api.get<any>("/api/me/invitations"), api.get<any>("/api/me/helping")])
      .then(([inv, help]) => setMine({ inv, help })).catch(() => {});
  }, []);
  React.useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!events) return <Loading />;

  const active = events.filter((e) => ["draft", "ready", "published", "ongoing"].includes(e.status));
  const upcoming = events
    .filter((e) => e.starts_at && new Date(e.starts_at) > new Date() && e.status !== "cancelled")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">لوحة التحكم</h1>
          <p className="mt-1 text-sm text-muted">نظرة عامة على مناسباتك ونشاطها.</p>
        </div>
        <Link href="/app/events?new=1"><Button><Plus className="h-4.5 w-4.5" /> مناسبة جديدة</Button></Link>
      </div>

      {mine && (mine.inv.invitations.length + mine.inv.pending_count + mine.help.helping.length + mine.help.pending_count) > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/app/invitations"><Card className="flex items-center gap-3 transition-transform hover:-translate-y-0.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-100"><Mail className="h-5 w-5" /></span>
            <div><p className="font-bold">دعواتي</p><p className="text-xs text-muted">{mine.inv.verified ? `${mine.inv.invitations.filter((i: any) => i.upcoming).length} دعوة قادمة` : `${mine.inv.pending_count} على رقمك — أكّد رقمك لعرضها`}</p></div>
          </Card></Link>
          <Link href="/app/helping"><Card className="flex items-center gap-3 transition-transform hover:-translate-y-0.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-100"><HandHeart className="h-5 w-5" /></span>
            <div><p className="font-bold">فزعاتي</p><p className="text-xs text-muted">{mine.help.verified ? `${mine.help.helping.length} فزعة` : `${mine.help.pending_count} على رقمك — أكّد رقمك لعرضها`}</p></div>
          </Card></Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="مناسبات نشطة" value={active.length} tone="navy" />
        <Stat label="إجمالي المناسبات" value={events.length} />
        <Stat label="أقرب مناسبة" value={upcoming ? formatDateShort(upcoming.starts_at, upcoming.timezone).split("،")[0] : "—"} hint={upcoming?.title} tone="lime" />
      </div>

      {upcoming && (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-lime-400/60 bg-lime-100/50">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-950 text-lime-400"><Sparkles className="h-5.5 w-5.5" /></span>
            <div>
              <p className="font-bold">{upcoming.title}</p>
              <p className="text-sm text-muted">{formatDateShort(upcoming.starts_at, upcoming.timezone)} · {upcoming.venue_name ?? "الموقع يحدد لاحقًا"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/app/events/${upcoming.id}/checkin`}><Button variant="dark" size="sm"><QrCode className="h-4 w-4" /> الاستقبال</Button></Link>
            <Link href={`/app/events/${upcoming.id}`}><Button variant="outline" size="sm">إدارة <ArrowLeft className="h-4 w-4" /></Button></Link>
          </div>
        </Card>
      )}

      <div>
        <h2 className="mb-3 flex items-center gap-2 font-bold"><CalendarDays className="h-4.5 w-4.5 text-muted" /> أحدث المناسبات</h2>
        {events.length === 0 ? (
          <EmptyState
            title="ما عندك مناسبات بعد"
            hint="أنشئ أول مناسبة وابدأ بتجهيز الدعوة المتحركة وتوزيع الحصص."
            action={<Link href="/app/events?new=1"><Button><Plus className="h-4 w-4" /> إنشاء مناسبة</Button></Link>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {events.slice(0, 6).map((e) => (
              <Link key={e.id} href={`/app/events/${e.id}`} className="group block min-w-0">
                <Card className="flex items-center justify-between gap-3 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{e.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <Users className="h-3.5 w-3.5" /> سعة {e.capacity} · {formatDateShort(e.starts_at, e.timezone)}
                    </p>
                  </div>
                  <Badge tone={statusTone(e.status)}>{EVENT_STATUS_AR[e.status as keyof typeof EVENT_STATUS_AR] ?? e.status}</Badge>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
