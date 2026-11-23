"use client";
import * as React from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Loading, ErrorState, useToast } from "@/components/ui/feedback";

const ROLE: Record<string, string> = { planner: "مدير التخطيط", finance: "المسؤول المالي", services: "منسق الخدمات" };

export default function TeamPage() {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [error, setError] = React.useState("");
  const load = React.useCallback(() => api.get<any[]>(`/api/events/${event.id}/team`).then(setRows).catch((e) => setError(e.message)), [event.id]);
  React.useEffect(() => { load(); }, [load]);
  async function remove(id: string) {
    try { await api.del(`/api/team/${id}`); show("تمت إزالة العضو"); load(); } catch (e: any) { show(e.message, "error"); }
  }
  if (error) return <ErrorState message={error} onRetry={load} />;
  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4" /> فريق التخطيط</CardTitle>
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> إضافة عضو</Button>
        </CardHeader>
        <p className="mb-4 text-xs leading-6 text-muted">
          الأدوار مستقلة لكل مناسبة ويمكن للشخص الحصول على أكثر من دور. يحتوي النظام أيضًا على مفوّضي الدعوات
          وموظفي الاستقبال من صفحتي «المفوّضون» و«الطاقم والبوابات» — تبقى جميع صلاحياتهم كما هي.
        </p>
        {!rows ? <Loading /> : rows.length === 0 ? <p className="py-10 text-center text-sm text-muted">لا أعضاء في فريق التخطيط بعد.</p> : (
          <div className="divide-y divide-navy-950/6">
            {rows.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-bold">{m.name}</p><p className="text-xs text-muted" dir="ltr">{m.email ?? "—"}</p></div>
                <div className="flex items-center gap-2"><Badge tone="navy">{ROLE[m.role] ?? m.role}</Badge><Button variant="ghost" size="icon" className="text-danger" onClick={() => remove(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {adding && <AddDialog onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </div>
  );
}

function AddDialog({ onClose, onSaved }: any) {
  const { event } = useEvent();
  const { show } = useToast();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("planner");
  async function save() {
    try { await api.post(`/api/events/${event.id}/team`, { email, role }); show("تمت إضافة العضو"); onSaved(); }
    catch (e: any) { show(e.message, "error"); }
  }
  return (
    <Dialog open onClose={onClose} title="إضافة عضو لفريق التخطيط">
      <div className="space-y-4">
        <Field label="بريد المستخدم المسجل"><Input dir="ltr" className="text-left" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></Field>
        <Field label="الدور"><Select value={role} onChange={(e) => setRole(e.target.value)}><option value="planner">مدير التخطيط</option><option value="finance">المسؤول المالي</option><option value="services">منسق الخدمات</option></Select></Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={save} disabled={!email.trim()}>إضافة</Button></div>
      </div>
    </Dialog>
  );
}
