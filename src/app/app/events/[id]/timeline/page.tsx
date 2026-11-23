"use client";
import * as React from "react";
import { Plus, Pencil, Trash2, Check, CalendarClock } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { formatDateShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Textarea, Select } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Loading, ErrorState, useToast } from "@/components/ui/feedback";

const PHASES: Record<string, string> = { preparation: "مراحل التجهيز", event_day: "يوم المناسبة", after: "بعد المناسبة" };

export default function TimelinePage() {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [editing, setEditing] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const load = React.useCallback(() => api.get<any[]>(`/api/events/${event.id}/timeline`).then(setRows).catch((e) => setError(e.message)), [event.id]);
  React.useEffect(() => { load(); }, [load]);
  async function toggle(t: any) {
    try { await api.patch(`/api/timeline/${t.id}`, { done: !t.done }); load(); } catch (e: any) { show(e.message, "error"); }
  }
  async function remove(id: string) {
    try { await api.del(`/api/timeline/${id}`); show("تم حذف المرحلة"); load(); } catch (e: any) { show(e.message, "error"); }
  }
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!rows) return <Loading />;
  const phases = ["preparation", "event_day", "after"];
  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      <div className="flex justify-end"><Button onClick={() => setEditing({ phase: "preparation" })}><Plus className="h-4 w-4" /> مرحلة جديدة</Button></div>
      <div className="space-y-6">
        {phases.map((ph) => {
          const items = rows.filter((r) => r.phase === ph);
          return (
            <div key={ph}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><CalendarClock className="h-4 w-4 text-muted" /> {PHASES[ph]} <Badge tone="neutral">{items.length}</Badge></h2>
              <div className="relative space-y-2 border-r-2 border-lime-400/30 pr-5">
                {items.length === 0 && <p className="py-3 text-xs text-muted">لا مراحل هنا</p>}
                {items.map((t) => (
                  <div key={t.id} className="relative rounded-card border border-navy-950/8 bg-white p-4">
                    <span className="absolute -right-[25px] top-5 h-3 w-3 rounded-full border-2 border-lime-400 bg-white" />
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={t.done ? "font-bold line-through opacity-70" : "font-bold"}>{t.title}</p>
                        {t.description && <p className="mt-1 text-sm text-muted">{t.description}</p>}
                        {t.starts_at && <p className="mt-1 text-xs text-muted">{formatDateShort(t.starts_at)}</p>}
                      </div>
                      <div className="flex shrink-0 gap-1">
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
      {editing && <TimelineDialog data={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function TimelineDialog({ data, onClose, onSaved }: any) {
  const { event } = useEvent();
  const { show } = useToast();
  const [form, setForm] = React.useState<any>({
    phase: data.phase ?? "preparation", title: data.title ?? "", description: data.description ?? "",
    starts_at: data.starts_at ? data.starts_at.slice(0, 16) : "", done: !!data.done,
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
        <Field label="مكتملة"><Select value={form.done ? "1" : "0"} onChange={(e) => set("done", e.target.value === "1")}><option value="0">لا</option><option value="1">نعم</option></Select></Field>
      </div>
      <div className="mt-4"><Field label="الوصف"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></Field></div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={save}>حفظ</Button></div>
    </Dialog>
  );
}
