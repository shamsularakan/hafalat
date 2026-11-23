"use client";
import * as React from "react";
import { Plus, Upload, Download, Search, Pencil, ArrowLeftRight, Users } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { formatDateShort, statusTone } from "@/lib/utils";
import { INVITATION_STATUS_AR } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Table, TH, TD, TR } from "@/components/ui/table";
import { Loading, ErrorState, EmptyState, useToast } from "@/components/ui/feedback";

export default function GuestsPage() {
  const { event, role, groups } = useEvent();
  const { show, node } = useToast();
  const [guests, setGuests] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState("");
  const [q, setQ] = React.useState("");
  const [groupFilter, setGroupFilter] = React.useState("");
  const [sectionFilter, setSectionFilter] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<any>(null);
  const [importing, setImporting] = React.useState(false);
  const [transferring, setTransferring] = React.useState<any>(null);
  const [groupsDialog, setGroupsDialog] = React.useState(false);
  const canManage = ["owner", "manager", "supervisor", "delegate"].includes(role);

  const load = React.useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (groupFilter) params.set("group_id", groupFilter);
    if (sectionFilter) params.set("section", sectionFilter);
    api.get<any[]>(`/api/events/${event.id}/guests?${params}`).then(setGuests).catch((e) => setError(e.message));
  }, [event.id, q, groupFilter, sectionFilter]);
  React.useEffect(load, [load]);

  async function exportCsv() {
    window.open(`/api/events/${event.id}/guests/export`, "_blank");
  }

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4 animate-fade-up">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input className="pr-9" placeholder="بحث بالاسم أو الهاتف…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className="w-32" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} aria-label="تصفية بالقسم">
            <option value="">كل الأقسام</option>
            <option value="men">رجال</option>
            <option value="women">نساء</option>
            <option value="none">بلا قسم</option>
          </Select>
          <Select className="w-40" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} aria-label="تصفية بالفئة">
            <option value="">كل الفئات</option>
            {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setGroupsDialog(true)}><Users className="h-4 w-4" /> الفئات</Button>
            <Button variant="outline" size="sm" onClick={() => setImporting(true)}><Upload className="h-4 w-4" /> إضافة بالجملة</Button>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> تصدير</Button>
            <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> ضيف جديد</Button>
          </div>
        )}
      </div>

      {!guests ? <Loading /> : guests.length === 0 ? (
        <EmptyState title="لا يوجد ضيوف بعد" hint="أضف ضيوفك يدويًا أو استورد ملف CSV مع معاينة وتطهير التكرارات."
          action={canManage ? <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> إضافة ضيف</Button> : undefined} />
      ) : (
        <Card className="p-0">
          <Table>
            <thead>
              <tr><TH>الضيف</TH><TH>الهاتف</TH><TH>القسم</TH><TH>الفئة</TH><TH>الداعي</TH><TH>حالة الدعوة</TH><TH>أضيف</TH>{canManage && <TH />}</tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <TR key={g.id}>
                  <TD className="font-semibold">
                    {g.name}
                    {g.conflict ? <Badge tone="warning" className="mr-2">تعارض</Badge> : null}
                  </TD>
                  <TD dir="ltr" className="text-left text-muted">{g.phone ?? "—"}</TD>
                  <TD>{g.section === "men" ? "رجال" : g.section === "women" ? "نساء" : "—"}</TD>
                  <TD>{g.group_name ?? "—"}</TD>
                  <TD className="text-muted">{g.inviter_name ?? "المالك"}</TD>
                  <TD>
                    {g.invitation_status
                      ? <Badge tone={statusTone(g.invitation_status)}>{INVITATION_STATUS_AR[g.invitation_status as keyof typeof INVITATION_STATUS_AR] ?? g.invitation_status}</Badge>
                      : <span className="text-xs text-muted">بلا دعوة</span>}
                  </TD>
                  <TD className="text-xs text-muted">{formatDateShort(g.created_at)}</TD>
                  {canManage && (
                    <TD>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(g)} aria-label="تعديل"><Pencil className="h-3.5 w-3.5" /></Button>
                        {["owner", "manager"].includes(role) && (
                          <Button variant="ghost" size="icon" onClick={() => setTransferring(g)} aria-label="نقل الملكية"><ArrowLeftRight className="h-3.5 w-3.5" /></Button>
                        )}
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </tbody>
          </Table>
          <p className="px-4 py-2.5 text-xs text-muted">{guests.length} ضيف ضمن نطاق صلاحيتك</p>
        </Card>
      )}

      {adding && <GuestDialog onClose={() => setAdding(false)} onSaved={() => { setAdding(false); show("تمت إضافة الضيف"); load(); }} />}
      {editing && <GuestDialog guest={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); show("تم حفظ التعديلات"); load(); }} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} onDone={() => { setImporting(false); load(); }} />}
      {transferring && <TransferDialog guest={transferring} onClose={() => setTransferring(null)} onDone={() => { setTransferring(null); show("تم نقل ملكية الضيف"); load(); }} />}
      {groupsDialog && <GroupsDialog onClose={() => setGroupsDialog(false)} />}
    </div>
  );
}

