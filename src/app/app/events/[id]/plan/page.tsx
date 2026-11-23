"use client";
import * as React from "react";
import Link from "next/link";
import { ClipboardList, CalendarDays, CheckCircle2, ListChecks, Clock, Wallet, Users, PackageCheck, Check } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { AlertsCard } from "@/components/planning-widgets";
import { formatNumber, formatDateShort, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Loading, ErrorState, useToast } from "@/components/ui/feedback";

function Countdown({ target }: { target: string | null }) {
  const [left, setLeft] = React.useState(() => (target ? Date.parse(target) - Date.now() : 0));
  React.useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setLeft(Math.max(0, Date.parse(target) - Date.now())), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!target) return <p className="text-sm text-muted">لم يُحدد موعد المناسبة بعد.</p>;
  if (left <= 0) return <p className="text-lg font-extrabold text-lime-400">حانت اللحظة — بالتوفيق!</p>;
  const cells = [
    { v: Math.floor(left / 864e5), l: "يوم" },
    { v: Math.floor((left % 864e5) / 3600e3), l: "ساعة" },
    { v: Math.floor((left % 3600e3) / 60e3), l: "دقيقة" },
    { v: Math.floor((left % 60e3) / 1000), l: "ثانية" },
  ];
  return (
    <div className="flex flex-wrap gap-3">
      {cells.map((c) => (
        <div key={c.l} className="min-w-16 rounded-xl bg-navy-950/5 px-3 py-2 text-center">
          <p className="text-2xl font-extrabold tabular-nums">{String(c.v).padStart(2, "0")}</p>
          <p className="text-[11px] text-muted">{c.l}</p>
        </div>
      ))}
    </div>
  );
}

/** المراحل الست: الثلاث الأولى تُحسم فيها التكلفة، والثلاث الأخيرة جودة التنفيذ */
function Phases({ phases }: { phases: { key: string; title: string; hint: string; state: "done" | "current" | "next" }[] }) {
  const { event } = useEvent();
  const current = phases.find((p) => p.state === "current");
  return (
    <Card>
      <CardHeader className="flex-wrap">
        <CardTitle className="text-sm">مراحل المناسبة</CardTitle>
        <Link href={`/app/events/${event.id}/supplies`}><Button variant="outline" size="sm"><PackageCheck className="h-4 w-4" /> قائمتي والكميات</Button></Link>
      </CardHeader>
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="مراحل المناسبة">
        {phases.map((p, i) => (
          <li key={p.key} aria-current={p.state === "current" ? "step" : undefined}
            className={cn("rounded-xl border p-2.5 text-center",
              p.state === "current" ? "border-lime-500 bg-lime-100" : p.state === "done" ? "border-success/25 bg-success/5" : "border-navy-950/8 bg-white")}>
            <span className={cn("mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold",
              p.state === "current" ? "bg-navy-950 text-lime-400" : p.state === "done" ? "bg-success text-white" : "bg-navy-950/8 text-muted")}>
              {p.state === "done" ? <Check className="h-3.5 w-3.5" /> : formatNumber(i + 1)}
            </span>
            <span className={cn("block text-xs font-bold leading-5", p.state === "next" && "text-muted")}>{p.title}</span>
          </li>
        ))}
      </ol>
      {current && <p className="mt-3 text-sm text-muted"><b className="text-navy-950">المرحلة الحالية — {current.title}:</b> {current.hint}.</p>}
    </Card>
  );
}

function Progress({ label, done, total, icon: Icon }: { label: string; done: number; total: number; icon: any }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold"><Icon className="h-4 w-4 text-muted" /> {label}</div>
        <Badge tone={pct === 100 ? "success" : "lime"}>{pct}%</Badge>
      </div>
      <p className="mt-2 text-xs text-muted">{done} من {total} مكتمل</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy-950/8">
        <div className="h-full rounded-full bg-lime-400 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </Card>
  );
}

