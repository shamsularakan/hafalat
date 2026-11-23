"use client";
import * as React from "react";
import { Plus, ArrowLeftRight, ScrollText, PauseCircle, PlayCircle, Pencil, UserCheck } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { formatNumber, formatDateShort, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select, Switch } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Table, TH, TD, TR } from "@/components/ui/table";
import { Loading, ErrorState, EmptyState, useToast } from "@/components/ui/feedback";

const PERM_LABELS: [string, string][] = [
  ["can_issue", "إصدار دعوات"],
  ["can_send", "إرسال ومشاركة"],
  ["can_edit", "تعديل بيانات الضيوف"],
  ["can_cancel", "إلغاء الدعوات"],
  ["can_view_rsvp", "الاطلاع على الردود"],
  ["can_view_all", "رؤية كل ضيوف المناسبة"],
  ["allow_vip", "دعوة فئة VIP"],
  ["allow_companions", "السماح بالمرافقين"],
  ["can_delegate_sub", "إنشاء مفوّضين فرعيين (للمشرف)"],
];

export default function DelegatesPage() {
  const { event, role } = useEvent();
  const { show, node } = useToast();
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<any>(null);
  const [realloc, setRealloc] = React.useState(false);
  const [ledger, setLedger] = React.useState<any>(null);
  const canManage = ["owner", "manager"].includes(role);

  const load = React.useCallback(() => {
    api.get<any[]>(`/api/events/${event.id}/delegations`).then(setRows).catch((e) => setError(e.message));
  }, [event.id]);
  React.useEffect(load, [load]);

  async function setStatus(d: any, status: string) {
    try {
      await api.patch(`/api/delegations/${d.id}`, { status, suspended_policy: status === "suspended" ? "keep" : undefined });
      show(status === "suspended" ? "تم إيقاف المفوّض — تتوقف الدعوات الجديدة وتبقى الصادرة" : "تمت إعادة التنشيط");
      load();
    } catch (e: any) { show(e.message, "error"); }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4 animate-fade-up">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">التفويضات والحصص</h2>
          <p className="text-sm text-muted">
            وحدة الحصة: {event.quota_unit === "card" ? "بطاقة/دعوة" : "شخص شامل المرافقين"} {event.unit_locked ? "(مقفلة)" : "(تُقفل عند أول إصدار)"}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setRealloc(true)}><ArrowLeftRight className="h-4 w-4" /> إعادة تخصيص</Button>
            <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> مفوّض جديد</Button>
          </div>
        )}
      </div>

      {!rows ? <Loading /> : rows.length === 0 ? (
        <EmptyState title="لا يوجد مفوّضون" hint="عيّن مفوّضين بحصص رقمية وصلاحيات محددة لتوزيع الدعوات."
          action={canManage ? <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> تعيين مفوّض</Button> : undefined} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((d) => {
            const pct = d.quota_allocated > 0 ? Math.round((d.quota_used / d.quota_allocated) * 100) : 0;
            return (
              <Card key={d.id}>
                <CardHeader>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-950 text-sm font-bold text-lime-400">
                      {d.invitee_name?.slice(0, 1)}
                    </span>
                    <div>
                      <CardTitle className="truncate">{d.invitee_name}</CardTitle>
                      <p className="text-xs text-muted" dir="ltr">{d.invitee_phone ?? d.invitee_email ?? "بلا وسيلة تواصل"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={d.status === "active" ? "success" : d.status === "pending" ? "warning" : "danger"}>
                      {d.status === "active" ? "نشط" : d.status === "pending" ? "بانتظار القبول" : d.status === "suspended" ? "موقوف" : "ملغى"}
                    </Badge>
                    {d.role === "supervisor" && <Badge tone="navy">مشرف</Badge>}
                  </div>
                </CardHeader>

                {/* شريط الحصة */}
                <div className="mb-3">
                  <div className="mb-1.5 flex justify-between text-xs font-semibold">
                    <span>المستخدم {formatNumber(d.quota_used)} / المخصص {formatNumber(d.quota_allocated)}</span>
                    <span className={cn(pct >= 100 ? "text-danger" : "text-muted")}>المتبقي {formatNumber(d.remaining)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-navy-950/8">
                    <div className={cn("h-full rounded-full transition-all duration-500", pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-brand-orange" : "bg-lime-400")}
                      style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-4 gap-2 text-center text-xs">
                  <MiniStat label="صادر" v={d.stats?.total ?? 0} />
                  <MiniStat label="مؤكد" v={d.stats?.confirmed ?? 0} tone="text-success" />
                  <MiniStat label="معتذر" v={d.stats?.declined ?? 0} tone="text-danger" />
                  <MiniStat label="حضور" v={d.stats?.actual_persons ?? 0} tone="text-navy-950" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-navy-950/6 pt-3">
                  <p className="text-[11px] text-muted">
                    {d.expires_at ? `ينتهي: ${formatDateShort(d.expires_at)}` : "بلا تاريخ انتهاء"}
                  </p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setLedger(d)}><ScrollText className="h-3.5 w-3.5" /> السجل</Button>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(d)}><Pencil className="h-3.5 w-3.5" /> تعديل</Button>
                        {d.status === "active" || d.status === "pending" ? (
                          <Button variant="ghost" size="sm" className="text-danger" onClick={() => setStatus(d, "suspended")}><PauseCircle className="h-3.5 w-3.5" /> إيقاف</Button>
                        ) : d.status === "suspended" ? (
                          <Button variant="ghost" size="sm" className="text-success" onClick={() => setStatus(d, "active")}><PlayCircle className="h-3.5 w-3.5" /> تنشيط</Button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {adding && <DelegationDialog onClose={() => setAdding(false)} onSaved={() => { setAdding(false); show("تم إنشاء التفويض"); load(); }} />}
      {editing && <DelegationDialog existing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); show("تم تحديث التفويض"); load(); }} />}
      {realloc && rows && <ReallocDialog rows={rows} onClose={() => setRealloc(false)} onDone={() => { setRealloc(false); show("تمت إعادة التخصيص"); load(); }} />}
      {ledger && <LedgerDialog delegation={ledger} onClose={() => setLedger(null)} />}
    </div>
  );
}

function MiniStat({ label, v, tone }: { label: string; v: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-ivory-soft py-2">
      <p className={cn("text-sm font-extrabold tabular-nums", tone)}>{formatNumber(v)}</p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}

function DelegationDialog({ existing, onClose, onSaved }: { existing?: any; onClose: () => void; onSaved: () => void }) {
  const { event } = useEvent();
  const [form, setForm] = React.useState({
    invitee_name: existing?.invitee_name ?? "",
    invitee_phone: existing?.invitee_phone ?? "",
    invitee_email: existing?.invitee_email ?? "",
    quota: existing?.quota_allocated ?? 10,
    role: existing?.role ?? "delegate",
    expires_at: existing?.expires_at ? existing.expires_at.slice(0, 10) : "",
    permissions: existing?.permissions_parsed ?? {
      can_issue: true, can_send: true, can_edit: false, can_cancel: false,
      can_view_rsvp: true, can_view_all: false, allow_vip: false, allow_companions: true, can_delegate_sub: false,
    },
  });
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true); setError("");
    try {
      if (existing) {
        await api.patch(`/api/delegations/${existing.id}`, {
          quota: Number(form.quota), permissions: form.permissions,
          expires_at: form.expires_at ? new Date(form.expires_at + "T23:59:59").toISOString() : null,
        });
      } else {
        await api.post(`/api/events/${event.id}/delegations`, {
          invitee_name: form.invitee_name, invitee_phone: form.invitee_phone || undefined,
          invitee_email: form.invitee_email || undefined, quota: Number(form.quota), role: form.role,
          permissions: form.permissions,
          expires_at: form.expires_at ? new Date(form.expires_at + "T23:59:59").toISOString() : null,
        });
      }
      onSaved();
    } catch (e: any) { setError(e.message); setSaving(false); }
  }

  return (
    <Dialog open onClose={onClose} title={existing ? `تعديل تفويض «${existing.invitee_name}»` : "مفوّض جديد"} wide>
      <div className="space-y-4">
        {!existing && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="الاسم"><Input value={form.invitee_name} onChange={(e) => setForm({ ...form, invitee_name: e.target.value })} /></Field>
              <Field label="الهاتف"><Input dir="ltr" className="text-left" value={form.invitee_phone} onChange={(e) => setForm({ ...form, invitee_phone: e.target.value })} placeholder="+9665…" /></Field>
              <Field label="البريد"><Input dir="ltr" className="text-left" value={form.invitee_email} onChange={(e) => setForm({ ...form, invitee_email: e.target.value })} /></Field>
            </div>
            <p className="rounded-xl bg-lime-100 p-3 text-xs leading-6">
              إن كان للمفوّض حساب مسجل بنفس الهاتف/البريد فسيُربط تلقائيًا عند تسجيله أو فورًا إن وُجد.
              يمكن ربطه لاحقًا من سجل التفويضات.
            </p>
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="الحصة الرقمية" hint="لا تتجاوز غير الموزع من السعة">
            <Input type="number" min={0} dir="ltr" value={form.quota} onChange={(e) => setForm({ ...form, quota: Number(e.target.value) })} />
          </Field>
          {!existing && (
            <Field label="الدور">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="delegate">مفوّض دعوات</option>
                <option value="supervisor">مشرف دعوات</option>
              </Select>
            </Field>
          )}
          <Field label="انتهاء التفويض (اختياري)">
            <Input type="date" dir="ltr" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
          </Field>
        </div>
        <div className="rounded-xl border border-navy-950/8 bg-ivory-soft p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold"><UserCheck className="h-4 w-4" /> الصلاحيات الدقيقة (الحد الأدنى اللازم)</p>
          <div className="grid sm:grid-cols-2">
            {PERM_LABELS.map(([key, label]) => (
              <Switch key={key} checked={!!form.permissions[key]}
                onChange={(v) => setForm({ ...form, permissions: { ...form.permissions, [key]: v } })} label={label} />
            ))}
          </div>
        </div>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} loading={saving}>{existing ? "حفظ التعديلات" : "إنشاء التفويض"}</Button>
        </div>
      </div>
    </Dialog>
  );
}

function ReallocDialog({ rows, onClose, onDone }: { rows: any[]; onClose: () => void; onDone: () => void }) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [amount, setAmount] = React.useState(1);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    setBusy(true); setError("");
    try {
      await api.post("/api/delegations/reallocate", { from_delegation_id: from, to_delegation_id: to, amount: Number(amount), reason });
      onDone();
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  return (
    <Dialog open onClose={onClose} title="إعادة تخصيص رصيد غير مستخدم">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="من مفوّض">
            <Select value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">اختر…</option>
              {rows.map((d) => <option key={d.id} value={d.id}>{d.invitee_name} (متبقي {d.remaining})</option>)}
            </Select>
          </Field>
          <Field label="إلى مفوّض">
            <Select value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">اختر…</option>
              {rows.filter((d) => d.id !== from).map((d) => <option key={d.id} value={d.id}>{d.invitee_name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="الكمية"><Input type="number" min={1} dir="ltr" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
        <Field label="السبب (إلزامي ويوثق في السجل)"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: دعم فريق البوابة الشرقية" /></Field>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} loading={busy} disabled={!from || !to || !reason.trim()}>تنفيذ النقل</Button>
        </div>
      </div>
    </Dialog>
  );
}

const REASON_AR: Record<string, string> = {
  allocation: "تخصيص حصة", issue: "إصدار دعوة", cancel_return: "إلغاء — إعادة حصة",
  cancel_burn: "إلغاء — حصة مستهلكة", reallocate_out: "نقل رصيد صادر", reallocate_in: "نقل رصيد وارد", adjust: "تعديل حصة",
};

function LedgerDialog({ delegation, onClose }: { delegation: any; onClose: () => void }) {
  const { event } = useEvent();
  const [rows, setRows] = React.useState<any[] | null>(null);
  React.useEffect(() => {
    api.get<any[]>(`/api/events/${event.id}/ledger?delegation_id=${delegation.id}`).then(setRows).catch(() => setRows([]));
  }, [event.id, delegation.id]);

  return (
    <Dialog open onClose={onClose} title={`سجل أرصدة «${delegation.invitee_name}»`} wide>
      {!rows ? <Loading /> : rows.length === 0 ? <EmptyState title="لا عمليات بعد" /> : (
        <Table>
          <thead><tr><TH>الوقت</TH><TH>العملية</TH><TH>التغيير</TH><TH>الرصيد بعدها</TH><TH>ملاحظة</TH></tr></thead>
          <tbody>
            {rows.map((l) => (
              <TR key={l.id}>
                <TD className="text-xs text-muted">{formatDateShort(l.created_at)}</TD>
                <TD className="font-semibold">{REASON_AR[l.reason] ?? l.reason}</TD>
                <TD className={cn("font-bold tabular-nums", l.delta > 0 ? "text-success" : l.delta < 0 ? "text-danger" : "text-muted")}>
                  {l.delta > 0 ? `+${l.delta}` : l.delta}
                </TD>
                <TD className="tabular-nums">{l.balance_after ?? "—"}</TD>
                <TD className="text-xs text-muted">{l.note ?? "—"}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </Dialog>
  );
}