function GuestDialog({ guest, onClose, onSaved }: { guest?: any; onClose: () => void; onSaved: () => void }) {
  const { event, groups } = useEvent();
  const [form, setForm] = React.useState({
    name: guest?.name ?? "", phone: guest?.phone ?? "", email: guest?.email ?? "",
    group_id: guest?.group_id ?? "", notes: guest?.notes ?? "", section: guest?.section ?? "",
  });
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true); setError("");
    try {
      const payload = { name: form.name, phone: form.phone || undefined, email: form.email || undefined, group_id: form.group_id || null, notes: form.notes || undefined, section: form.section || null };
      if (guest) await api.patch(`/api/guests/${guest.id}`, payload);
      else await api.post(`/api/events/${event.id}/guests`, payload);
      onSaved();
    } catch (e: any) { setError(e.message); setSaving(false); }
  }

  return (
    <Dialog open onClose={onClose} title={guest ? "تعديل ضيف" : "ضيف جديد"}>
      <div className="space-y-4">
        <Field label="الاسم" htmlFor="g-name"><Input id="g-name" value={form.name} onChange={set("name")} required /></Field>
        <Field label="رقم دولي" htmlFor="g-phone" hint="مثال: +9665xxxxxxxx — يستخدم لتطهير التكرارات">
          <Input id="g-phone" dir="ltr" className="text-left" value={form.phone} onChange={set("phone")} placeholder="+9665…" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="البريد (اختياري)" htmlFor="g-email"><Input id="g-email" dir="ltr" className="text-left" value={form.email} onChange={set("email")} /></Field>
          <Field label="القسم" htmlFor="g-section" hint="يحدد كميات أكياس العبايات وتوزيع الطاولات">
            <Select id="g-section" value={form.section} onChange={set("section")}>
              <option value="">غير محدد</option>
              <option value="men">رجال</option>
              <option value="women">نساء</option>
            </Select>
          </Field>
          <Field label="الفئة" htmlFor="g-group">
            <Select id="g-group" value={form.group_id} onChange={set("group_id")}>
              <option value="">بلا فئة</option>
              {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name} (مرافقون ≤ {g.companion_max})</option>)}
            </Select>
          </Field>
        </div>
        <Field label="ملاحظات"><Textarea value={form.notes} onChange={set("notes")} /></Field>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} loading={saving}>{guest ? "حفظ" : "إضافة"}</Button>
        </div>
      </div>
    </Dialog>
  );
}

