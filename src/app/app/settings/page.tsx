"use client";
import * as React from "react";
import { Settings, Users, ScrollText, MessageSquareText, Save, UserPlus } from "lucide-react";
import { api } from "@/lib/client";
import { formatDateShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import { Table, TH, TD, TR } from "@/components/ui/table";
import { Loading, ErrorState, EmptyState, useToast } from "@/components/ui/feedback";

const ACTION_AR: Record<string, string> = {
  "org.create": "إنشاء مساحة عمل", "org.update": "تعديل مساحة العمل", "org.member_add": "إضافة عضو مؤسسة",
  "event.create": "إنشاء مناسبة", "event.update": "تعديل مناسبة", "event.status": "تغيير حالة مناسبة",
  "event.clone": "نسخ مناسبة", "event.member_add": "تكليف طاقم",
  "delegation.create": "إنشاء تفويض", "delegation.update": "تعديل تفويض", "delegation.suspend": "إيقاف/إلغاء تفويض",
  "quota.reallocate": "إعادة تخصيص حصة", "invitation.issue": "إصدار دعوة", "invitation.cancel": "إلغاء دعوة",
  "guest.import": "استيراد ضيوف", "guest.transfer": "نقل ملكية ضيف", "delivery.manual": "إرسال يدوي",
  "checkin.scan": "مسح دخول", "checkin.manual": "دخول يدوي مبرر", "design.publish": "نشر تصميم",
  "media.upload": "رفع وسائط", "media.delete": "حذف وسائط", "billing.checkout": "اشتراك/فوترة",
};

export default function SettingsPage() {
  const [tab, setTab] = React.useState("org");
  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><Settings className="h-6 w-6 text-muted" /> الإعدادات والسجلات</h1>
        <p className="mt-1 text-sm text-muted">مساحة العمل، الأعضاء، قوالب الرسائل، وسجل التدقيق.</p>
      </div>
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "org", label: "مساحة العمل" },
        { id: "members", label: "الأعضاء" },
        { id: "messages", label: "قوالب الرسائل" },
        { id: "audit", label: "سجل التدقيق" },
      ]} />
      {tab === "org" && <OrgTab />}
      {tab === "members" && <MembersTab />}
      {tab === "messages" && <MessagesTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}

function OrgTab() {
  const { show, node } = useToast();
  const [org, setOrg] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    api.get<any>("/api/org").then((d) => setOrg(d.org)).catch((e) => setError(e.message));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.patch("/api/org", {
        name: org.name, contact_email: org.contact_email, contact_phone: org.contact_phone,
        retention_days: Number(org.retention_days),
      });
      show("تم حفظ الإعدادات");
    } catch (e: any) { show(e.message, "error"); }
    setSaving(false);
  }

  if (error) return <ErrorState message={error} />;
  if (!org) return <Loading />;

  return (
    <Card className="max-w-2xl space-y-4">
      {node}
      <Field label="اسم مساحة العمل"><Input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="بريد التواصل"><Input dir="ltr" className="text-left" value={org.contact_email ?? ""} onChange={(e) => setOrg({ ...org, contact_email: e.target.value })} /></Field>
        <Field label="هاتف التواصل"><Input dir="ltr" className="text-left" value={org.contact_phone ?? ""} onChange={(e) => setOrg({ ...org, contact_phone: e.target.value })} /></Field>
      </div>
      <Field label="مدة الاحتفاظ بالبيانات (يوم)" hint="سياسة الخصوصية والاحتفاظ تُراجع وفق PDPL قبل الإطلاق — الحد الأدنى 30 يومًا">
        <Input type="number" min={30} max={3650} dir="ltr" value={org.retention_days} onChange={(e) => setOrg({ ...org, retention_days: e.target.value })} />
      </Field>
      <div className="rounded-xl bg-ivory-soft p-4 text-xs leading-6 text-muted">
        <p className="mb-1 font-bold text-navy-950">الخصوصية والامتثال</p>
        أسماء المدعوين وأرقامهم وردودهم بيانات شخصية: نجمع الحد الأدنى لغرض الدعوة فقط، بعزل كامل بين المؤسسات،
        ورموز غير قابلة للتخمين، وسجلات تدقيق. حذف/تصدير البيانات وفق المتطلبات النظامية يتم عبر الدعم حاليًا،
        وسيُؤتمت في مرحلة التشغيل.
      </div>
      <Button onClick={save} loading={saving}><Save className="h-4 w-4" /> حفظ</Button>
    </Card>
  );
}

