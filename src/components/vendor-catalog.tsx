"use client";
/** كتالوج الموردين: كل مورد يعرض منتجاته وباقاته المسعّرة، وصاحب المناسبة يختار منها فيُحسب الإجمالي تلقائيًا */
import * as React from "react";
import { Plus, Trash2, Pencil, BadgeCheck, Phone, Package, ShoppingBag, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { formatNumber, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select, Textarea, Switch, Checkbox } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Loading, ErrorState, EmptyState, useToast } from "@/components/ui/feedback";
import { Stars } from "@/components/planning-widgets";

const PRICING: Record<string, { label: string; qty: string; per: string }> = {
  fixed: { label: "سعر ثابت", qty: "", per: "" },
  per_person: { label: "للفرد", qty: "عدد الأشخاص", per: "للفرد" },
  per_qty: { label: "حسب الكمية", qty: "الكمية", per: "للوحدة" },
  per_time: { label: "بالساعة أو اليوم", qty: "عدد الساعات/الأيام", per: "للساعة/اليوم" },
};
const sar = (n: number) => `${formatNumber(Math.round(n))} ر.س`;

export function VendorCatalog() {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [editing, setEditing] = React.useState<any>(null);
  const [confirming, setConfirming] = React.useState<any>(null);
  const [only, setOnly] = React.useState("all");

  const load = React.useCallback(() => {
    api.get(`/api/events/${event.id}/products`).then(setData).catch((e) => setError(e.message));
  }, [event.id]);
  React.useEffect(load, [load]);

  async function select(p: any, body: any) {
    try { await api.post(`/api/events/${event.id}/products/${p.id}/select`, body); load(); }
    catch (e: any) { show(e.message, "error"); }
  }
  async function remove(p: any) {
    try { await api.del(`/api/events/${event.id}/products/${p.id}`); show("حُذف المنتج"); load(); }
    catch (e: any) { show(e.message, "error"); }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loading />;
  if (data.vendors.length === 0) return <EmptyState title="لا موردين بعد" hint="أضف الموردين من تبويب «الموردون والخدمات»، ثم أضف منتجات وباقات كل مورد هنا." />;

  const categories = [...new Set(data.vendors.map((v: any) => v.category))] as string[];
  const vendors = only === "all" ? data.vendors : data.vendors.filter((v: any) => v.category === only);

  return (
    <div className="space-y-4">
      {node}
      <Card className="flex flex-wrap items-center justify-between gap-3 bg-navy-950 text-ivory">
        <div>
          <p className="flex items-center gap-2 text-xs text-ivory/80"><ShoppingBag className="h-4 w-4" /> إجمالي اختياراتك من كل الموردين (شامل الضريبة)</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{sar(data.grand_total)}</p>
          <p className="mt-0.5 text-xs text-ivory/70">الأسعار «للفرد» تُحسب تلقائيًا على {formatNumber(data.guests)} ضيف من «قائمتي والكميات»، ويمكنك تعديل الكمية.</p>
        </div>
        <Select className="w-44 border-ivory/20 bg-navy-900 text-ivory" value={only} onChange={(e) => setOnly(e.target.value)} aria-label="تصفية بالفئة">
          <option value="all">كل الفئات</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Card>

      {vendors.map((v: any) => (
        <Card key={v.id} className="p-0">
          <CardHeader className="flex-wrap border-b border-navy-950/8 p-4">
            <div className="min-w-0">
              <CardTitle className="flex flex-wrap items-center gap-2">
                {v.name} <Badge tone="neutral">{v.category}</Badge>
                {v.confirmed && <Badge tone="success"><CheckCircle2 className="h-3.5 w-3.5" /> اختيار معتمد</Badge>}
                {v.managed_by_vendor && <Badge tone="lime">من دليل الموردين</Badge>}
              </CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                {v.phone && <a href={`tel:${v.phone}`} dir="ltr" className="inline-flex items-center gap-1 font-bold text-navy-950"><Phone className="h-3.5 w-3.5" />{v.phone}</a>}
                {v.rating && <Stars value={v.rating} label={`تقييم ${v.name}`} />}
              </div>
            </div>
            {v.managed_by_vendor
              ? <p className="text-xs text-muted">المنتجات والأسعار يحدّثها المورد من بوابته</p>
              : <Button variant="outline" size="sm" onClick={() => setEditing({ vendor_id: v.id })}><Plus className="h-4 w-4" /> منتج أو باقة</Button>}
          </CardHeader>

          {v.products.length === 0 ? (
            <p className="p-5 text-sm text-muted">لم يُضف هذا المورد منتجات بعد.</p>
          ) : (
            <ul className="divide-y divide-navy-950/6">
              {v.products.map((p: any) => (
                <ProductRow key={p.id} p={p} managed={v.managed_by_vendor} onSelect={(b) => select(p, b)} onEdit={() => setEditing(p)} onRemove={() => remove(p)} />
              ))}
            </ul>
          )}

          {v.products.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-950/8 bg-ivory-soft p-4">
              <p className="text-sm">
                {v.selected_count > 0
                  ? <>اخترت <b>{formatNumber(v.selected_count)}</b> · الإجمالي <b className="tabular-nums">{sar(v.selected_total)}</b></>
                  : <span className="text-muted">اختر ما يناسبك من منتجات {v.name}</span>}
              </p>
              <Button size="sm" disabled={v.selected_count === 0} onClick={() => setConfirming(v)}>
                <BadgeCheck className="h-4 w-4" /> {v.confirmed ? "تحديث الاعتماد" : "اعتماد الاختيار"}
              </Button>
            </div>
          )}
        </Card>
      ))}

      {editing && (
        <ProductDialog data={editing} vendors={data.vendors} includesChecklist={data.package_includes}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); show("حُفظ المنتج"); load(); }} />
      )}
      {confirming && (
        <ConfirmDialog vendor={confirming} onClose={() => setConfirming(null)}
          onDone={() => { setConfirming(null); show("اعتُمد الاختيار وسُجّل مصروفًا في الميزانية"); load(); }} />
      )}
    </div>
  );
}