function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [csv, setCsv] = React.useState("");
  const [filename, setFilename] = React.useState("");
  const [preview, setPreview] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const text = await file.text();
    setCsv(text);
    setPreview(null);
    setError("");
    setBusy(true);
    try {
      const p = await api.post(`/api/events/${event.id}/guests/import`, { csv: text, dryRun: true, filename: file.name });
      setPreview(p);
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  }

  const [pasted, setPasted] = React.useState("");
  /** كل سطر: الاسم، الجوال، القسم (رجال/نساء) — يُحوَّل إلى CSV ويمر بنفس المعاينة وتطهير التكرارات */
  async function previewPasted() {
    const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = pasted.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      .map((l) => l.split(/[,،\t]/).map((c) => c.trim()))
      .map(([name = "", phone = "", section = ""]) => [name, phone, section].map(quote).join(","));
    if (rows.length === 0) return;
    const text = ["الاسم,الهاتف,القسم", ...rows].join("\n");
    setCsv(text); setFilename("لصق-أسماء"); setPreview(null); setError(""); setBusy(true);
    try { setPreview(await api.post(`/api/events/${event.id}/guests/import`, { csv: text, dryRun: true, filename: "لصق-أسماء" })); }
    catch (e: any) { setError(e.message); }
    setBusy(false);
  }

  async function confirm() {
    setBusy(true); setError("");
    try {
      const res = await api.post<any>(`/api/events/${event.id}/guests/import`, { csv, dryRun: false, filename });
      show(`تم إدخال ${res.inserted} ضيفًا بنجاح`);
      onDone();
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  const toneOf = (s: string) => s === "ok" ? "success" : s === "error" ? "danger" : "warning";
  const labelOf = (s: string) => s === "ok" ? "سليم" : s === "duplicate_existing" ? "مكرر (موجود)" : s === "duplicate_file" ? "مكرر (بالملف)" : "خطأ";

  return (
    <Dialog open onClose={onClose} title="إضافة ضيوف بالجملة" wide>
      {node}
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="bulk-paste" className="block text-sm font-semibold">الصق القائمة — سطر لكل ضيف: الاسم، الجوال، القسم</label>
          <textarea id="bulk-paste" dir="rtl" rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)}
            placeholder={"محمد العتيبي، +966501234567، رجال\nنورة القحطاني، +966507654321، نساء"}
            className="w-full rounded-xl border border-navy-950/15 bg-white px-3.5 py-2.5 text-base focus:border-lime-500 focus:outline-none focus:ring-2 focus:ring-lime-400/30 sm:text-sm" />
          <Button variant="outline" size="sm" onClick={previewPasted} disabled={!pasted.trim() || busy}>معاينة الأسماء</Button>
        </div>
        <p className="text-center text-xs font-bold text-muted">أو ارفع ملف CSV (يقبل عمود «القسم»)</p>
        <div className="rounded-xl border border-dashed border-navy-950/20 bg-ivory-soft p-5 text-center">
          <Upload className="mx-auto mb-2 h-6 w-6 text-muted" />
          <p className="mb-1 text-sm font-bold">اختر ملف CSV (UTF-8)</p>
          <p className="mb-3 text-xs text-muted">الأعمدة المتوقعة: الاسم، الهاتف، البريد، الفئة، ملاحظات — بأسماء عربية أو إنجليزية</p>
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="mx-auto block cursor-pointer text-sm file:mr-0 file:ml-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-navy-950 file:px-4 file:py-2 file:text-sm file:font-bold file:text-lime-400" />
        </div>
        {busy && !preview && <Loading label="جارٍ تحليل الملف…" />}
        {error && <ErrorState message={error} />}
        {preview && (
          <>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-xl bg-navy-950/5 p-3"><p className="text-lg font-extrabold">{preview.total}</p><p className="text-xs text-muted">صف</p></div>
              <div className="rounded-xl bg-success/10 p-3"><p className="text-lg font-extrabold text-success">{preview.ok}</p><p className="text-xs text-muted">سليم</p></div>
              <div className="rounded-xl bg-brand-orange/10 p-3"><p className="text-lg font-extrabold text-brand-orange">{preview.duplicates}</p><p className="text-xs text-muted">مكرر</p></div>
              <div className="rounded-xl bg-danger/10 p-3"><p className="text-lg font-extrabold text-danger">{preview.errors}</p><p className="text-xs text-muted">خطأ</p></div>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-navy-950/8">
              <Table>
                <thead><tr><TH>صف</TH><TH>الاسم</TH><TH>الهاتف</TH><TH>الحالة</TH><TH>السبب</TH></tr></thead>
                <tbody>
                  {preview.results.map((r: any) => (
                    <TR key={r.row}>
                      <TD className="text-muted">{r.row}</TD>
                      <TD className="font-semibold">{r.name || "—"}</TD>
                      <TD dir="ltr" className="text-left text-muted">{r.phone || "—"}</TD>
                      <TD><Badge tone={toneOf(r.status)}>{labelOf(r.status)}</Badge></TD>
                      <TD className="text-xs text-muted">{r.reason ?? "—"}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>إلغاء</Button>
              <Button onClick={confirm} loading={busy} disabled={preview.ok === 0}>تأكيد إدخال {preview.ok} ضيفًا</Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

function TransferDialog({ guest, onClose, onDone }: { guest: any; onClose: () => void; onDone: () => void }) {
  const { event } = useEvent();
  const [delegations, setDelegations] = React.useState<any[]>([]);
  const [to, setTo] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    api.get<any[]>(`/api/events/${event.id}/delegations`).then(setDelegations).catch((e) => setError(e.message));
  }, [event.id]);

  async function submit() {
    setBusy(true); setError("");
    try {
      await api.post(`/api/guests/${guest.id}/transfer`, { to_delegation_id: to || null });
      onDone();
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  return (
    <Dialog open onClose={onClose} title={`نقل ملكية «${guest.name}»`}>
      <div className="space-y-4">
        <p className="text-sm leading-6 text-muted">الداعي الأصلي يبقى محفوظًا في التقارير، والدعوات الصادرة تبقى مسندة لمصدرها.</p>
        <Field label="المفوّض المستلم">
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">المالك (بلا مفوّض)</option>
            {delegations.filter((d) => d.status === "active").map((d) => <option key={d.id} value={d.id}>{d.invitee_name}</option>)}
          </Select>
        </Field>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} loading={busy}>نقل</Button>
        </div>
      </div>
    </Dialog>
  );
}

function GroupsDialog({ onClose }: { onClose: () => void }) {
  const { event, groups, refresh } = useEvent();
  const { show, node } = useToast();
  const [name, setName] = React.useState("");
  const [companionMax, setCompanionMax] = React.useState(0);
  const [isVip, setIsVip] = React.useState(false);
  const [error, setError] = React.useState("");

  async function add() {
    setError("");
    try {
      await api.post(`/api/events/${event.id}/groups`, { name, companion_max: Number(companionMax), is_vip: isVip });
      setName(""); setCompanionMax(0); setIsVip(false);
      await refresh();
      show("تمت إضافة الفئة");
    } catch (e: any) { setError(e.message); }
  }

  async function update(g: any, patch: any) {
    try {
      await api.patch(`/api/groups/${g.id}`, patch);
      await refresh();
    } catch (e: any) { show(e.message, "error"); }
  }

  return (
    <Dialog open onClose={onClose} title="فئات المدعوين وسياسة المرافقين">
      {node}
      <div className="space-y-4">
        <div className="space-y-2">
          {groups.map((g: any) => (
            <div key={g.id} className="flex items-center justify-between gap-3 rounded-xl border border-navy-950/8 p-3">
              <div>
                <p className="text-sm font-bold">{g.name} {g.is_vip ? <Badge tone="lime">VIP</Badge> : null}</p>
                <p className="text-xs text-muted">حد المرافقين: {g.companion_max}</p>
              </div>
              <Input type="number" min={0} max={20} dir="ltr" className="w-20" defaultValue={g.companion_max}
                onBlur={(e) => Number(e.target.value) !== g.companion_max && update(g, { name: g.name, companion_max: Number(e.target.value), is_vip: !!g.is_vip })}
                aria-label={`حد مرافقي ${g.name}`} />
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-ivory-soft p-4">
          <p className="mb-3 text-sm font-bold">فئة جديدة</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الاسم"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: زملاء العمل" /></Field>
            <Field label="حد المرافقين"><Input type="number" min={0} max={20} dir="ltr" value={companionMax} onChange={(e) => setCompanionMax(Number(e.target.value))} /></Field>
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isVip} onChange={(e) => setIsVip(e.target.checked)} className="h-4 w-4 accent-lime-500" /> فئة VIP
          </label>
          {error && <p className="mt-2 text-xs font-bold text-danger">{error}</p>}
          <Button className="mt-3" size="sm" onClick={add} disabled={!name.trim()}><Plus className="h-4 w-4" /> إضافة</Button>
        </div>
      </div>
    </Dialog>
  );
}
