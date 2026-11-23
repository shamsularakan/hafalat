"use client";
import * as React from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { formatNumber, formatDateShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Table, TH, TD, TR } from "@/components/ui/table";
import { Loading, ErrorState, useToast } from "@/components/ui/feedback";

const KIND: Record<string, string> = { deposit: "عربون", installment: "دفعة", full: "سداد كامل", refund: "مسترد" };
const STATUS: Record<string, string> = { pending: "مستحقة", paid: "مدفوعة", overdue: "متأخرة", refunded: "مستردة" };

export default function PaymentsPage() {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [rows, setRows] = React.useState<any[] | null>(null);
  const [summary, setSummary] = React.useState<any>(null);
  const [editing, setEditing] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const load = React.useCallback(() => {
    api.get<any[]>(`/api/events/${event.id}/payments`).then(setRows).catch((e) => setError(e.message));
    api.get(`/api/events/${event.id}/finance/summary`).then(setSummary).catch(() => {});
  }, [event.id]);
  React.useEffect(load, [load]);
  async function remove(id: string) {
    try { await api.del(`/api/payments/${id}`); show("تم حذف الدفعة"); load(); }
    catch (e: any) { show(e.message, "error"); }
  }
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!rows) return <Loading />;
  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="المدفوع نقدًا" value={formatNumber(summary.paid_cash)} hint="ر.س" tone="success" />
          <Stat label="مستحق/متأخر" value={formatNumber(summary.obligations)} hint="ر.س" tone="danger" />
          <Stat label="المصروف الفعلي" value={formatNumber(summary.spent_actual)} hint="ر.س" tone="navy" />
          <Stat label="الميزانية" value={formatNumber(summary.budget)} hint="ر.س" />
        </div>
      )}
      <Card className="p-0">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">سجل الدفعات والاستحقاقات</CardTitle><Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4" /> دفعة جديدة</Button></CardHeader>
        {rows.length === 0 ? <p className="p-6 text-center text-sm text-muted">لا دفعات مسجلة بعد.</p> : (
          <Table>
            <thead><tr><TH>البيان</TH><TH>النوع</TH><TH>المبلغ</TH><TH>الاستحقاق</TH><TH>الحالة</TH><TH /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <TR key={p.id}>
                  <TD className="font-semibold">{p.expense_title ?? p.notes ?? "دفعة"}{p.vendor_name ? <span className="block text-xs text-muted">{p.vendor_name}</span> : null}</TD>
                  <TD className="text-xs text-muted">{KIND[p.kind] ?? p.kind}</TD>
                  <TD className="tabular-nums">{formatNumber(p.amount)}</TD>
                  <TD className="text-xs text-muted">{p.due_date ? formatDateShort(p.due_date) : p.paid_at ? formatDateShort(p.paid_at) : "—"}</TD>
                  <TD><Badge tone={p.status === "paid" ? "success" : p.status === "overdue" ? "danger" : "warning"}>{STATUS[p.status] ?? p.status}</Badge></TD>
                  <TD><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="text-danger" onClick={() => remove(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {editing && <PaymentDialog data={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function PaymentDialog({ data, onClose, onSaved }: any) {
  const { event } = useEvent();
  const { show } = useToast();
  const [form, setForm] = React.useState<any>({
    amount: data.amount ?? 0, kind: data.kind ?? "installment", status: data.status ?? "pending",
    due_date: data.due_date ?? "", paid_at: data.paid_at ?? "", notes: data.notes ?? "",
  });
  const [busy, setBusy] = React.useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  async function save() {
    setBusy(true);
    try {
      const payload = { ...form, paid_at: form.status === "paid" ? form.paid_at || new Date().toISOString() : null };
      if (data.id) await api.patch(`/api/payments/${data.id}`, payload);
      else await api.post(`/api/events/${event.id}/payments`, payload);
      show("تم حفظ الدفعة"); onSaved();
    } catch (e: any) { show(e.message, "error"); setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title={data.id ? "تعديل الدفعة" : "دفعة جديدة"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="المبلغ (ر.س)"><Input type="number" min={0} value={form.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
        <Field label="النوع"><Select value={form.kind} onChange={(e) => set("kind", e.target.value)}>
          <option value="deposit">عربون</option><option value="installment">دفعة</option><option value="full">سداد كامل</option><option value="refund">مسترد</option>
        </Select></Field>
        <Field label="الحالة"><Select value={form.status} onChange={(e) => set("status", e.target.value)}>
          <option value="pending">مستحقة</option><option value="paid">مدفوعة</option><option value="overdue">متأخرة</option><option value="refunded">مستردة</option>
        </Select></Field>
        <Field label="تاريخ الاستحقاق"><Input type="date" dir="ltr" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} /></Field>
      </div>
      <div className="mt-4"><Field label="ملاحظات"><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field></div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={save} loading={busy}>حفظ</Button></div>
    </Dialog>
  );
}