function ProductRow({ p, managed, onSelect, onEdit, onRemove }: { p: any; managed?: boolean; onSelect: (b: any) => void; onEdit: () => void; onRemove: () => void }) {
  const [qty, setQty] = React.useState(p.quantity === null ? "" : String(p.quantity));
  React.useEffect(() => setQty(p.quantity === null ? "" : String(p.quantity)), [p.quantity]);
  const commit = () => {
    const next = qty.trim() === "" ? null : Number(qty);
    if (next !== p.quantity) onSelect({ quantity: next });
  };
  const pr = PRICING[p.pricing_type];
  return (
    <li className={cn("flex flex-wrap items-start gap-3 p-4 transition-colors", p.selected && "bg-lime-100/50")}>
      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-lime-500" checked={!!p.selected}
        onChange={(e) => onSelect({ selected: e.target.checked })} aria-label={`اختيار ${p.name}`} />
      <div className="min-w-0 flex-1 basis-56">
        <p className="flex flex-wrap items-center gap-2 font-bold">
          {p.kind === "package" && <Package className="h-4 w-4 text-gold-500" aria-hidden />}
          {p.name}
          <Badge tone={p.kind === "package" ? "lime" : "neutral"}>{p.kind === "package" ? "باقة" : "منتج"}</Badge>
          {!!p.unavailable && <Badge tone="danger">أوقفه المورد</Badge>}
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {sar(p.unit_price)} {pr?.per}{p.unit ? ` (${p.unit})` : ""} · {p.vat_included ? "شامل الضريبة" : "غير شامل الضريبة"}
        </p>
        {p.description && <p className="mt-1 text-sm leading-6">{p.description}</p>}
        {p.includes.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="تشمل">
            {p.includes.map((x: string) => <li key={x}><Badge tone="neutral">{x}</Badge></li>)}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 items-end gap-2">
        {p.pricing_type !== "fixed" && (
          <label className="block text-xs font-semibold text-muted">
            {pr?.qty}
            <Input type="number" min={0} inputMode="decimal" className="mt-1 h-10 w-24" placeholder={String(p.qty)} value={qty}
              onChange={(e) => setQty(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} aria-label={`${pr?.qty} — ${p.name}`} />
          </label>
        )}
        <div className="min-w-24 text-left">
          <p className="text-xs text-muted">الإجمالي</p>
          <p className="font-extrabold tabular-nums">{sar(p.total)}</p>
        </div>
        {!managed && (
          <>
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`تعديل ${p.name}`}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="text-danger" onClick={onRemove} aria-label={`حذف ${p.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
          </>
        )}
      </div>
    </li>
  );
}

function ProductDialog({ data, vendors, includesChecklist, onClose, onSaved }: any) {
  const { event } = useEvent();
  const [form, setForm] = React.useState({
    vendor_id: data.vendor_id ?? vendors[0]?.id ?? "", kind: data.kind ?? "product", name: data.name ?? "",
    description: data.description ?? "", pricing_type: data.pricing_type ?? "fixed", unit_price: String(data.unit_price ?? ""),
    unit: data.unit ?? "", vat_included: !!data.vat_included, includes: (data.includes ?? []) as string[], extra: "",
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (x: string) => set("includes", form.includes.includes(x) ? form.includes.filter((i) => i !== x) : [...form.includes, x]);

  async function save() {
    setBusy(true); setError("");
    const body = { ...form, unit_price: Number(form.unit_price || 0) };
    try {
      if (data.id) await api.patch(`/api/events/${event.id}/products/${data.id}`, body);
      else await api.post(`/api/events/${event.id}/products`, body);
      onSaved();
    } catch (e: any) { setError(e.message); setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title={data.id ? "تعديل المنتج" : "منتج أو باقة جديدة"} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="المورد" htmlFor="p-vendor">
            <Select id="p-vendor" value={form.vendor_id} onChange={(e) => set("vendor_id", e.target.value)}>
              {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name} — {v.category}</option>)}
            </Select>
          </Field>
          <Field label="النوع" htmlFor="p-kind" hint="الباقة مجموعة بسعر واحد، مثل «ضيافة 100 ضيف»">
            <Select id="p-kind" value={form.kind} onChange={(e) => set("kind", e.target.value)}>
              <option value="product">منتج (بند منفرد)</option>
              <option value="package">باقة</option>
            </Select>
          </Field>
          <Field label="الاسم" htmlFor="p-name"><Input id="p-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="مثال: كرسي كريستال" /></Field>
          <Field label="التسعير" htmlFor="p-type">
            <Select id="p-type" value={form.pricing_type} onChange={(e) => set("pricing_type", e.target.value)}>
              {Object.entries(PRICING).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <Field label={`السعر (ر.س)${PRICING[form.pricing_type].per ? ` ${PRICING[form.pricing_type].per}` : ""}`} htmlFor="p-price">
            <Input id="p-price" type="number" min={0} inputMode="decimal" value={form.unit_price} onChange={(e) => set("unit_price", e.target.value)} />
          </Field>
          <Field label="الوحدة (اختياري)" htmlFor="p-unit"><Input id="p-unit" value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="قطعة، ساعة، يوم…" /></Field>
          <div className="flex items-end pb-1 sm:col-span-2"><Switch id="p-vat" checked={form.vat_included} onChange={(v) => set("vat_included", v)} label="السعر شامل ضريبة القيمة المضافة" /></div>
        </div>
        <Field label="الوصف"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
        {form.kind === "package" && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">ما تشمله الباقة</legend>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {[...new Set([...includesChecklist, ...form.includes])].map((x) => <Checkbox key={x} checked={form.includes.includes(x)} onChange={() => toggle(x)} label={x} />)}
            </div>
            <div className="mt-2 flex gap-2">
              <Input value={form.extra} onChange={(e) => set("extra", e.target.value)} placeholder="بند آخر تشمله الباقة" aria-label="بند آخر تشمله الباقة" />
              <Button variant="outline" onClick={() => { if (form.extra.trim()) setForm((f) => ({ ...f, includes: [...f.includes, f.extra.trim()], extra: "" })); }}>إضافة</Button>
            </div>
          </fieldset>
        )}
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={save} loading={busy} disabled={!form.name.trim() || !form.vendor_id}>حفظ</Button></div>
      </div>
    </Dialog>
  );
}

function ConfirmDialog({ vendor, onClose, onDone }: { vendor: any; onClose: () => void; onDone: () => void }) {
  const { event } = useEvent();
  const [cats, setCats] = React.useState<any[]>([]);
  const [category, setCategory] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    api.get<any>(`/api/events/${event.id}/finance/summary`).then((s) => setCats(s.categories)).catch(() => {});
  }, [event.id]);
  async function confirm() {
    setBusy(true); setError("");
    try { await api.post(`/api/events/${event.id}/vendors/${vendor.id}/confirm`, { category_id: category || null }); onDone(); }
    catch (e: any) { setError(e.message); setBusy(false); }
  }
  const chosen = vendor.products.filter((p: any) => p.selected);
  return (
    <Dialog open onClose={onClose} title={`اعتماد اختياراتك من ${vendor.name}`}>
      <div className="space-y-4">
        <ul className="divide-y divide-navy-950/6 rounded-xl border border-navy-950/8 text-sm">
          {chosen.map((p: any) => (
            <li key={p.id} className="flex justify-between gap-3 px-3 py-2"><span>{p.name} × {formatNumber(p.qty)}</span><b className="tabular-nums">{sar(p.total)}</b></li>
          ))}
          <li className="flex justify-between gap-3 bg-ivory-soft px-3 py-2 font-extrabold"><span>الإجمالي شامل الضريبة</span><span className="tabular-nums">{sar(vendor.selected_total)}</span></li>
        </ul>
        <p className="text-xs text-muted">{vendor.confirmed ? "سيُحدَّث المصروف المعتمد سابقًا بهذه الاختيارات." : "يُسجَّل مصروفًا مخططًا في الميزانية، ويصبح المورد «متعاقد»."}</p>
        <Field label="فئة الميزانية" htmlFor="c-cat">
          <Select id="c-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{vendor.confirmed ? "بدون تغيير" : "بدون فئة"}</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={confirm} loading={busy}>اعتماد</Button></div>
      </div>
    </Dialog>
  );
}
