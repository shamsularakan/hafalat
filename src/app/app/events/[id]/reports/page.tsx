"use client";
import * as React from "react";
import { BarChart3, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { formatNumber, formatDateShort, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TH, TD, TR } from "@/components/ui/table";
import { Loading, ErrorState } from "@/components/ui/feedback";

export default function ReportsPage() {
  const { event } = useEvent();
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");

  const load = React.useCallback(() => {
    api.get(`/api/events/${event.id}/analytics`).then(setData).catch((e) => setError(e.message));
  }, [event.id]);
  React.useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loading />;

  const t = data.totals;
  const maxDelegate = Math.max(1, ...data.per_delegate.map((d: any) => d.issued));

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><BarChart3 className="h-5 w-5 text-muted" /> التقارير والتحليلات</h2>
          <p className="text-sm text-muted">كل الأرقام مشتقة من سجلات الدعوات والردود والدخول الفعلية.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["summary", "guests", "invitations", "checkins"] as const).map((k) => (
            <Button key={k} variant="outline" size="sm" onClick={() => window.open(`/api/events/${event.id}/export?kind=${k}`, "_blank")}>
              <Download className="h-3.5 w-3.5" />
              {k === "summary" ? "الملخص" : k === "guests" ? "الضيوف" : k === "invitations" ? "الدعوات" : "الدخول"} CSV
            </Button>
          ))}
        </div>
      </div>

      {/* AC-12 مطابقة الأرقام */}
      <div className={cn("flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold", data.consistency.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
        {data.consistency.ok ? <CheckCircle2 className="h-4.5 w-4.5" /> : <AlertTriangle className="h-4.5 w-4.5" />}
        {data.consistency.ok
          ? "مطابقة: مؤكد + معتذر + منتظر + داخل + لم يحضر = إجمالي الدعوات الصادرة"
          : "تنبيه: عدم مطابقة بين الحالات والسجلات — راجع سجل التدقيق"}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="دعوات صادرة" value={formatNumber(t.issued)} tone="navy" hint={`ملغاة: ${formatNumber(t.cancelled)}`} />
        <Stat label="مؤكد" value={formatNumber(t.confirmed)} tone="success" />
        <Stat label="معتذر" value={formatNumber(t.declined)} tone="danger" />
        <Stat label="بانتظار الرد" value={formatNumber(t.pending)} />
        <Stat label="بطاقات دخلت" value={formatNumber(t.checked_in_cards)} tone="lime" />
        <Stat label="حضور فعلي (أشخاص)" value={formatNumber(t.actual_persons)} tone="lime" />
        <Stat label="لم يحضر" value={formatNumber(t.no_show)} />
        <Stat label="متبقي من السعة" value={formatNumber(t.capacity_remaining)} />
      </div>

      {/* الحصة */}
      <Card>
        <CardHeader><CardTitle>الحصة ({event.quota_unit === "card" ? "بطاقات" : "أشخاص"})</CardTitle></CardHeader>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-ivory-soft p-4"><p className="text-xl font-extrabold tabular-nums">{formatNumber(data.quota.allocated)}</p><p className="text-xs text-muted">المخصص</p></div>
          <div className="rounded-xl bg-ivory-soft p-4"><p className="text-xl font-extrabold tabular-nums">{formatNumber(data.quota.used)}</p><p className="text-xs text-muted">المستخدم</p></div>
          <div className="rounded-xl bg-lime-100 p-4"><p className="text-xl font-extrabold tabular-nums">{formatNumber(data.quota.remaining)}</p><p className="text-xs text-muted">المتبقي</p></div>
        </div>
      </Card>

      {/* لكل مفوّض */}
      {data.per_delegate.length > 0 && (
        <Card className="p-0">
          <CardHeader className="p-4 pb-2"><CardTitle>أداء المفوّضين</CardTitle></CardHeader>
          <Table>
            <thead><tr><TH>المفوّض</TH><TH>الحصة</TH><TH>صادر</TH><TH>مؤكد</TH><TH>معتذر</TH><TH>دخل</TH><TH>حضور فعلي</TH><TH>الاستهلاك</TH></tr></thead>
            <tbody>
              {data.per_delegate.map((d: any) => (
                <TR key={d.id}>
                  <TD className="font-semibold">{d.invitee_name}</TD>
                  <TD className="text-xs tabular-nums">{d.quota_used}/{d.quota_allocated}</TD>
                  <TD className="tabular-nums">{d.issued}</TD>
                  <TD className="tabular-nums text-success">{d.confirmed}</TD>
                  <TD className="tabular-nums text-danger">{d.declined}</TD>
                  <TD className="tabular-nums">{d.checked_in}</TD>
                  <TD className="font-bold tabular-nums">{d.actual_persons}</TD>
                  <TD className="w-32">
                    <div className="h-2 overflow-hidden rounded-full bg-navy-950/8">
                      <div className="h-full rounded-full bg-lime-400" style={{ width: `${Math.min(100, (d.issued / maxDelegate) * 100)}%` }} />
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <BreakdownCard title="حسب الفئة" rows={data.per_group.map((g: any) => ({ name: g.name ?? "بلا فئة", n: g.n, extra: `مؤكد ${g.confirmed ?? 0} · دخل ${g.checked_in ?? 0}` }))} />
        <BreakdownCard title="حسب قناة الإرسال" rows={data.per_channel.map((c: any) => ({ name: `${c.channel === "whatsapp_manual" ? "واتساب يدوي" : c.channel === "link_copy" ? "نسخ رابط" : c.channel} (${c.state === "manual_sent" ? "أرسل" : c.state})`, n: c.n }))} />
        <BreakdownCard title="حسب البوابة" rows={data.per_gate.map((g: any) => ({ name: g.name ?? "بلا بوابة", n: g.scans, extra: `${g.persons} شخص` }))} />
        <BreakdownCard title="الدخول حسب اليوم" rows={data.per_day.map((d: any) => ({ name: d.day, n: d.scans, extra: `${d.persons} شخص` }))} />
      </div>

      <p className="text-center text-xs text-muted">آخر تحديث: {formatDateShort(new Date().toISOString())} · التصدير يشمل النطاق الزمني الكامل للمناسبة.</p>
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: { name: string; n: number; extra?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      {rows.length === 0 ? <p className="text-sm text-muted">لا بيانات بعد.</p> : (
        <div className="space-y-2.5">
          {rows.map((r, i) => (
            <div key={i}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-semibold">{r.name}</span>
                <span className="tabular-nums text-muted">{formatNumber(r.n)}{r.extra ? ` · ${r.extra}` : ""}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-navy-950/8">
                <div className="h-full rounded-full bg-navy-950 transition-all duration-500" style={{ width: `${(r.n / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
