"use client";
import * as React from "react";
import { Flag, Download, CheckCircle2, Printer } from "lucide-react";
import { EVENT_STATUS_AR } from "@/lib/types";
import { VendorRatings } from "@/components/planning-widgets";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { formatNumber, formatDateShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TH, TD, TR } from "@/components/ui/table";
import { Loading, ErrorState } from "@/components/ui/feedback";

export default function ClosingPage() {
  const { event } = useEvent();
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    Promise.all([
      api.get(`/api/events/${event.id}/finance/summary`),
      api.get(`/api/events/${event.id}/planning`),
      api.get(`/api/events/${event.id}/analytics`),
    ]).then(([f, p, a]) => setData({ f, p, a })).catch((e) => setError(e.message));
  }, [event.id]);
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;
  const { f, p, a } = data;
  const pr = p.progress;
  const taskPct = pr.tasks_total ? Math.round((pr.tasks_done / pr.tasks_total) * 100) : 0;
  const clPct = pr.checklist_total ? Math.round((pr.checklist_done / pr.checklist_total) * 100) : 0;
  const tlPct = pr.timeline_total ? Math.round((pr.timeline_done / pr.timeline_total) * 100) : 0;
  return (
    <div className="print-area space-y-5 animate-fade-up">
      <Card className="border-navy-950 bg-navy-950 text-ivory">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs text-ivory/60"><Flag className="h-4 w-4" /> تقرير إغلاق المناسبة</p>
            <h2 className="font-display mt-1 text-2xl font-bold">{event.title}</h2>
            <p className="mt-1 text-xs text-ivory/60">{formatDateShort(event.starts_at, event.timezone)} · الحالة: {EVENT_STATUS_AR[event.status as keyof typeof EVENT_STATUS_AR] ?? event.status}</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" className="border-ivory/30 bg-transparent text-ivory hover:bg-ivory/10" onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة / PDF</Button>
            <Button variant="outline" className="border-ivory/30 bg-transparent text-ivory hover:bg-ivory/10" onClick={() => window.open(`/api/events/${event.id}/export?kind=summary`, "_blank")}><Download className="h-4 w-4" /> تصدير ملخص الدعوات</Button>
            <Button variant="outline" className="border-ivory/30 bg-transparent text-ivory hover:bg-ivory/10" onClick={() => window.open(`/api/events/${event.id}/export?kind=checkins`, "_blank")}><Download className="h-4 w-4" /> تصدير الدخول</Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="إنجاز المهام" value={`${taskPct}%`} hint={`${pr.tasks_done}/${pr.tasks_total}`} tone="lime" />
        <Stat label="قوائم التجهيز" value={`${clPct}%`} tone="success" />
        <Stat label="الجدول الزمني" value={`${tlPct}%`} />
        <Stat label="نسبة الحضور" value={`${a.totals.issued ? Math.round((a.totals.checked_in_cards / a.totals.issued) * 100) : 0}%`} hint={`${a.totals.checked_in_cards} بطاقة`} tone="navy" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">الملخص المالي</CardTitle></CardHeader>
          <Table>
            <tbody>
              <Row k="الميزانية المعتمدة" v={`${formatNumber(f.budget)} ر.س`} />
              <Row k="المصروف الفعلي (مسدود)" v={`${formatNumber(f.spent_actual)} ر.س`} />
              <Row k="المبالغ المدفوعة نقدًا" v={`${formatNumber(f.paid_cash)} ر.س`} />
              <Row k="الالتزامات المستحقة" v={`${formatNumber(f.obligations)} ر.س`} />
              <Row k="المتبقي من الميزانية" v={`${formatNumber(f.remaining_actual)} ر.س`} strong />
              <Row k="تقدير ضيافة المؤكدين" v={`${formatNumber(f.hospitality.estimate)} ر.س`} />
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">الحضور والدعوات</CardTitle></CardHeader>
          <Table>
            <tbody>
              <Row k="دعوات صادرة" v={formatNumber(a.totals.issued)} />
              <Row k="مؤكد" v={formatNumber(a.totals.confirmed)} />
              <Row k="معتذر" v={formatNumber(a.totals.declined)} />
              <Row k="دخل فعليًا" v={formatNumber(a.totals.checked_in_cards)} />
              <Row k="حضور فعلي (أشخاص)" v={formatNumber(a.totals.actual_persons)} strong />
              <Row k="لم يحضر" v={formatNumber(a.totals.no_show)} />
            </tbody>
          </Table>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-success"><CheckCircle2 className="h-4 w-4" /> مطابقة سجلات RSVP: {a.consistency.ok ? "مطابقة" : "تحتاج مراجعة"}</p>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">مصروفات حسب الفئة</CardTitle></CardHeader>
        {f.categories.length === 0 ? <p className="text-sm text-muted">لا فئات مسجلة.</p> : (
          <Table>
            <thead><tr><TH>الفئة</TH><TH>المخطط</TH><TH>المحجوز</TH><TH>الفعلي</TH><TH>المتبقي</TH></tr></thead>
            <tbody>
              {f.categories.map((c: any) => (
                <TR key={c.id}>
                  <TD className="font-semibold">{c.name}</TD>
                  <TD className="tabular-nums">{formatNumber(c.planned_amount)}</TD>
                  <TD className="tabular-nums">{formatNumber(c.committed)}</TD>
                  <TD className="tabular-nums">{formatNumber(c.spent)}</TD>
                  <TD className="tabular-nums">{formatNumber(c.planned_amount - c.spent)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <ClosingExtras />
    </div>
  );
}

function ClosingExtras() {
  return <VendorRatings />;
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <tr className="border-b border-navy-950/6 last:border-0">
      <td className="px-4 py-2.5 text-sm text-muted">{k}</td>
      <td className={`px-4 py-2.5 text-left text-sm tabular-nums ${strong ? "font-extrabold text-navy-950" : "font-semibold"}`}>{v}</td>
    </tr>
  );
}
