"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Send, Flag, Archive, Copy, Pencil, Ban, Eye } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { formatDateShort, formatNumber, statusTone, toLocalDatetimeInput } from "@/lib/utils";
import { EVENT_STATUS_AR } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Switch } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, useToast, Loading } from "@/components/ui/feedback";
import { formatDualDate } from "@/lib/dates";

const NEXT_STATUS: Record<string, { to: string; label: string; icon: any; variant?: any }[]> = {
  draft: [{ to: "ready", label: "جاهزة", icon: Flag }],
  ready: [{ to: "published", label: "نشر وقبول الردود", icon: Send }],
  published: [{ to: "ongoing", label: "بدء المناسبة", icon: Play }],
  ongoing: [{ to: "ended", label: "إنهاء المناسبة", icon: Flag }],
  ended: [{ to: "archived", label: "أرشفة", icon: Archive }],
  cancelled: [{ to: "archived", label: "أرشفة", icon: Archive }],
};

export default function EventOverviewPage() {
  const { event, role, refresh } = useEvent();
  const router = useRouter();
  const { show, node } = useToast();
  const [analytics, setAnalytics] = React.useState<any>(null);
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const canManage = role === "owner" || role === "manager";

  React.useEffect(() => {
    api.get(`/api/events/${event.id}/analytics`).then(setAnalytics).catch(() => {});
  }, [event.id, event.status]);

  async function transition(to: string) {
    setBusy(true);
    try {
      await api.post(`/api/events/${event.id}/status`, { status: to });
      show(`تم الانتقال إلى «${EVENT_STATUS_AR[to as keyof typeof EVENT_STATUS_AR]}»`);
      await refresh();
    } catch (e: any) { show(e.message, "error"); }
    setBusy(false);
  }

  async function clone() {
    setBusy(true);
    try {
      const ev = await api.post<any>(`/api/events/${event.id}/clone`);
      router.push(`/app/events/${ev.id}`);
    } catch (e: any) { show(e.message, "error"); setBusy(false); }
  }

  const dual = formatDualDate(event.starts_at, event.timezone);
  const actions = NEXT_STATUS[event.status] ?? [];

  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      {/* إجراءات الحالة */}
      {canManage && (actions.length > 0 || ["draft", "ready", "published"].includes(event.status)) && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">دورة حياة المناسبة</p>
            <p className="mt-0.5 text-xs text-muted">مسودة → جاهزة → منشورة → جارية → منتهية → مؤرشفة</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <Button key={a.to} onClick={() => transition(a.to)} loading={busy} variant={a.to === "published" ? "primary" : "dark"} size="sm">
                <a.icon className="h-4 w-4" /> {a.label}
              </Button>
            ))}
            {["draft", "ready", "published"].includes(event.status) && (
              <Button variant="danger" size="sm" loading={busy} onClick={() => transition("cancelled")}>
                <Ban className="h-4 w-4" /> إلغاء المناسبة
              </Button>
            )}
            <Button variant="outline" size="sm" loading={busy} onClick={clone}><Copy className="h-4 w-4" /> نسخ</Button>
          </div>
        </Card>
      )}

      {/* إحصاءات سريعة */}
      {analytics ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="دعوات صادرة" value={formatNumber(analytics.totals.issued)} tone="navy" />
          <Stat label="مؤكد" value={formatNumber(analytics.totals.confirmed)} tone="success" />
          <Stat label="معتذر" value={formatNumber(analytics.totals.declined)} tone="danger" />
          <Stat label="حضور فعلي" value={formatNumber(analytics.totals.actual_persons)} hint={`السعة المتبقية ${formatNumber(analytics.totals.capacity_remaining)}`} tone="lime" />
        </div>
      ) : <Loading label="جارٍ تحميل الإحصاءات…" />}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* التفاصيل */}
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل المناسبة</CardTitle>
            {canManage && (
              <div className="flex flex-wrap gap-1.5">
                <Link href={`/app/events/${event.id}/design?gallery=1`}><Button variant="outline" size="sm"><Eye className="h-3.5 w-3.5" /> معاينة قوالب الدعوات</Button></Link>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> تعديل</Button>
              </div>
            )}
          </CardHeader>
          <dl className="space-y-3 text-sm">
            <Row k="صاحب المناسبة" v={event.host_name ?? "—"} />
            <Row k="التاريخ الهجري" v={dual?.hijri ?? "—"} />
            <Row k="التاريخ الميلادي" v={dual ? `${dual.gregorian} · ${dual.time}` : "—"} />
            <Row k="المنطقة الزمنية" v={event.timezone} />
            <Row k="المكان" v={event.is_virtual ? "افتراضية" : [event.venue_name, event.venue_address].filter(Boolean).join(" — ") || "—"} />
            {event.map_url && <Row k="الخرائط" v={<a className="text-navy-950 underline decoration-lime-400 decoration-2 underline-offset-4" href={event.map_url} target="_blank" rel="noreferrer">فتح الاتجاهات</a>} />}
            <Row k="السعة" v={`${formatNumber(event.capacity)} ${event.quota_unit === "card" ? "بطاقة" : "شخص"} ${event.unit_locked ? "(مقفلة)" : ""}`} />
            <Row k="إعادة الحصة عند الإلغاء" v={event.cancel_returns_quota ? "نعم" : "لا — تبقى مستهلكة"} />
            <Row k="إعادة الدخول" v={event.allow_reentry ? "مسموحة" : "ممنوعة"} />
            <Row k="إغلاق الردود" v={event.rsvp_deadline ? formatDateShort(event.rsvp_deadline, event.timezone) : "مفتوح حتى نهاية المناسبة"} />
          </dl>
        </Card>

        {/* حالة النشر */}
        <Card>
          <CardHeader><CardTitle>جاهزية النشر</CardTitle></CardHeader>
          <ul className="space-y-2.5 text-sm">
            <Check ok={!!event.title} label="اسم المناسبة مكتمل" />
            <Check ok={!!event.starts_at} label="تاريخ المناسبة محدد" />
            <Check ok={event.capacity > 0} label="السعة مضبوطة" />
            <Check ok={analytics?.totals.issued > 0} label="صدرت دعوة واحدة على الأقل" />
            <Check ok={event.status === "published" || event.status === "ongoing"} label="المناسبة منشورة وتقبل الردود" />
          </ul>
          {event.status === "draft" && (
            <p className="mt-4 rounded-xl bg-lime-100 p-3 text-xs leading-6 text-navy-950">
              أكمل التفاصيل ثم انتقل إلى «جاهزة» فـ«نشر». صمّم الدعوة من تبويب التصميم قبل الإرسال لتظهر بشكلها النهائي للضيوف.
            </p>
          )}
        </Card>
      </div>

      {editing && <EditDialog onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await refresh(); show("تم حفظ التعديلات"); }} />}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-navy-950/5 pb-2.5 last:border-0">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className="text-left font-semibold">{v}</dd>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${ok ? "bg-success text-white" : "bg-navy-950/10 text-muted"}`}>
        {ok ? "✓" : "…"}
      </span>
      <span className={ok ? "" : "text-muted"}>{label}</span>
    </li>
  );
}

function EditDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { event } = useEvent();
  const [form, setForm] = React.useState({
    title: event.title, host_name: event.host_name ?? "", description: event.description ?? "",
    venue_name: event.venue_name ?? "", venue_address: event.venue_address ?? "", map_url: event.map_url ?? "",
    capacity: event.capacity, allow_reentry: !!event.allow_reentry, cancel_returns_quota: !!event.cancel_returns_quota,
    starts_at: toLocalDatetimeInput(event.starts_at),
    ends_at: toLocalDatetimeInput(event.ends_at),
    rsvp_deadline: toLocalDatetimeInput(event.rsvp_deadline),
  });
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true); setError("");
    try {
      await api.patch(`/api/events/${event.id}`, {
        title: form.title, host_name: form.host_name, description: form.description,
        venue_name: form.venue_name, venue_address: form.venue_address, map_url: form.map_url,
        capacity: Number(form.capacity), allow_reentry: form.allow_reentry,
        cancel_returns_quota: form.cancel_returns_quota,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        rsvp_deadline: form.rsvp_deadline ? new Date(form.rsvp_deadline).toISOString() : null,
      });
      onSaved();
    } catch (e: any) { setError(e.message); setSaving(false); }
  }

  return (
    <Dialog open onClose={onClose} title="تعديل المناسبة" wide>
      <div className="space-y-4">
        <Field label="الاسم"><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="صاحب المناسبة"><Input value={form.host_name} onChange={(e) => set("host_name", e.target.value)} /></Field>
          <Field label="السعة" hint={event.unit_locked ? "وحدة الحصة مقفلة بعد أول إصدار" : undefined}>
            <Input type="number" min={1} dir="ltr" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="البداية"><Input type="datetime-local" dir="ltr" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></Field>
          <Field label="النهاية"><Input type="datetime-local" dir="ltr" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="المكان"><Input value={form.venue_name} onChange={(e) => set("venue_name", e.target.value)} /></Field>
          <Field label="العنوان"><Input value={form.venue_address} onChange={(e) => set("venue_address", e.target.value)} /></Field>
        </div>
        <Field label="رابط الخرائط"><Input dir="ltr" className="text-left" value={form.map_url} onChange={(e) => set("map_url", e.target.value)} /></Field>
        <Field label="إغلاق الردود"><Input type="datetime-local" dir="ltr" value={form.rsvp_deadline} onChange={(e) => set("rsvp_deadline", e.target.value)} /></Field>
        <div className="rounded-xl border border-navy-950/8 bg-ivory-soft p-4">
          <Switch checked={form.cancel_returns_quota} onChange={(v) => set("cancel_returns_quota", v)} label="إعادة الحصة عند الإلغاء" />
          <Switch checked={form.allow_reentry} onChange={(v) => set("allow_reentry", v)} label="السماح بإعادة الدخول" />
        </div>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} loading={saving}>حفظ</Button>
        </div>
      </div>
    </Dialog>
  );
}