function MembersTab() {
  const { show, node } = useToast();
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(() => {
    api.get<any>("/api/org").then(setData).catch((e) => setError(e.message));
  }, []);
  React.useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loading />;
  const canManage = ["owner", "admin"].includes(data.my_role);

  return (
    <Card className="max-w-3xl p-0">
      {node}
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4" /> أعضاء المؤسسة</CardTitle>
        {canManage && <Button size="sm" onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" /> إضافة</Button>}
      </CardHeader>
      <div className="divide-y divide-navy-950/6">
        {data.members.map((m: any) => (
          <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{m.name}</p>
              <p className="truncate text-xs text-muted" dir="ltr">{m.email ?? m.phone}</p>
            </div>
            <Badge tone={m.role === "owner" ? "navy" : m.role === "admin" ? "lime" : "neutral"}>
              {m.role === "owner" ? "مالك" : m.role === "admin" ? "مشرف" : "عضو"}
            </Badge>
          </div>
        ))}
      </div>
      <p className="px-4 py-3 text-[11px] leading-5 text-muted">
        أدوار المنظمة مستقلة عن أدوار المناسبة. المفوّضون وموظفو الاستقبال يُضافون من صفحة المناسبة نفسها،
        ويحصلون تلقائيًا على عضوية «عضو» هنا للوصول المعزول.
      </p>
      {adding && <AddOrgMember onClose={() => setAdding(false)} onDone={() => { setAdding(false); show("تمت إضافة العضو"); load(); }} />}
    </Card>
  );
}

function AddOrgMember({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("member");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    setBusy(true); setError("");
    try {
      await api.post("/api/org/members", { email, role });
      onDone();
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  return (
    <Dialog open onClose={onClose} title="إضافة عضو مؤسسة">
      <div className="space-y-4">
        <Field label="بريد المستخدم المسجل"><Input dir="ltr" className="text-left" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="الدور" hint="مشرف المؤسسة يتطلب باقة الشركات">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="member">عضو</option>
            <option value="admin">مشرف مؤسسة</option>
          </Select>
        </Field>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} loading={busy} disabled={!email.trim()}>إضافة</Button>
        </div>
      </div>
    </Dialog>
  );
}

function MessagesTab() {
  const { show, node } = useToast();
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [name, setName] = React.useState("");
  const [body, setBody] = React.useState("");

  const load = React.useCallback(() => {
    api.get<any[]>("/api/message-templates").then(setRows).catch(() => setRows([]));
  }, []);
  React.useEffect(load, [load]);

  async function add() {
    try {
      await api.post("/api/message-templates", { name, body });
      setName(""); setBody("");
      show("تم حفظ القالب");
      load();
    } catch (e: any) { show(e.message, "error"); }
  }

  return (
    <div className="grid max-w-4xl gap-5 lg:grid-cols-2">
      {node}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><MessageSquareText className="h-4 w-4" /> القوالب المحفوظة</CardTitle></CardHeader>
        {!rows ? <Loading /> : rows.length === 0 ? <EmptyState title="لا قوالب بعد" hint="احفظ نصوصًا جاهزة بمعاملات لتسريع الإرسال." /> : (
          <div className="space-y-2">
            {rows.map((t) => (
              <div key={t.id} className="rounded-xl border border-navy-950/8 p-3">
                <p className="text-sm font-bold">{t.name}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-muted">{t.body}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card className="space-y-3">
        <CardTitle className="text-sm">قالب جديد</CardTitle>
        <Field label="الاسم"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: تذكير قبل المناسبة" /></Field>
        <Field label="النص" hint={"المعاملات: {اسم_الضيف} · {رابط_الدعوة} · {اسم_المناسبة}"}>
          <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Button onClick={add} disabled={!name.trim() || !body.trim()}><Save className="h-4 w-4" /> حفظ القالب</Button>
      </Card>
    </div>
  );
}

function AuditTab() {
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    api.get<any[]>("/api/audit?limit=200").then(setRows).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!rows) return <Loading />;

  return (
    <Card className="p-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><ScrollText className="h-4 w-4" /> سجل التدقيق (آخر 200 عملية)</CardTitle>
      </CardHeader>
      {rows.length === 0 ? <EmptyState title="لا عمليات مسجلة" /> : (
        <Table>
          <thead><tr><TH>الوقت</TH><TH>العملية</TH><TH>المنفذ</TH><TH>الكائن</TH><TH>تفاصيل</TH></tr></thead>
          <tbody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap text-xs text-muted">{formatDateShort(r.created_at)}</TD>
                <TD className="font-semibold">{ACTION_AR[r.action] ?? r.action}</TD>
                <TD className="text-xs">{r.actor_name ?? "النظام"}</TD>
                <TD className="text-xs text-muted">{r.object_type ?? "—"}</TD>
                <TD className="max-w-64 truncate text-[11px] text-muted" dir="ltr">{r.detail_json ?? "—"}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
      <p className="px-4 py-3 text-[11px] text-muted">لا تُسجل رموز الدعوات الخام أو محتوى الرسائل الحساس في السجل.</p>
    </Card>
  );
}
