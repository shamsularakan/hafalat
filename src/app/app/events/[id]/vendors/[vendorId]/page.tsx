"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Phone, Mail, MapPin, FileText, ReceiptText, Pencil, Download } from "lucide-react";
import { api } from "@/lib/client";
import { formatNumber, formatDateShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Loading, ErrorState, useToast } from "@/components/ui/feedback";

const STATUS: Record<string, string> = { potential: "محتمل", contacted: "تم التواصل", contracted: "متعاقد", done: "منفذ" };
const ATYPE: Record<string, string> = { contract: "عقد", quote: "عرض سعر", invoice: "فاتورة", photo: "صورة", other: "أخرى" };

export default function VendorDetailPage() {
  const { id, vendorId } = useParams<{ id: string; vendorId: string }>();
  const { show, node } = useToast();
  const [vendor, setVendor] = React.useState<any>(null);
  const [expenses, setExpenses] = React.useState<any[]>([]);
  const [docs, setDocs] = React.useState<any[]>([]);
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(() => {
    Promise.all([
      api.get<any[]>(`/api/events/${id}/vendors`),
      api.get<any[]>(`/api/events/${id}/expenses`),
      api.get<any[]>(`/api/events/${id}/attachments`),
    ]).then(([v, e, a]) => {
      const found = v.find((x) => x.id === vendorId);
      if (!found) { setError("المورد غير موجود"); return; }
      setVendor(found);
      setExpenses(e.filter((x) => x.vendor_id === vendorId));
      setDocs(a.filter((x) => x.vendor_id === vendorId));
    }).catch((e) => setError(e.message));
  }, [id, vendorId]);
  React.useEffect(load, [load]);

  if (error) return <ErrorState message={error} />;
  if (!vendor) return <Loading />;
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/app/events/${id}/vendors`} className="flex items-center gap-1.5 text-sm font-bold text-muted hover:text-navy-950">
          <ArrowRight className="h-4 w-4" /> العودة للموردين
        </Link>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> تعديل</Button>
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted">{vendor.category}</p>
            <h2 className="mt-1 text-2xl font-extrabold">{vendor.name}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={vendor.status === "contracted" ? "success" : "neutral"}>{STATUS[vendor.status] ?? vendor.status}</Badge>
              {vendor.contact_name && <Badge tone="lime">{vendor.contact_name}</Badge>}
            </div>
          </div>
          <div className="space-y-1.5 text-sm text-muted">
            {vendor.phone && <p className="flex items-center gap-2" dir="ltr"><Phone className="h-4 w-4" /> {vendor.phone}</p>}
            {vendor.email && <p className="flex items-center gap-2" dir="ltr"><Mail className="h-4 w-4" /> {vendor.email}</p>}
            {vendor.address && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {vendor.address}</p>}
          </div>
        </div>
        {vendor.notes && <p className="mt-4 rounded-xl bg-ivory-soft p-3 text-sm leading-7 text-muted">{vendor.notes}</p>}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="إجمالي المصروفات" value={formatNumber(total)} hint="ر.س" tone="navy" />
        <Stat label="المرفقات والعقود" value={docs.length} tone="lime" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-0">
          <CardHeader className="p-4 pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ReceiptText className="h-4 w-4" /> المصروفات المرتبطة</CardTitle></CardHeader>
          {expenses.length === 0 ? <p className="p-5 text-sm text-muted">لا مصروفات مسجلة لهذا المورد.</p> : (
            <div className="divide-y divide-navy-950/6">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-semibold">{e.title}</span>
                  <span className="tabular-nums">{formatNumber(e.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-0">
          <CardHeader className="p-4 pb-2"><CardTitle className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4" /> العقود والمرفقات</CardTitle></CardHeader>
          {docs.length === 0 ? <p className="p-5 text-sm text-muted">لا مرفقات لهذا المورد.</p> : (
            <div className="divide-y divide-navy-950/6">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{d.title}</p><p className="text-xs text-muted">{ATYPE[d.kind] ?? d.kind} · {formatDateShort(d.created_at)}</p></div>
                  <a href={`/api/events/${id}/attachments/${d.id}`} target="_blank" rel="noreferrer"><Button variant="ghost" size="icon"><Download className="h-3.5 w-3.5" /></Button></a>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {editing && <EditDialog vendor={vendor} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); show("تم حفظ المورد"); load(); }} />}
    </div>
  );
}

function EditDialog({ vendor, onClose, onSaved }: any) {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = React.useState<any>({ ...vendor });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  async function save() {
    try { await api.patch(`/api/vendors/${vendor.id}`, form); onSaved(); }
    catch (e: any) { /* ignored */ }
  }
  return (
    <Dialog open onClose={onClose} title={`تعديل ${vendor.name}`} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="الفئة"><Input value={form.category} onChange={(e) => set("category", e.target.value)} /></Field>
        <Field label="اسم التواصل"><Input value={form.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} /></Field>
        <Field label="الهاتف"><Input dir="ltr" className="text-left" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="البريد"><Input dir="ltr" className="text-left" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="الحالة">
          <select value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full rounded-xl border border-navy-950/15 bg-white px-3 py-2.5 text-sm">
            <option value="potential">محتمل</option><option value="contacted">تم التواصل</option><option value="contracted">متعاقد</option><option value="done">منفذ</option>
          </select>
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={save}>حفظ</Button></div>
    </Dialog>
  );
}
