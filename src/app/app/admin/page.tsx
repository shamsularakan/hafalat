"use client";
import * as React from "react";
import { ShieldCheck, LayoutDashboard, Layers, Building2, Palette, Eye, ScrollText, Users as UsersIcon, Search, Save, Trash2, Plus, Ban } from "lucide-react";
import { api } from "@/lib/client";
import { formatNumber, formatDateShort, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Textarea, Select } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { Table, TH, TD, TR } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { Loading, ErrorState, EmptyState, useToast } from "@/components/ui/feedback";

const TABS = [
  { id: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { id: "plans", label: "الباقات", icon: Layers },
  { id: "orgs", label: "العملاء/المؤسسات", icon: Building2 },
  { id: "templates", label: "القوالب العامة", icon: Palette },
  { id: "events", label: "الإشراف على المناسبات", icon: Eye },
  { id: "users", label: "المديرون والمستخدمون", icon: UsersIcon },
  { id: "audit", label: "سجل التدقيق", icon: ScrollText },
];

export default function AdminPage() {
  const [tab, setTab] = React.useState("overview");
  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold"><ShieldCheck className="h-6 w-6 text-lime-400" /> لوحة مدير المنصة</h1>
          <p className="mt-1 text-sm text-muted">إدارة الباقات والعملاء والقوالب العامة والإشراف وسجل التدقيق على مستوى المنصة.</p>
        </div>
        <Badge tone="navy">وصول المدير العام</Badge>
      </div>
      <Tabs
        tabs={TABS.map((t) => ({ id: t.id, label: <span className="flex items-center gap-1.5"><t.icon className="h-4 w-4" />{t.label}</span> }))}
        active={tab}
        onChange={setTab}
      />
      {tab === "overview" && <Overview />}
      {tab === "plans" && <Plans />}
      {tab === "orgs" && <Organizations />}
      {tab === "templates" && <Templates />}
      {tab === "events" && <Events />}
      {tab === "users" && <Users />}
      {tab === "audit" && <Audit />}
    </div>
  );
}

