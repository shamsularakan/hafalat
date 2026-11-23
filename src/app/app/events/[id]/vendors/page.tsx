"use client";
import * as React from "react";
import { Plus, Trash2, Pencil, Upload, Download, FileText, ListChecks, Check } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { formatNumber, formatDateShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import { Table, TH, TD, TR } from "@/components/ui/table";
import { Loading, ErrorState, useToast } from "@/components/ui/feedback";
import { VendorCatalog } from "@/components/vendor-catalog";
import { VendorDirectory } from "@/components/vendor-directory";
import { Stars } from "@/components/planning-widgets";

const VSTATUS: Record<string, string> = { potential: "محتمل", contacted: "تم التواصل", contracted: "متعاقد", done: "منفذ" };
const ATYPE: Record<string, string> = { contract: "عقد", quote: "عرض سعر", invoice: "فاتورة", photo: "صورة", other: "أخرى" };

export default function VendorsPage() {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [tab, setTab] = React.useState("vendors");
  const [vendors, setVendors] = React.useState<any[] | null>(null);
  const [attachments, setAttachments] = React.useState<any[]>([]);
  const [checklists, setChecklists] = React.useState<any[]>([]);
  const [editing, setEditing] = React.useState<any>(null);
  const [uploading, setUploading] = React.useState(false);
  const [listDialog, setListDialog] = React.useState(false);
  const [error, setError] = React.useState("");
  const load = React.useCallback(() => {
    api.get<any[]>(`/api/events/${event.id}/vendors`).then(setVendors).catch((e) => setError(e.message));
    api.get<any[]>(`/api/events/${event.id}/attachments`).then(setAttachments).catch(() => {});
    api.get<any[]>(`/api/events/${event.id}/checklists`).then(setChecklists).catch(() => {});
  }, [event.id]);
  React.useEffect(load, [load]);
  async function removeVendor(id: string) {
    try { await api.del(`/api/vendors/${id}`); show("تم حذف المورد"); load(); } catch (e: any) { show(e.message, "error"); }
  }
  async function removeAttachment(id: string) {
    try { await api.del(`/api/events/${event.id}/attachments/${id}`); show("تم حذف المرفق"); load(); } catch (e: any) { show(e.message, "error"); }
  }
  const done = (id: string, v: boolean) => api.post(`/api/checklist-items/${id}`, { done: v }).then(load).catch((e) => show(e.message, "error"));
  const addItem = (listId: string, text: string) => { if (!text.trim()) return; api.post(`/api/checklist-items/${listId}`, { text }).then(load).catch((e: any) => show(e.message, "error")); };

  if (error) return <ErrorState message={error} onRetry={load} />;
  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "vendors", label: "الموردون والخدمات" },
        { id: "directory", label: "دليل الموردين" },
        { id: "catalog", label: "منتجات الموردين" },
        { id: "attachments", label: "العقود والمرفقات" },
        { id: "checklists", label: "قوائم التجهيز" },
      ]} />

      {tab === "vendors" && (
        <Card className="p-0">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">الموردون</CardTitle><Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4" /> مورد جديد</Button></CardHeader>
          {!vendors ? <Loading /> : vendors.length === 0 ? <p className="p-6 text-center text-sm text-muted">لا موردون بعد.</p> : (
            <Table>
              <thead><tr><TH>المورد</TH><TH>الفئة</TH><TH>التواصل</TH><TH>الحالة</TH><TH>التقييم</TH><TH>مصروفات</TH><TH /></tr></thead>
              <tbody>
                {vendors.map((v) => (
                  <TR key={v.id}>
                    <TD className="font-bold">{v.name}</TD>
                    <TD className="text-xs text-muted">{v.category}</TD>
                    <TD className="text-xs text-muted" dir="ltr">{v.phone ?? v.email ?? "—"}</TD>
                    <TD><Badge tone={v.status === "contracted" ? "success" : v.status === "done" ? "lime" : "neutral"}>{VSTATUS[v.status] ?? v.status}</Badge></TD>
                    <TD>{v.rating ? <Stars value={v.rating} label={`تقييم ${v.name}`} /> : <span className="text-xs text-muted">—</span>}</TD>
                    <TD className="tabular-nums">{v.expenses}</TD>
                    <TD><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => setEditing(v)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="text-danger" onClick={() => removeVendor(v.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "directory" && <VendorDirectory onLinked={load} />}
      {tab === "catalog" && <VendorCatalog />}

      {tab === "attachments" && (
        <Card className="p-0">
          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">العقود والمرفقات</CardTitle><Button size="sm" onClick={() => setUploading(true)}><Upload className="h-4 w-4" /> رفع ملف</Button></CardHeader>
          {attachments.length === 0 ? <p className="p-6 text-center text-sm text-muted">لا مرفقات بعد — ارفع عقدًا أو عرض سعر أو صورة.</p> : (
            <Table>
              <thead><tr><TH>العنوان</TH><TH>النوع</TH><TH>المورد</TH><TH>الحجم</TH><TH>التاريخ</TH><TH /></tr></thead>
              <tbody>
                {attachments.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-semibold">{a.title}</TD>
                    <TD><Badge tone="neutral">{ATYPE[a.kind] ?? a.kind}</Badge></TD>
                    <TD className="text-xs text-muted">{a.vendor_name ?? "—"}</TD>
                    <TD className="text-xs tabular-nums">{formatNumber(Math.round(a.bytes / 1024))} KB</TD>
                    <TD className="text-xs text-muted">{formatDateShort(a.created_at)}</TD>
                    <TD><div className="flex gap-1"><a href={`/api/events/${event.id}/attachments/${a.id}`} target="_blank" rel="noreferrer"><Button variant="ghost" size="icon"><Download className="h-3.5 w-3.5" /></Button></a><Button variant="ghost" size="icon" className="text-danger" onClick={() => removeAttachment(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "checklists" && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={() => setListDialog(true)}><Plus className="h-4 w-4" /> قائمة جديدة</Button></div>
          {checklists.length === 0 ? <Card><p className="py-10 text-center text-sm text-muted">لا قوائم تجهيز — طبّق قالب تخطيط من مركز التخطيط لإنشاء القوائم تلقائيًا.</p></Card> : (
            <div className="grid gap-4 lg:grid-cols-2">
              {checklists.map((c) => {
                const doneCount = c.items.filter((i: any) => i.done).length;
                return (
                  <Card key={c.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm"><ListChecks className="h-4 w-4" /> {c.name}</CardTitle>
                      <Badge tone="lime">{doneCount}/{c.items.length}</Badge>
                    </CardHeader>
                    <div className="space-y-1.5">
                      {c.items.map((it: any) => (
                        <div key={it.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ivory-soft">
                          <button onClick={() => done(it.id, !it.done)} className={it.done ? "text-success" : "text-muted"} aria-label="تبديل">
                            <Check className="h-4 w-4" />
                          </button>
                          <span className={it.done ? "flex-1 text-sm text-muted line-through" : "flex-1 text-sm"}>{it.text}</span>
                          <button onClick={() => api.del(`/api/checklist-items/${it.id}`).then(load)} className="text-muted" aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                      <ItemAdder listId={c.id} onAdd={addItem} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {editing && <VendorDialog data={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {uploading && (vendors ?? []).length >= 0 && <UploadDialog vendors={vendors ?? []} onClose={() => setUploading(false)} onSaved={() => { setUploading(false); load(); }} />}
      {listDialog && <NewListDialog onClose={() => setListDialog(false)} onSaved={() => { setListDialog(false); load(); }} />}
    </div>
  );
}

function ItemAdder({ listId, onAdd }: { listId: string; onAdd: (id: string, text: string) => void }) {
  const [text, setText] = React.useState("");
  return (
    <div className="flex gap-2 pt-2">
      <Input className="h-9" placeholder="أضف عنصرًا…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { onAdd(listId, text); setText(""); } }} />
      <Button size="sm" onClick={() => { onAdd(listId, text); setText(""); }} disabled={!text.trim()}><Plus className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

function VendorDialog({ data, onClose, onSaved }: any) {
  const { event } = useEvent();
  const { show } = useToast();
  const [form, setForm] = React.useState<any>({ name: data.name ?? "", category: data.category ?? "", contact_name: data.contact_name ?? "", phone: data.phone ?? "", email: data.email ?? "", address: data.address ?? "", status: data.status ?? "potential", notes: data.notes ?? "" });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  async function save() {
    try {
      if (data.id) await api.patch(`/api/vendors/${data.id}`, form);
      else await api.post(`/api/events/${event.id}/vendors`, form);
      show("تم حفظ المورد"); onSaved();
    } catch (e: any) { show(e.message, "error"); }
  }
  return (
    <Dialog open onClose={onClose} title={data.id ? "تعديل المورد" : "مورد جديد"} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="الفئة"><Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="قاعة، مصور، مطعم…" /></Field>
        <Field label="اسم التواصل"><Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} /></Field>
        <Field label="الهاتف"><Input dir="ltr" className="text-left" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="البريد"><Input dir="ltr" className="text-left" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="الحالة"><Select value={form.status} onChange={(e) => set("status", e.target.value)}><option value="potential">محتمل</option><option value="contacted">تم التواصل</option><option value="contracted">متعاقد</option><option value="done">منفذ</option></Select></Field>
      </div>
      <div className="mt-4"><Field label="العنوان/ملاحظات"><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field></div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={save}>حفظ</Button></div>
    </Dialog>
  );
}

function UploadDialog({ vendors, onClose, onSaved }: any) {
  const { event } = useEvent();
  const { show } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [kind, setKind] = React.useState("contract");
  const [title, setTitle] = React.useState("");
  const [vendorId, setVendorId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function upload() {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("kind", kind); fd.append("title", title || file.name);
    if (vendorId) fd.append("vendor_id", vendorId);
    try { await api.form(`/api/events/${event.id}/attachments`, fd); show("تم رفع المرفق"); onSaved(); }
    catch (e: any) { show(e.message, "error"); setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title="رفع مرفق">
      <div className="space-y-4">
        <Field label="الملف"><Input type="file" className="p-2" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="النوع"><Select value={kind} onChange={(e) => setKind(e.target.value)}><option value="contract">عقد</option><option value="quote">عرض سعر</option><option value="invoice">فاتورة</option><option value="photo">صورة</option><option value="other">أخرى</option></Select></Field>
          <Field label="المورد"><Select value={vendorId} onChange={(e) => setVendorId(e.target.value)}><option value="">بدون</option>{vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
        </div>
        <Field label="العنوان"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اختياري" /></Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={upload} loading={busy} disabled={!file}>رفع</Button></div>
      </div>
    </Dialog>
  );
}

function NewListDialog({ onClose, onSaved }: any) {
  const { event } = useEvent();
  const [name, setName] = React.useState("");
  async function save() {
    try { await api.post(`/api/events/${event.id}/checklists`, { name }); onSaved(); } catch (e: any) { /* ignored */ }
  }
  return (
    <Dialog open onClose={onClose} title="قائمة تجهيز جديدة">
      <div className="space-y-4"><Field label="اسم القائمة"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: تجهيزات يوم الزفاف" /></Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={save} disabled={!name.trim()}>إنشاء</Button></div></div>
    </Dialog>
  );
}
