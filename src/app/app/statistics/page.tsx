"use client";
import * as React from "react";
import Link from "next/link";
import { BarChart3, ArrowLeft } from "lucide-react";
import { api } from "@/lib/client";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, Stat } from "@/components/ui/card";
import { Loading, ErrorState } from "@/components/ui/feedback";

export default function StatisticsPage() {
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    api.get<any[]>("/api/events").then(async (events) => {
      const data = await Promise.all(events.map(async (e) => {
        try { const a: any = await api.get(`/api/events/${e.id}/analytics`); return { event: e, a: a.data }; }
        catch { return { event: e, a: null }; }
      }));
      setRows(data);
    }).catch((e) => setError(e.message));
  }, []);
  const total = (key: string) => rows?.reduce((s, r) => s + (r.a?.totals?.[key] ?? 0), 0) ?? 0;

  if (error) return <ErrorState message={error} />;
  return (
    <div className="space-y-5 animate-fade-up">
      <div className="rounded-card bg-forest-500 p-5 text-cream-50">
        <p className="flex items-center gap-2 text-xs text-cream-100/70"><BarChart3 className="h-4 w-4" /> نظرة شاملة</p>
        <h1 className="mt-1 text-2xl font-extrabold">الإحصائيات</h1>
      </div>
      {!rows ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="دعوات صادرة" value={formatNumber(total("issued"))} tone="navy" />
            <Stat label="مؤكد" value={formatNumber(total("confirmed"))} tone="success" />
            <Stat label="معتذر" value={formatNumber(total("declined"))} tone="danger" />
            <Stat label="حضور فعلي" value={formatNumber(total("actual_persons"))} tone="lime" />
          </div>
          <Card className="p-0">
            <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">حسب المناسبة</CardTitle></CardHeader>
            <div className="divide-y divide-navy-950/6">
              {rows.map(({ event, a }) => (
                <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-bold">{event.title}</p><p className="text-xs text-muted">{a?.totals?.issued ?? 0} دعوة · {a?.totals?.actual_persons ?? 0} حاضر</p></div>
                  <Link href={`/app/events/${event.id}/reports`}><Button variant="outline" size="sm">التفاصيل <ArrowLeft className="h-3.5 w-3.5" /></Button></Link>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
