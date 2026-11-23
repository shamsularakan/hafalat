"use client";
import * as React from "react";
import Link from "next/link";
import { QrCode, ArrowLeft, Users, ShieldCheck } from "lucide-react";
import { api } from "@/lib/client";
import { formatNumber } from "@/lib/utils";
import { EVENT_STATUS_AR } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading, ErrorState, EmptyState } from "@/components/ui/feedback";

export default function AttendancePage() {
  const [events, setEvents] = React.useState<any[] | null>(null);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    api.get<any[]>("/api/events").then(async (list) => {
      setEvents(list);
      const pairs = await Promise.all(list.map(async (e) => {
        try {
          const a: any = await api.get(`/api/events/${e.id}/analytics`);
          return [e.id, a.data.totals.checked_in_cards] as const;
        } catch { return [e.id, 0] as const; }
      }));
      setCounts(Object.fromEntries(pairs));
    }).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorState message={error} />;
  return (
    <div className="space-y-5 animate-fade-up">
      <div className="rounded-card bg-navy-950 p-5 text-ivory">
        <p className="flex items-center gap-2 text-xs text-ivory/60"><QrCode className="h-4 w-4 text-gold-400" /> بوابة الحضور</p>
        <h1 className="mt-1 text-2xl font-extrabold">الحضور والاستقبال</h1>
        <p className="mt-1 text-sm text-ivory/70">اختر المناسبة لفتح الماسح وتسجيل الدخول فورًا.</p>
      </div>
      {!events ? <Loading /> : events.length === 0 ? <EmptyState title="لا مناسبات بعد" /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => (
            <Card key={e.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{e.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <Users className="h-3.5 w-3.5" /> {formatNumber(counts[e.id] ?? 0)} دخلوا · سعة {formatNumber(e.capacity)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={["published", "ongoing"].includes(e.status) ? "success" : "neutral"}>{EVENT_STATUS_AR[e.status as keyof typeof EVENT_STATUS_AR] ?? e.status}</Badge>
                <Link href={`/app/events/${e.id}/checkin`}><Button size="sm"><QrCode className="h-4 w-4" /> مسح</Button></Link>
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted"><ShieldCheck className="h-4 w-4" /> كل عملية دخول تُسجَّل بالموظف والبوابة والوقت — والرمز المستخدم لا يُقبل مرتين عند منع الإعادة.</p>
    </div>
  );
}
