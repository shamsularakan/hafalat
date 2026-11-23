"use client";
import * as React from "react";
import { Shield, Plus, DoorOpen, UserPlus } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Loading, ErrorState, EmptyState, useToast } from "@/components/ui/feedback";

const ROLE_AR: Record<string, string> = {
  owner: "مالك", manager: "مدير المناسبة", supervisor: "مشرف دعوات",
  delegate: "مفوّض", receptionist: "موظف استقبال", designer: "مصمم",
};

export default function StaffPage() {
  const { event, gates, refresh } = useEvent();
  const { show, node } = useToast();
  const [members, setMembers] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [gateName, setGateName] = React.useState("");

  const load = React.useCallback(() => {
    api.get<any[]>(`/api/events/${event.id}/members`).then(setMembers).catch((e) => setError(e.message));
  }, [event.id]);
  React.useEffect(load, [load]);

  async function addGate() {
    try {
      await api.post(`/api/events/${event.id}/gates`, { name: gateName });
      setGateName("");
      await refresh();
      show("تمت إضافة البوابة");
    } catch (e: any) { show(e.message, "error"); }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Shield className="h-5 w-5 text-muted" /> الطاقم والبوابات</h2>
          <p className="text-sm text-muted">أدوار مستقلة عن أدوار المنظمة، وتكليف بوابات محدد لموظفي الاستقبال.</p>
        </div>
        <Button onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" /> تكليف عضو</Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-0">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">طاقم المناسبة</CardTitle></CardHeader>
          {!members ? <Loading /> : members.length === 0 ? (
            <EmptyState title="لا طاقم بعد" />
          ) : (
            <div className="divide-y divide-navy-950/6">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{m.name}</p>
                    <p className="truncate text-xs text-muted" dir="ltr">{m.email ?? m.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.role === "receptionist" && (() => {
                      try {
                        const g = JSON.parse(m.permissions).gates ?? [];
                        return <span className="text-[10px] text-muted">{g.length ? `${g.length} بوابة محددة` : "كل البوابات"}</span>;
                      } catch { return null; }
                    })()}
                    <Badge tone={m.role === "owner" ? "navy" : "lime"}>{ROLE_AR[m.role] ?? m.role}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><DoorOpen className="h-4 w-4" /> البوابات</CardTitle></CardHeader>
          <div className="space-y-2">
            {gates.map((g: any) => (
              <div key={g.id} className="flex items-center justify-between rounded-xl border border-navy-950/8 px-3.5 py-2.5 text-sm font-semibold">
                {g.name}
                <Badge tone="neutral">نشطة</Badge>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input className="min-w-0 flex-1" placeholder="بوابة جديدة — مثال: البوابة الشرقية" value={gateName} onChange={(e) => setGateName(e.target.value)} />
            <Button onClick={addGate} disabled={!gateName.trim()}><Plus className="h-4 w-4" /></Button>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-muted">
            الموظف المكلّف ببوابات محددة لا يستطيع المسح خارجها (AC-10). اترك التكليف فارغًا للسماح بكل البوابات.
          </p>
        </Card>
      </div>

      {adding && <AddMemberDialog onClose={() => setAdding(false)} onDone={() => { setAdding(false); show("تم تكليف العضو"); load(); }} />}
    </div>
  );
}

function AddMemberDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { event, gates } = useEvent();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("receptionist");
  const [selectedGates, setSelectedGates] = React.useState<string[]>([]);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    setBusy(true); setError("");
    try {
      await api.post(`/api/events/${event.id}/members`, { email, role, gates: role === "receptionist" ? selectedGates : [] });
      onDone();
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  return (
    <Dialog open onClose={onClose} title="تكليف عضو بالمناسبة">
      <div className="space-y-4">
        <Field label="بريد المستخدم المسجل" hint="يجب أن يكون له حساب في المنصة أولًا">
          <Input dir="ltr" className="text-left" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
        </Field>
        <Field label="الدور">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="receptionist">موظف استقبال (مسح QR)</option>
            <option value="manager">مدير المناسبة</option>
            <option value="supervisor">مشرف دعوات</option>
            <option value="designer">مصمم</option>
          </Select>
        </Field>
        {role === "receptionist" && (
          <Field label="البوابات المسموحة" hint="فارغ = كل البوابات">
            <div className="space-y-1.5">
              {gates.map((g: any) => (
                <label key={g.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-lime-500"
                    checked={selectedGates.includes(g.id)}
                    onChange={(e) => setSelectedGates((s) => e.target.checked ? [...s, g.id] : s.filter((x) => x !== g.id))} />
                  {g.name}
                </label>
              ))}
            </div>
          </Field>
        )}
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} loading={busy} disabled={!email.trim()}>تكليف</Button>
        </div>
      </div>
    </Dialog>
  );
}
