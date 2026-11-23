"use client";
import * as React from "react";
import { Plus, Pencil, Trash2, Check, CalendarClock, Eye, EyeOff, ClipboardList, MoveVertical, Phone } from "lucide-react";
import { DaySheetDialog } from "@/components/planning-widgets";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { formatDateShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Textarea, Select, Switch } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Loading, ErrorState, useToast } from "@/components/ui/feedback";

const PHASES: Record<string, string> = { preparation: "مراحل التجهيز", event_day: "يوم المناسبة", after: "بعد المناسبة" };

/** وقت الخطوة بالساعة في توقيت المناسبة (لجدول اليوم) */
const timeOf = (iso: string, tz?: string) =>
  new Date(iso).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit", timeZone: tz || "Asia/Riyadh" });

export default function TimelinePage() {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [editing, setEditing] = React.useState<any>(null);
  const [sheet, setSheet] = React.useState(false);
  const [shifting, setShifting] = React.useState(false);
  const [vendors, setVendors] = React.useState<any[]>([]);
  const [error, setError] = React.useState("");
  React.useEffect(() => { api.get<any[]>(`/api/events/${event.id}/vendors`).then(setVendors).catch(() => {}); }, [event.id]);
  const load = React.useCallback(() => api.get<any[]>(`/api/events/${event.id}/timeline`).then(setRows).catch((e) => setError(e.message)), [event.id]);
  React.useEffect(() => { load(); }, [load]);
  async function toggle(t: any) {
    try { await api.patch(`/api/timeline/${t.id}`, { done: !t.done }); load(); } catch (e: any) { show(e.message, "error"); }
  }
  async function toggleGuests(t: any) {
    try {
      await api.patch(`/api/timeline/${t.id}`, { show_to_guests: !t.show_to_guests });
      show(t.show_to_guests ? "أُخفيت الخطوة من برنامج الدعوة" : "ستظهر الخطوة في برنامج الدعوة");
      load();
    } catch (e: any) { show(e.message, "error"); }
  }
  async function remove(id: string) {
    try { await api.del(`/api/timeline/${id}`); show("تم حذف المرحلة"); load(); } catch (e: any) { show(e.message, "error"); }
  }
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!rows) return <Loading />;
  const phases = ["preparation", "event_day", "after"];
  const sorted = (list: any[], ph: string) => ph === "event_day"
    ? [...list].sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? "") || a.sort_order - b.sort_order)
    : list;
  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => setSheet(true)}><ClipboardList className="h-4 w-4" /> الجدول المعتمد للموردين</Button>
        <Button variant="outline" onClick={() => setShifting(true)}><MoveVertical className="h-4 w-4" /> إزاحة جدول اليوم</Button>
        <Button onClick={() => setEditing({ phase: "preparation" })}><Plus className="h-4 w-4" /> مرحلة جديدة</Button>
      </div>
      <div className="space-y-6">
        {phases.map((ph) => {
          const items = sorted(rows.filter((r) => r.phase === ph), ph);
          return (
            <div key={ph}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><CalendarClock className="h-4 w-4 text-muted" /> {PHASES[ph]} <Badge tone="neutral">{items.length}</Badge></h2>
              {ph === "event_day" && items.length > 0 && (
                <p className="-mt-1 mb-3 text-xs text-muted">الخطوات المعلّمة بـ«ظاهرة للضيوف» تُعرض في برنامج الحفل داخل الدعوة.</p>
              )}
              <div className="relative space-y-2 border-r-2 border-lime-400/30 pr-5">
                {items.length === 0 && <p className="py-3 text-xs text-muted">لا مراحل هنا</p>}
                {items.map((t) => (
                  <div key={t.id} className="relative rounded-card border border-navy-950/8 bg-white p-4">
                    <span className="absolute -right-[25px] top-5 h-3 w-3 rounded-full border-2 border-lime-400 bg-white" />
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={t.done ? "font-bold line-through opacity-70" : "font-bold"}>{t.title}</p>
                        {t.description && <p className="mt-1 text-sm text-muted">{t.description}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          {t.starts_at && <span className={ph === "event_day" ? "font-bold text-navy-950 tabular-nums" : ""}>{ph === "event_day" ? timeOf(t.starts_at, event.timezone) : formatDateShort(t.starts_at)}</span>}
                          {t.vendor_name ? (
                            <Badge tone="neutral">{t.vendor_name}{t.vendor_phone && <a href={`tel:${t.vendor_phone}`} dir="ltr" className="inline-flex items-center gap-0.5"><Phone className="h-3 w-3" />{t.vendor_phone}</a>}</Badge>
                          ) : t.owner_label && <Badge tone="neutral">{t.owner_label}</Badge>}
                          {ph === "event_day" && (t.show_to_guests ? <Badge tone="lime">ظاهرة للضيوف</Badge> : <Badge tone="neutral">داخلية</Badge>)}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {ph === "event_day" && (
                          <Button variant="ghost" size="icon" onClick={() => toggleGuests(t)} aria-label={t.show_to_guests ? "إخفاء من برنامج الدعوة" : "إظهار في برنامج الدعوة"} title={t.show_to_guests ? "إخفاء من برنامج الدعوة" : "إظهار في برنامج الدعوة"}>
                            {t.show_to_guests ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted" />}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className={t.done ? "text-success" : ""} onClick={() => toggle(t)} aria-label="إكمال"><Check className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(t)} aria-label="تعديل"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="text-danger" onClick={() => remove(t.id)} aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {editing && <TimelineDialog data={editing} vendors={vendors} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {sheet && <DaySheetDialog onClose={() => setSheet(false)} />}
      {shifting && <ShiftDialog onClose={() => setShifting(false)} onDone={(n) => { setShifting(false); show(`أُزيحت ${n} خطوة`); load(); }} />}
    </div>
  );
}

/** ISO ← قيمة datetime-local بالتوقيت المحلي للمتصفح (slice(0,16) كان يعرض UTC) */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function ShiftDialog({ onClose, onDone }: { onClose: () => void; onDone: (n: number) => void }) {
  const { event } = useEvent();
  const [minutes, setMinutes] = React.useState("30");
  const [dir, setDir] = React.useState<"later" | "earlier">("later");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  async function apply() {
    setBusy(true); setError("");
    try {
      const r = await api.post<any>(`/api/events/${event.id}/timeline/shift`, { minutes: Number(minutes) * (dir === "later" ? 1 : -1) });
      onDone(r.shifted);
    } catch (e: any) { setError(e.message); setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title="إزاحة جدول يوم المناسبة">
      <div className="space-y-4">
        <p className="text-sm text-muted">تتحرك كل خطوات اليوم معًا — مفيد إذا تغيّر وقت بداية الاستقبال. (تغيير تاريخ المناسبة نفسه يزيح المهام والجدول تلقائيًا.)</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="المقدار بالدقائق" htmlFor="sh-min"><Input id="sh-min" type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></Field>
          <Field label="الاتجاه" htmlFor="sh-dir"><Select id="sh-dir" value={dir} onChange={(e) => setDir(e.target.value as any)}><option value="later">تأخير</option><option value="earlier">تقديم</option></Select></Field>
        </div>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={apply} loading={busy} disabled={!Number(minutes)}>إزاحة</Button></div>
      </div>
    </Dialog>
  );
}

function TimelineDialog({ data, vendors = [], onClose, onSaved }: any) {
  const { event } = useEvent();
  const { show } = useToast();
  const [form, setForm] = React.useState<any>({
    phase: data.phase ?? "preparation", title: data.title ?? "", description: data.description ?? "",
    starts_at: data.starts_at ? toLocalInput(data.starts_at) : "", done: !!data.done,
    owner_label: data.owner_label ?? "", vendor_id: data.vendor_id ?? "", show_to_guests: data.show_to_guests === undefined ? data.phase === "event_day" : !!data.show_to_guests,
  });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  async function save() {
    try {
      const body = { ...form, starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null };
      if (data.id) await api.patch(`/api/timeline/${data.id}`, body);
      else await api.post(`/api/events/${event.id}/timeline`, body);
      show("تم حفظ المرحلة"); onSaved();
    } catch (e: any) { show(e.message, "error"); }
  }
  return (
    <Dialog open onClose={onClose} title={data.id ? "تعديل المرحلة" : "مرحلة جديدة"} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="المرحلة"><Select value={form.phase} onChange={(e) => set("phase", e.target.value)}><option value="preparation">مراحل التجهيز</option><option value="event_day">يوم المناسبة</option><option value="after">بعد المناسبة</option></Select></Field>
        <Field label="العنوان"><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="التوقيت"><Input type="datetime-local" dir="ltr" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></Field>
        <Field label="المورد المسؤول" hint="يظهر رقمه في الجدول المعتمد"><Select value={form.vendor_id} onChange={(e) => set("vendor_id", e.target.value)}><option value="">بلا مورد</option>{vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
        <Field label="المسؤول"><Input value={form.owner_label} onChange={(e) => set("owner_label", e.target.value)} placeholder="مثال: فريق الاستقبال" /></Field>
        {form.phase === "event_day" && <div className="flex items-end pb-1"><Switch checked={form.show_to_guests} onChange={(v) => set("show_to_guests", v)} label="تظهر في برنامج الدعوة" /></div>}
        <Field label="مكتملة"><Select value={form.done ? "1" : "0"} onChange={(e) => set("done", e.target.value === "1")}><option value="0">لا</option><option value="1">نعم</option></Select></Field>
      </div>
      <div className="mt-4"><Field label="الوصف"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></Field></div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={save}>حفظ</Button></div>
    </Dialog>
  );
}
