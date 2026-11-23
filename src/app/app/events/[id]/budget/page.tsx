"use client";
import * as React from "react";
import { Plus, Wallet, ReceiptText, Trash2, Pencil } from "lucide-react";
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

export default function BudgetPage() {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [summary, setSummary] = React.useState<any>(null);
  const [expenses, setExpenses] = React.useState<any[]>([]);
  const [vendors, setVendors] = React.useState<any[]>([]);
  const [editing, setEditing] = React.useState<any>(null);
  const [category, setCategory] = React.useState<any>(null);
  const [error, setError] = React.useState("");

  const load = React.useCallback(() => {
    api.get(`/api/events/${event.id}/finance/summary`).then(setSummary).catch((e) => setError(e.message));
    api.get<any[]>(`/api/events/${event.id}/expenses`).then(setExpenses).catch(() => {});
    api.get<any[]>(`/api/events/${event.id}/vendors`).then(setVendors).catch(() => {});
  }, [event.id]);
  React.useEffect(load, [load]);

  async function remove(id: string) {
    try { await api.del(`/api/expenses/${id}`); show("تم حذف المصروف"); load(); }
    catch (e: any) { show(e.message, "error"); }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!summary) return <Loading />;
  const s = summary;

  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="الميزانية المعتمدة" value={formatNumber(s.budget)} hint="ر.س" tone="navy" />
        <Stat label="المصروف الفعلي" value={formatNumber(s.spent_actual)} hint="ر.س — مسدود" tone="danger" />
        <Stat label="المتبقي" value={formatNumber(s.remaining_actual)} hint="ر.س" tone="lime" />
        <Stat label="الالتزامات" value={formatNumber(s.obligations)} hint="دفعات مستحقة" tone="danger" />
      </div>
      <Card className="border-brand-orange/30 bg-brand-orange/5 text-xs leading-6 text-muted">
        <strong className="text-navy-950">فصل واضح للأرقام:</strong> «المصروف الفعلي» = المصروفات المسدودة،
        «الالتزامات» = الدفعات المعلّقة/المتأخرة، «المبالغ المدفوعة نقدًا» = {formatNumber(s.paid_cash)} ر.س،
        و«المحجوز» = {formatNumber(s.committed)} ر.س. لا تُجمع هذه الأرقام مع بعضها لتجنب العد المزدوج.
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-0">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Wallet className="h-4 w-4" /> فئات الميزانية</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setCategory({})}><Plus className="h-3.5 w-3.5" /> فئة</Button>
          </CardHeader>
          <div className="divide-y divide-navy-950/6">
            {s.categories.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{c.name}</p>
                  <p className="text-xs text-muted">المخطط {formatNumber(c.planned_amount)} · المحجوز {formatNumber(c.committed)}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-950/8">
                    <div className="h-full rounded-full bg-lime-400" style={{ width: `${c.planned_amount > 0 ? Math.min(100, (c.spent / c.planned_amount) * 100) : 0}%` }} />
                  </div>
                </div>
                <div className="text-left"><p className="text-sm font-extrabold tabular-nums">{formatNumber(c.spent)}</p>
                  <button onClick={() => setCategory(c)} className="text-xs text-muted underline">تعديل</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">تقدير ضيافة المؤكدين</CardTitle></CardHeader>
          <div className="space-y-2 text-sm">
            <p className="flex justify-between"><span className="text-muted">عدد الأشخاص المؤكدين</span><b className="tabular-nums">{formatNumber(s.hospitality.confirmed_persons)}</b></p>
            <p className="flex justify-between"><span className="text-muted">تكلفة الشخص</span><b className="tabular-nums">{formatNumber(s.hospitality.cost_per_person)} ر.س</b></p>
            <p className="flex justify-between border-t border-navy-950/8 pt-2"><span className="font-bold">التقدير</span><b className="text-lg tabular-nums text-navy-950">{formatNumber(s.hospitality.estimate)} ر.س</b></p>
          </div>
          <p className="mt-3 text-xs text-muted">عدّل تكلفة الشخص من «إعدادات الخطة» في مركز التخطيط.</p>
        </Card>
      </div>

      <Card className="p-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><ReceiptText className="h-4 w-4" /> سجل المصروفات</CardTitle>
          <Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4" /> مصروف جديد</Button>
        </CardHeader>
        {expenses.length === 0 ? <p className="p-6 text-center text-sm text-muted">لا مصروفات مسجلة بعد.</p> : (
          <Table>
            <thead><tr><TH>البيان</TH><TH>الفئة</TH><TH>المورد</TH><TH>المبلغ</TH><TH>الحالة</TH><TH>التاريخ</TH><TH /></tr></thead>
            <tbody>
              {expenses.map((e) => (
                <TR key={e.id}>
                  <TD className="font-semibold">{e.title}</TD>
                  <TD className="text-xs text-muted">{e.category_name ?? "—"}</TD>
                  <TD className="text-xs text-muted">{e.vendor_name ?? "—"}</TD>
                  <TD className="tabular-nums">{formatNumber(e.amount)}</TD>
                  <TD><Badge tone={e.status === "paid" ? "success" : e.status === "cancelled" ? "danger" : "warning"}>{e.status === "paid" ? "مسدود" : e.status === "cancelled" ? "ملغي" : "مخطط"}</Badge></TD>
                  <TD className="text-xs text-muted">{e.expense_date ? formatDateShort(e.expense_date) : "—"}</TD>
                  <TD><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => setEditing(e)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="text-danger" onClick={() => remove(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {editing && <ExpenseDialog data={editing} categories={s.categories} vendors={vendors} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {category && <CategoryDialog data={category} onClose={() => setCategory(null)} onSaved={() => { setCategory(null); load(); }} />}
    </div>
  );
}

function ExpenseDialog({ data, categories, vendors, onClose, onSaved }: any) {
  const { event } = useEvent();
  const { show } = useToast();
  const [form, setForm] = React.useState<any>({
    title: data.title ?? "", amount: data.amount ?? 0, category_id: data.category_id ?? "",
    vendor_id: data.vendor_id ?? "", expense_date: data.expense_date ?? "", status: data.status ?? "planned", notes: data.notes ?? "",
  });
  const [busy, setBusy] = React.useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  async function save() {
    setBusy(true);
    try {
      if (data.id) await api.patch(`/api/expenses/${data.id}`, form);
      else await api.post(`/api/events/${event.id}/expenses`, form);
      show("تم حفظ المصروف"); onSaved();
    } catch (e: any) { show(e.message, "error"); setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title={data.id ? "تعديل المصروف" : "مصروف جديد"} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="البيان"><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="المبلغ (ر.س)"><Input type="number" min={0} value={form.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
        <Field label="الفئة"><Select value={form.category_id} onChange={(e) => set("category_id", e.target.value)}><option value="">بلا فئة</option>{categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="المورد"><Select value={form.vendor_id} onChange={(e) => set("vendor_id", e.target.value)}><option value="">بلا مورد</option>{vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
        <Field label="التاريخ"><Input type="date" dir="ltr" value={form.expense_date} onChange={(e) => set("expense_date", e.target.value)} /></Field>
        <Field label="الحالة"><Select value={form.status} onChange={(e) => set("status", e.target.value)}><option value="planned">مخطط</option><option value="paid">مسدود</option><option value="cancelled">ملغي</option></Select></Field>
      </div>
      <div className="mt-4"><Field label="ملاحظات"><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field></div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={save} loading={busy}>حفظ</Button></div>
    </Dialog>
  );
}

function CategoryDialog({ data, onClose, onSaved }: any) {
  const { event } = useEvent();
  const { show } = useToast();
  const [name, setName] = React.useState(data.name ?? "");
  const [amount, setAmount] = React.useState(data.planned_amount ?? 0);
  async function save() {
    try {
      const body = { id: data.id, name, planned_amount: Number(amount) };
      if (data.id) await api.patch(`/api/budget-categories/${data.id}`, body);
      else await api.post(`/api/events/${event.id}/budget-categories`, body);
      show("تم حفظ الفئة"); onSaved();
    } catch (e: any) { show(e.message, "error"); }
  }
  return (
    <Dialog open onClose={onClose} title={data.id ? "تعديل الفئة" : "فئة ميزانية جديدة"}>
      <div className="space-y-4">
        <Field label="اسم الفئة"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="المبلغ المخطط (ر.س)"><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={save}>حفظ</Button></div>
      </div>
    </Dialog>
  );
}