export default function PlanPage() {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [data, setData] = React.useState<any>(null);
  const [finance, setFinance] = React.useState<any>(null);
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [settings, setSettings] = React.useState(false);
  const [apply, setApply] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(() => {
    api.get(`/api/events/${event.id}/planning`).then(setData).catch((e) => setError(e.message));
    api.get(`/api/events/${event.id}/finance/summary`).then(setFinance).catch(() => {});
    api.get<any[]>("/api/planning-templates").then(setTemplates).catch(() => {});
  }, [event.id]);
  React.useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loading />;
  const p = data.progress;

  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      <Card className="overflow-hidden border-lime-400/50 bg-navy-950 text-ivory">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="mb-1 text-xs text-ivory/60">العد التنازلي لمناسبتك</p>
            <h2 className="font-display mb-4 text-2xl font-bold">{event.title}</h2>
            <Countdown target={data.event.starts_at} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-ivory/30 bg-transparent text-ivory hover:bg-ivory/10" onClick={() => setSettings(true)}>إعدادات الخطة</Button>
            <Button onClick={() => setApply(true)}><ClipboardList className="h-4 w-4" /> تطبيق قالب تخطيط</Button>
          </div>
        </div>
      </Card>

      {data.phases && <Phases phases={data.phases} />}
      <AlertsCard />

      <div className="grid gap-3 sm:grid-cols-3">
        <Progress label="المهام" done={p.tasks_done} total={p.tasks_total} icon={CheckCircle2} />
        <Progress label="قوائم التجهيز" done={p.checklist_done} total={p.checklist_total} icon={ListChecks} />
        <Progress label="الجدول الزمني" done={p.timeline_done} total={p.timeline_total} icon={CalendarDays} />
      </div>

      {finance && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="الميزانية المعتمدة" value={formatNumber(finance.budget)} hint="ر.س" tone="navy" />
          <Stat label="المصروف الفعلي" value={formatNumber(finance.spent_actual)} hint="ر.س" tone="danger" />
          <Stat label="المتبقي" value={formatNumber(finance.remaining_actual)} hint="ر.س" tone="lime" />
          <Stat label="نسبة الاستهلاك" value={`${finance.usage_percent}%`} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-0">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">المهام القادمة</CardTitle>
            <Link href={`/app/events/${event.id}/tasks`}><Button variant="ghost" size="sm">كل المهام</Button></Link>
          </CardHeader>
          {data.upcoming_tasks.length === 0 ? <p className="p-5 text-sm text-muted">لا مهام مفتوحة — أضف مهام من صفحة المهام.</p> : (
            <div className="divide-y divide-navy-950/6">
              {data.upcoming_tasks.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-bold">{t.title}</p><p className="text-xs text-muted">{t.category ?? "عام"}</p></div>
                  <div className="flex shrink-0 items-center gap-2">
                    {t.due_date && <span className="text-xs text-muted">{formatDateShort(t.due_date)}</span>}
                    <Badge tone={t.priority === "high" ? "danger" : "neutral"}>{t.priority === "high" ? "عالية" : t.priority === "low" ? "منخفضة" : "متوسطة"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4" /> فريق التخطيط</CardTitle>
            <Link href={`/app/events/${event.id}/team`}><Button variant="ghost" size="sm">إدارة</Button></Link>
          </CardHeader>
          <div className="space-y-2">
            {data.team.length === 0 ? <p className="text-sm text-muted">لم يُضف أعضاء فريق التخطيط بعد.</p> : data.team.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl bg-ivory-soft px-3 py-2 text-sm">
                <span className="font-bold">{m.name}</span>
                <Badge tone="navy">{m.role === "planner" ? "مدير تخطيط" : m.role === "finance" ? "مسؤول مالي" : "منسق خدمات"}</Badge>
              </div>
            ))}
          </div>
          {finance && <p className="mt-4 flex items-center gap-1.5 text-xs text-muted"><Wallet className="h-3.5 w-3.5" /> تقدير ضيافة المؤكدين: {formatNumber(finance.hospitality.confirmed_persons)} أشخاص × {formatNumber(finance.hospitality.cost_per_person)} = {formatNumber(finance.hospitality.estimate)} ر.س</p>}
        </Card>
      </div>

      {settings && <SettingsDialog data={data.plan} onClose={() => setSettings(false)} onSaved={() => { setSettings(false); show("تم حفظ إعدادات الخطة"); load(); }} />}
      {apply && <ApplyDialog templates={templates} onClose={() => setApply(false)} onDone={() => { setApply(false); show("تم تطبيق قالب التخطيط"); load(); }} />}
    </div>
  );
}

function SettingsDialog({ data, onClose, onSaved }: { data: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState({
    budget_total: data.budget_total ?? 0,
    hospitality_cost_per_person: data.hospitality_cost_per_person ?? 0,
    notes: data.notes ?? "",
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const { event } = useEvent();
  async function save() {
    setBusy(true); setError("");
    try { await api.patch(`/api/events/${event.id}/planning`, form); onSaved(); }
    catch (e: any) { setError(e.message); setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title="إعدادات خطة المناسبة">
      <div className="space-y-4">
        <Field label="الميزانية المعتمدة (ر.س)"><Input type="number" min={0} value={form.budget_total} onChange={(e) => setForm({ ...form, budget_total: e.target.value })} /></Field>
        <Field label="تكلفة الضيافة للشخص (ر.س)" hint="تُستخدم لتقدير ضيافة المؤكدين تلقائيًا"><Input type="number" min={0} value={form.hospitality_cost_per_person} onChange={(e) => setForm({ ...form, hospitality_cost_per_person: e.target.value })} /></Field>
        <Field label="ملاحظات"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={save} loading={busy}>حفظ</Button></div>
      </div>
    </Dialog>
  );
}

function ApplyDialog({ templates, onClose, onDone }: { templates: any[]; onClose: () => void; onDone: () => void }) {
  const { event } = useEvent();
  const [id, setId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  async function apply() {
    setBusy(true); setError("");
    try { await api.post(`/api/events/${event.id}/planning`, { template_id: id || undefined }); onDone(); }
    catch (e: any) { setError(e.message); setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title="تطبيق قالب تخطيط جاهز">
      <div className="space-y-4">
        <p className="rounded-xl bg-brand-orange/5 p-3 text-xs leading-6 text-muted">سيُعاد بناء المهام وفئات الميزانية وقوائم التجهيز والجدول الزمني من القالب المختار. أي تعديلات يدوية على هذه القوائم ستُستبدل.</p>
        <Field label="القالب">
          <select value={id} onChange={(e) => setId(e.target.value)} className="w-full rounded-xl border border-navy-950/15 bg-white px-3 py-2.5 text-sm">
            <option value="">قالب نوع المناسبة تلقائيًا</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
          </select>
        </Field>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={apply} loading={busy}>تطبيق</Button></div>
      </div>
    </Dialog>
  );
}
