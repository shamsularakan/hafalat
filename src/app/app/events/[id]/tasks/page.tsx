"use client";
import * as React from "react";
import { Plus, Pencil, Trash2, Check, ListTodo } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { formatDateShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Textarea, Select } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Loading, ErrorState, useToast } from "@/components/ui/feedback";

const COLUMNS = [
  { id: "todo", label: "للتنفيذ", tone: "neutral" as const },
  { id: "doing", label: "قيد التنفيذ", tone: "warning" as const },
  { id: "done", label: "مكتملة", tone: "success" as const },
];

export default function TasksPage() {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [people, setPeople] = React.useState<any[]>([]);
  const [editing, setEditing] = React.useState<any>(null);
  const [filter, setFilter] = React.useState("");
  const [error, setError] = React.useState("");
  const load = React.useCallback(() => {
    api.get<any[]>(`/api/events/${event.id}/tasks`).then(setRows).catch((e) => setError(e.message));
    Promise.all([
      api.get<any[]>(`/api/events/${event.id}/team`).catch(() => []),
      api.get<any[]>(`/api/events/${event.id}/members`).catch(() => []),
    ]).then(([a, b]) => {
      const map = new Map<string, any>();
      [...a, ...b].forEach((m: any) => map.set(m.user_id, { id: m.user_id, name: m.name, role: m.role }));
      setPeople([...map.values()]);
    });
  }, [event.id]);
  React.useEffect(load, [load]);
  async function remove(id: string) {
    try { await api.del(`/api/tasks/${id}`); show("تم حذف المهمة"); load(); }
    catch (e: any) { show(e.message, "error"); }
  }
  async function quickMove(t: any, status: string) {
    try { await api.patch(`/api/tasks/${t.id}`, { status }); load(); }
    catch (e: any) { show(e.message, "error"); }
  }
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!rows) return <Loading />;
  const filtered = filter ? rows.filter((r) => r.category?.includes(filter) || r.title.includes(filter)) : rows;
  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input placeholder="بحث في المهام…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        <Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> مهمة جديدة</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = filtered.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className="rounded-card border border-navy-950/8 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold"><ListTodo className="h-4 w-4 text-muted" /> {col.label}</h3>
                <Badge tone={col.tone}>{items.length}</Badge>
              </div>
              <div className="space-y-2.5">
                {items.length === 0 && <p className="py-6 text-center text-xs text-muted">لا مهام هنا</p>}
                {items.map((t) => (
                  <div key={t.id} className={t.status === "done" ? "rounded-xl border border-navy-950/8 bg-ivory-soft p-3 opacity-75" : "rounded-xl border border-navy-950/8 p-3"}>
                    <div className="flex items-start justify-between gap-2">
                      <p className={t.status === "done" ? "text-sm font-bold line-through" : "text-sm font-bold"}>{t.title}</p>
                      <div className="flex shrink-0 gap-0.5">
                        {t.status !== "done" && <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => quickMove(t, "done")} aria-label="إكمال"><Check className="h-3.5 w-3.5" /></Button>}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(t)} aria-label="تعديل"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" onClick={() => remove(t.id)} aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {t.category && <Badge tone="neutral">{t.category}</Badge>}
                      {t.priority === "high" && <Badge tone="danger">أولوية عالية</Badge>}
                      {t.due_date && <span className="text-[11px] text-muted">{formatDateShort(t.due_date)}</span>}
                    </div>
                    {t.assignee_name && <p className="mt-1 text-[11px] text-muted">المسؤول: {t.assignee_name}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {editing && <TaskDialog data={editing} people={people} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function TaskDialog({ data, people, onClose, onSaved }: any) {
  const { event } = useEvent();
  const { show } = useToast();
  const [form, setForm] = React.useState<any>({
    title: data.title ?? "", description: data.description ?? "", category: data.category ?? "",
    status: data.status ?? "todo", priority: data.priority ?? "medium", due_date: data.due_date ?? "", assignee_id: data.assignee_id ?? "",
  });
  const [busy, setBusy] = React.useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  async function save() {
    setBusy(true);
    try {
      if (data.id) await api.patch(`/api/tasks/${data.id}`, form);
      else await api.post(`/api/events/${event.id}/tasks`, form);
      show("تم حفظ المهمة"); onSaved();
    } catch (e: any) { show(e.message, "error"); setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title={data.id ? "تعديل المهمة" : "مهمة جديدة"} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="العنوان"><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="التصنيف"><Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="مثال: القاعة، الضيافة…" /></Field>
        <Field label="الحالة"><Select value={form.status} onChange={(e) => set("status", e.target.value)}><option value="todo">للتنفيذ</option><option value="doing">قيد التنفيذ</option><option value="done">مكتملة</option></Select></Field>
        <Field label="الأولوية"><Select value={form.priority} onChange={(e) => set("priority", e.target.value)}><option value="low">منخفضة</option><option value="medium">متوسطة</option><option value="high">عالية</option></Select></Field>
        <Field label="الموعد"><Input type="date" dir="ltr" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} /></Field>
        <Field label="المسؤول"><Select value={form.assignee_id} onChange={(e) => set("assignee_id", e.target.value)}><option value="">بدون</option>{people.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      </div>
      <div className="mt-4"><Field label="الوصف"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></Field></div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={save} loading={busy}>حفظ</Button></div>
    </Dialog>
  );
}