function Overview() {
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    api.get("/api/admin/overview").then(setData).catch((e) => setError(e.message));
  }, []);
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;
  const c = data.counts;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <Stat label="مستخدمون" value={formatNumber(c.users)} tone="navy" />
        <Stat label="مساحة عمل" value={formatNumber(c.organizations)} />
        <Stat label="مناسبات نشطة" value={formatNumber(c.active_events)} tone="lime" />
        <Stat label="ضيوف" value={formatNumber(c.guests)} />
        <Stat label="دعوات" value={formatNumber(c.invitations)} />
        <Stat label="عمليات دخول" value={formatNumber(c.checkins)} />
        <Stat label="قوالب" value={formatNumber(c.templates)} />
        <Stat label="قيود تدقيق" value={formatNumber(c.audit_logs)} />
        <Stat label="مديرو منصة" value={formatNumber(c.admins)} />
        <Stat label="إجمالي المناسبات" value={formatNumber(c.events)} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>توزيع مساحات العمل حسب الباقة</CardTitle></CardHeader>
          <div className="space-y-2">
            {data.plan_usage.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl bg-ivory-soft px-3.5 py-2.5 text-sm">
                <span className="font-bold">{p.name_ar}</span>
                <Badge tone="lime">{formatNumber(p.orgs)} مساحة</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>أحدث المناسبات (كل المؤسسات)</CardTitle></CardHeader>
          <Table>
            <thead><tr><TH>المناسبة</TH><TH>المؤسسة</TH><TH>الحالة</TH><TH>دعوات</TH></tr></thead>
            <tbody>
              {data.recent_events.map((e: any) => (
                <TR key={e.id}>
                  <TD className="max-w-40 truncate font-semibold">{e.title}</TD>
                  <TD className="text-xs text-muted">{e.org_name}</TD>
                  <TD><Badge tone="neutral">{e.status}</Badge></TD>
                  <TD className="tabular-nums">{e.invitations}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
      <Card className="p-0">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">آخر عمليات التدقيق على المنصة</CardTitle></CardHeader>
        <Table>
          <thead><tr><TH>الوقت</TH><TH>العملية</TH><TH>المنفذ</TH><TH>المؤسسة</TH></tr></thead>
          <tbody>
            {data.recent_audit.map((a: any) => (
              <TR key={a.id}>
                <TD className="whitespace-nowrap text-xs text-muted">{formatDateShort(a.created_at)}</TD>
                <TD className="font-semibold" dir="ltr">{a.action}</TD>
                <TD className="text-xs">{a.actor_name ?? "النظام"}</TD>
                <TD className="text-xs text-muted">{a.organization_id === "platform" ? "المنصة" : a.organization_id?.slice(0, 8)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

const PLAN_FIELDS = [
  ["name_ar", "اسم الباقة", "text"],
  ["price_monthly_sar", "السعر الشهري (ر.س)", "number"],
  ["max_active_events", "مناسبات نشطة", "number"],
  ["max_guests_per_event", "ضيوف/مناسبة", "number"],
  ["max_delegates_per_event", "مفوّضون", "number"],
  ["storage_mb", "تخزين MB", "number"],
  ["sort_order", "ترتيب", "number"],
] as const;
const PLAN_BOOLS = [["advanced_templates", "قوالب متقدمة"], ["custom_branding", "علامة مخصصة"], ["multi_seat", "مقاعد متعددة"]] as const;

function Plans() {
  const { show, node } = useToast();
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [editing, setEditing] = React.useState<any>(null);
  const load = React.useCallback(() => api.get<any[]>("/api/admin/plans").then(setRows).catch((e) => show(e.message, "error")), []);
  React.useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4">
      {node}
      <div className="flex justify-end"><Button onClick={() => setEditing({ sort_order: (rows?.length ?? 0) + 1 })}><Plus className="h-4 w-4" /> باقة جديدة</Button></div>
      {!rows ? <Loading /> : (
        <Card className="p-0">
          <Table>
            <thead><tr><TH>الباقة</TH><TH>السعر</TH><TH>مناسبات</TH><TH>ضيوف</TH><TH>مفوّضون</TH><TH>تخزين</TH><TH /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <TR key={p.id}>
                  <TD className="font-bold">{p.name_ar}</TD>
                  <TD className="tabular-nums">{p.price_monthly_sar} ر.س</TD>
                  <TD className="tabular-nums">{p.max_active_events}</TD>
                  <TD className="tabular-nums">{formatNumber(p.max_guests_per_event)}</TD>
                  <TD className="tabular-nums">{p.max_delegates_per_event}</TD>
                  <TD className="tabular-nums">{p.storage_mb} MB</TD>
                  <TD><Button variant="outline" size="sm" onClick={() => setEditing(p)}>تعديل</Button></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      {editing && <PlanDialog plan={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); show("تم حفظ الباقة"); load(); }} />}
    </div>
  );
}

function PlanDialog({ plan, onClose, onSaved }: { plan: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState<any>({ ...plan });
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  async function save() {
    setSaving(true); setError("");
    try { await api.post("/api/admin/plans", form); onSaved(); }
    catch (e: any) { setError(e.message); setSaving(false); }
  }
  return (
    <Dialog open onClose={onClose} title={plan.id ? `تعديل باقة «${plan.name_ar}»` : "باقة جديدة"} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        {PLAN_FIELDS.map(([k, label, type]) => (
          <Field key={k} label={label}><Input type={type} value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></Field>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-ivory-soft p-4">
        {PLAN_BOOLS.map(([k, label]) => (
          <label key={k} className="mb-2 flex cursor-pointer items-center gap-2 text-sm last:mb-0">
            <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)} className="h-4 w-4 accent-lime-500" /> {label}
          </label>
        ))}
      </div>
      {error && <ErrorState message={error} />}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button onClick={save} loading={saving}><Save className="h-4 w-4" /> حفظ</Button>
      </div>
    </Dialog>
  );
}

function Organizations() {
  const { show, node } = useToast();
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [plans, setPlans] = React.useState<any[]>([]);
  const [q, setQ] = React.useState("");
  const load = React.useCallback(() => {
    api.get<any[]>(`/api/admin/organizations?q=${encodeURIComponent(q)}`).then(setRows).catch((e) => show(e.message, "error"));
  }, [q]);
  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { api.get<any[]>("/api/admin/plans").then(setPlans).catch(() => {}); }, []);
  async function change(org: any, planId: string) {
    try { await api.patch("/api/admin/organizations", { org_id: org.id, plan_id: planId }); show("تم تغيير الباقة"); load(); }
    catch (e: any) { show(e.message, "error"); }
  }
  return (
    <div className="space-y-4">
      {node}
      <Input placeholder="بحث باسم المؤسسة أو بريد المالك…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      {!rows ? <Loading /> : rows.length === 0 ? <EmptyState title="لا نتائج" /> : (
        <Card className="p-0">
          <Table>
            <thead><tr><TH>المؤسسة</TH><TH>المالك</TH><TH>الأعضاء</TH><TH>المناسبات</TH><TH>الباقة</TH><TH>تاريخ الإنشاء</TH></tr></thead>
            <tbody>
              {rows.map((o) => (
                <TR key={o.id}>
                  <TD className="font-bold">{o.name}</TD>
                  <TD className="text-xs text-muted">{o.owner_name} · {o.owner_email}</TD>
                  <TD className="tabular-nums">{o.members}</TD>
                  <TD className="tabular-nums">{o.events}</TD>
                  <TD>
                    <Select className="h-9 w-36 text-xs" value={o.plan_id} onChange={(e) => change(o, e.target.value)}>
                      {plans.map((p) => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
                    </Select>
                  </TD>
                  <TD className="text-xs text-muted">{formatDateShort(o.created_at)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function Templates() {
  const { show, node } = useToast();
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [editing, setEditing] = React.useState<any>(null);
  const load = React.useCallback(() => api.get<any[]>("/api/admin/templates").then(setRows).catch((e) => show(e.message, "error")), []);
  React.useEffect(() => { load(); }, [load]);
  async function remove(id: string) {
    try { await api.del(`/api/admin/templates/${id}`); show("تم حذف القالب"); load(); }
    catch (e: any) { show(e.message, "error"); }
  }
  return (
    <div className="space-y-4">
      {node}
      <div className="flex justify-end"><Button onClick={() => setEditing({ visibility: "public", version: 1, schema_json: "{}" })}><Plus className="h-4 w-4" /> قالب جديد</Button></div>
      {!rows ? <Loading /> : (
        <Card className="p-0">
          <Table>
            <thead><tr><TH>القالب</TH><TH>الطراز</TH><TH>الظهور</TH><TH>الإصدار</TH><TH>المؤسسة</TH><TH /></tr></thead>
            <tbody>
              {rows.map((t) => (
                <TR key={t.id}>
                  <TD className="font-bold">{t.name_ar}</TD>
                  <TD className="text-muted">{t.style}</TD>
                  <TD><Badge tone={t.visibility === "public" ? "success" : "neutral"}>{t.visibility === "public" ? "عام" : t.visibility === "organization" ? "مؤسسة" : "مناسبة"}</Badge></TD>
                  <TD className="tabular-nums">{t.version}</TD>
                  <TD className="text-xs text-muted">{t.org_name ?? "—"}</TD>
                  <TD>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>تعديل</Button>
                      <Button variant="ghost" size="sm" className="text-danger" onClick={() => remove(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      {editing && <TemplateDialog tpl={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); show("تم حفظ القالب"); load(); }} />}
    </div>
  );
}

function TemplateDialog({ tpl, onClose, onSaved }: { tpl: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState<any>({
    ...tpl,
    schema_json: typeof tpl.schema_json === "string" ? tpl.schema_json : JSON.stringify(tpl.schema_json ?? {}, null, 2),
  });
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  async function save() {
    setSaving(true); setError("");
    try { await api.post("/api/admin/templates", form); onSaved(); }
    catch (e: any) { setError(e.message); setSaving(false); }
  }
  return (
    <Dialog open onClose={onClose} title={tpl.id ? `تعديل «${tpl.name_ar}»` : "قالب جديد"} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم القالب"><Input value={form.name_ar ?? ""} onChange={(e) => set("name_ar", e.target.value)} /></Field>
        <Field label="الطراز"><Input value={form.style ?? ""} onChange={(e) => set("style", e.target.value)} placeholder="royal, modern…" /></Field>
        <Field label="الظهور">
          <Select value={form.visibility} onChange={(e) => set("visibility", e.target.value)}>
            <option value="public">عام</option><option value="organization">مؤسسة</option><option value="event">مناسبة</option>
          </Select>
        </Field>
        <Field label="الإصدار"><Input type="number" min={1} value={form.version ?? 1} onChange={(e) => set("version", e.target.value)} /></Field>
      </div>
      <div className="mt-4">
        <Field label="مخطط القالب (JSON)" hint="يحوي الألوان/النصوص/الحركة بنفس schema المستخدم في محرر الدعوة">
          <Textarea rows={10} dir="ltr" className="font-mono text-xs text-left" value={form.schema_json ?? "{}"} onChange={(e) => set("schema_json", e.target.value)} />
        </Field>
      </div>
      {error && <ErrorState message={error} />}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button onClick={save} loading={saving}><Save className="h-4 w-4" /> حفظ</Button>
      </div>
    </Dialog>
  );
}

function Events() {
  const { show, node } = useToast();
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [moderating, setModerating] = React.useState<any>(null);
  const load = React.useCallback(() => {
    api.get<any[]>(`/api/admin/events?q=${encodeURIComponent(q)}&status=${status}`).then(setRows).catch((e) => show(e.message, "error"));
  }, [q, status]);
  React.useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4">
      {node}
      <div className="flex flex-wrap gap-2">
        <Input placeholder="بحث باسم المناسبة أو المؤسسة…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          {["draft","ready","published","ongoing","ended","archived","cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>
      {!rows ? <Loading /> : rows.length === 0 ? <EmptyState title="لا مناسبات مطابقة" /> : (
        <Card className="p-0">
          <Table>
            <thead><tr><TH>المناسبة</TH><TH>المؤسسة/المالك</TH><TH>الحالة</TH><TH>ضيوف</TH><TH>دعوات</TH><TH>دخول</TH><TH /></tr></thead>
            <tbody>
              {rows.map((e) => (
                <TR key={e.id}>
                  <TD className="max-w-44 truncate font-bold">{e.title}</TD>
                  <TD className="text-xs text-muted">{e.org_name} · {e.owner_name}</TD>
                  <TD><Badge tone="neutral">{e.status}</Badge></TD>
                  <TD className="tabular-nums">{e.guests}</TD>
                  <TD className="tabular-nums">{e.invitations}</TD>
                  <TD className="tabular-nums">{e.checkins}</TD>
                  <TD><Button variant="outline" size="sm" className="text-danger" onClick={() => setModerating(e)}><Ban className="h-3.5 w-3.5" /> تدخل</Button></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      {moderating && <ModerateDialog ev={moderating} onClose={() => setModerating(null)} onDone={() => { setModerating(null); show("تم التدخل الإشرافي"); load(); }} />}
    </div>
  );
}

function ModerateDialog({ ev, onClose, onDone }: { ev: any; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = React.useState("cancelled");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function submit() {
    setBusy(true); setError("");
    try { await api.patch(`/api/admin/events/${ev.id}`, { status, reason }); onDone(); }
    catch (e: any) { setError(e.message); setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title={`تدخل إشرافي: ${ev.title}`}>
      <div className="space-y-4">
        <p className="rounded-xl bg-brand-orange/5 p-3 text-xs leading-6 text-muted">سيُغيّر حالة المناسبة من «{ev.status}» إلى الحالة المختارة، ويُوثّق سبب التدخل باسمك في سجل التدقيق العام.</p>
        <Field label="الحالة الجديدة">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {["published","ongoing","ended","archived","cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="سبب التدخل (إلزامي)"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: بلاغ مخالفة" /></Field>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button variant="danger" onClick={submit} loading={busy} disabled={!reason.trim()}>تنفيذ التدخل</Button>
        </div>
      </div>
    </Dialog>
  );
}

function Users() {
  const { show, node } = useToast();
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [q, setQ] = React.useState("");
  const load = React.useCallback(() => api.get<any[]>(`/api/admin/users?q=${encodeURIComponent(q)}`).then(setRows).catch((e) => show(e.message, "error")), [q]);
  React.useEffect(() => { load(); }, [load]);
  async function toggle(u: any) {
    try { await api.patch(`/api/admin/users/${u.id}`, { is_platform_admin: !u.is_platform_admin }); show(u.is_platform_admin ? "تم سحب الصلاحية" : "تم منح صلاحية المدير"); load(); }
    catch (e: any) { show(e.message, "error"); }
  }
  return (
    <div className="space-y-4">
      {node}
      <Input placeholder="بحث بالاسم أو البريد…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      {!rows ? <Loading /> : (
        <Card className="p-0">
          <Table>
            <thead><tr><TH>المستخدم</TH><TH>البريد</TH><TH>مساحات العمل</TH><TH>الحالة</TH><TH>مدير المنصة</TH><TH /></tr></thead>
            <tbody>
              {rows.map((u) => (
                <TR key={u.id}>
                  <TD className="font-bold">{u.name}</TD>
                  <TD className="text-xs text-muted" dir="ltr">{u.email ?? u.phone}</TD>
                  <TD className="tabular-nums">{u.orgs}</TD>
                  <TD><Badge tone={u.status === "active" ? "success" : "danger"}>{u.status}</Badge></TD>
                  <TD>{u.is_platform_admin ? <Badge tone="navy">مدير عام</Badge> : <span className="text-xs text-muted">—</span>}</TD>
                  <TD><Button variant="outline" size="sm" onClick={() => toggle(u)}>{u.is_platform_admin ? "سحب الصلاحية" : "منح الصلاحية"}</Button></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function Audit() {
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [q, setQ] = React.useState("");
  const [action, setAction] = React.useState("");
  const load = React.useCallback(() => {
    api.get<any[]>(`/api/admin/audit?q=${encodeURIComponent(q)}&action=${encodeURIComponent(action)}&limit=300`)
      .then(setRows).catch(() => setRows([]));
  }, [q, action]);
  React.useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="بحث في السجل…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Input placeholder="فلترة بالعملية (مثال: platform.)" value={action} onChange={(e) => setAction(e.target.value)} className="max-w-sm" />
      </div>
      {!rows ? <Loading /> : rows.length === 0 ? <EmptyState title="لا قيود مطابقة" /> : (
        <Card className="p-0">
          <Table>
            <thead><tr><TH>الوقت</TH><TH>العملية</TH><TH>المنفذ</TH><TH>المؤسسة</TH><TH>النوع</TH><TH>المعرّف</TH></tr></thead>
            <tbody>
              {rows.map((a) => (
                <TR key={a.id}>
                  <TD className="whitespace-nowrap text-xs text-muted">{formatDateShort(a.created_at)}</TD>
                  <TD className="font-semibold" dir="ltr">{a.action}</TD>
                  <TD className="text-xs">{a.actor_name ?? "النظام"}</TD>
                  <TD className="text-xs text-muted">{a.org_name ?? (a.organization_id === "platform" ? "المنصة" : "—")}</TD>
                  <TD className="text-xs text-muted">{a.object_type ?? "—"}</TD>
                  <TD className="text-[11px] text-muted" dir="ltr">{a.object_id?.slice(0, 12) ?? "—"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
