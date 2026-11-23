"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Users, CalendarDays, Copy } from "lucide-react";
import { api } from "@/lib/client";
import { formatDateShort, statusTone } from "@/lib/utils";
import { EVENT_STATUS_AR, EVENT_TYPES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading, ErrorState, EmptyState, useToast } from "@/components/ui/feedback";
import { EventWizard } from "@/components/event-wizard";

export default function EventsPage() {
  return <React.Suspense fallback={<Loading />}><EventsInner /></React.Suspense>;
}

function EventsInner() {
  const params = useSearchParams();
  const [events, setEvents] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState("");
  const [wizard, setWizard] = React.useState(params.get("new") === "1");
  const { show, node } = useToast();

  const load = React.useCallback(() => {
    api.get<any[]>("/api/events").then(setEvents).catch((e) => setError(e.message));
  }, []);
  React.useEffect(load, [load]);

  async function clone(id: string) {
    try {
      await api.post(`/api/events/${id}/clone`);
      show("تم نسخ المناسبة كمسودة");
      load();
    } catch (e: any) { show(e.message, "error"); }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">المناسبات</h1>
          <p className="mt-1 text-sm text-muted">كل مناسبات مساحة العمل الحالية.</p>
        </div>
        <Button onClick={() => setWizard(true)}><Plus className="h-4.5 w-4.5" /> مناسبة جديدة</Button>
      </div>

      {!events ? <Loading /> : events.length === 0 ? (
        <EmptyState title="لا توجد مناسبات" hint="ابدأ بإنشاء مناسبة — المعالج يحفظ مسودتك تلقائيًا."
          action={<Button onClick={() => setWizard(true)}><Plus className="h-4 w-4" /> إنشاء مناسبة</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => (
            <Card key={e.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/app/events/${e.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold hover:underline decoration-lime-400 decoration-2 underline-offset-4">{e.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {EVENT_TYPES.find((t) => t.id === e.type)?.ar ?? e.type} · {formatDateShort(e.starts_at, e.timezone)}
                  </p>
                </Link>
                <Badge tone={statusTone(e.status)}>{EVENT_STATUS_AR[e.status as keyof typeof EVENT_STATUS_AR] ?? e.status}</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-y-2 border-t border-navy-950/6 pt-3 text-xs text-muted">
                <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> سعة {e.capacity} ({e.quota_unit === "card" ? "بطاقة" : "شخص"})</span>
                <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {e.venue_name ?? (e.is_virtual ? "افتراضية" : "—")}</span>
                <Button variant="ghost" size="sm" onClick={() => clone(e.id)} aria-label="نسخ المناسبة"><Copy className="h-3.5 w-3.5" /> نسخ</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <EventWizard open={wizard} onClose={() => setWizard(false)} />
    </div>
  );
}
