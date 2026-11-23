"use client";
/** بوابة المورد: ملف النشاط، المنتجات والباقات، والتوفر والحجوزات */
import * as React from "react";
import { Store, Plus, Pencil, Trash2, Package, CalendarX2, CalendarCheck2, Phone, Eye, EyeOff, Star } from "lucide-react";
import { api } from "@/lib/client";
import { formatNumber, formatDateShort, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select, Textarea, Switch, Checkbox } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import { Loading, ErrorState, EmptyState, useToast } from "@/components/ui/feedback";

const CATEGORIES = ["قاعات", "ضيافة", "تصوير", "ديكور وكوشة", "صوت وإضاءة", "زهور", "حلويات وتورتة", "ميكب وتجميل", "فساتين وأزياء", "طباعة ودعوات", "نقل وسيارات", "كوادر وخدمات", "أخرى"];
const PRICING: Record<string, { label: string; per: string }> = {
  fixed: { label: "سعر ثابت", per: "" },
  per_person: { label: "للفرد", per: "للفرد" },
  per_qty: { label: "حسب الكمية", per: "للوحدة" },
  per_time: { label: "بالساعة أو اليوم", per: "للساعة/اليوم" },
};
const INCLUDES = ["التقديم وعمال الخدمة", "الأدوات (صحون وأكواب وملاعق)", "النقل والتجهيز", "الطباخون والمشرف", "القهوة والتمر والشاي", "التنظيف بعد الحفل"];
const sar = (n: number) => `${formatNumber(Math.round(n))} ر.س`;

export default function VendorPortalPage() {
  const { show, node } = useToast();
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [tab, setTab] = React.useState("products");
  const [editing, setEditing] = React.useState<any>(null);
  const load = React.useCallback(() => { api.get("/api/vendor/profile").then(setData).catch((e) => setError(e.message)); }, []);
  React.useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loading />;

  if (!data.profile) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 animate-fade-up">
        {node}
        <Card className="bg-navy-950 text-ivory">
          <p className="flex items-center gap-2 text-xs text-ivory/80"><Store className="h-4 w-4" /> بوابة المورد</p>
          <h1 className="font-display mt-1 text-2xl font-bold">اعرض خدماتك لأصحاب المناسبات</h1>
          <p className="mt-2 text-sm leading-7 text-ivory/80">أنشئ ملف نشاطك، وأضف منتجاتك وباقاتك بأسعارها، وحدّد الأيام غير المتاحة. يظهر ملفك في دليل الموردين، ويختار منه أصحاب المناسبات مباشرة.</p>
        </Card>
        <ProfileForm onSaved={() => { show("أُنشئ ملفك كمورد"); window.location.reload(); }} />
      </div>
    );
  }

  const p = data.profile;
  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs text-muted"><Store className="h-4 w-4" /> بوابة المورد</p>
          <h1 className="mt-1 text-2xl font-extrabold">{p.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone="neutral">{p.category}</Badge>{p.city && <span>{p.city}</span>}
            {p.is_public ? <Badge tone="success"><Eye className="h-3.5 w-3.5" /> ظاهر في الدليل</Badge> : <Badge tone="warning"><EyeOff className="h-3.5 w-3.5" /> مخفي من الدليل</Badge>}
          </p>
        </div>
        <Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> منتج أو باقة</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="منتجات معروضة" value={formatNumber(data.products.filter((x: any) => x.active).length)} tone="navy" />
        <Stat label="مناسبات أضافتك" value={formatNumber(data.stats.linked)} />
        <Stat label="حجوزات معتمدة" value={formatNumber(data.stats.confirmed)} tone="success" />
        <Stat label="تقييم العملاء" value={data.stats.rating ? `${formatNumber(data.stats.rating)} / 5` : "—"} hint={data.stats.ratings ? `${formatNumber(data.stats.ratings)} تقييم` : "لا تقييمات بعد"} tone="lime" />
      </div>

      <Tabs active={tab} onChange={setTab} tabs={[
        { id: "products", label: "منتجاتي وباقاتي" },
        { id: "calendar", label: "التوفر والحجوزات" },
        { id: "profile", label: "ملف النشاط" },
      ]} />

      {tab === "products" && (
        data.products.length === 0 ? (
          <EmptyState title="لا منتجات بعد" hint="أضف منتجًا (مثل: كرسي كريستال 15 ر.س للقطعة) أو باقة (مثل: ضيافة 100 ضيف بسعر واحد)." action={<Button onClick={() => setEditing({})}><Plus className="h-4 w-4" /> أول منتج</Button>} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.products.map((x: any) => (
              <Card key={x.id} className={cn("flex flex-col gap-2 p-4", !x.active && "opacity-60")}>
                <div className="flex items-start justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {x.kind === "package" && <Package className="h-4 w-4 text-gold-500" aria-hidden />}{x.name}
                    <Badge tone={x.kind === "package" ? "lime" : "neutral"}>{x.kind === "package" ? "باقة" : "منتج"}</Badge>
                    {!x.active && <Badge tone="warning">موقوف</Badge>}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(x)} aria-label={`تعديل ${x.name}`}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="text-danger" aria-label={`حذف ${x.name}`}
                      onClick={() => api.del(`/api/vendor/products/${x.id}`).then(() => { show("حُذف المنتج"); load(); }).catch((e) => show(e.message, "error"))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-lg font-extrabold tabular-nums">{sar(x.unit_price)} <span className="text-sm font-semibold text-muted">{PRICING[x.pricing_type]?.per}{x.unit ? ` (${x.unit})` : ""}</span></p>
                <p className="text-xs text-muted">{x.vat_included ? "شامل الضريبة" : "غير شامل الضريبة"}</p>
                {x.description && <p className="text-sm leading-6">{x.description}</p>}
                {x.includes.length > 0 && <ul className="flex flex-wrap gap-1.5">{x.includes.map((i: string) => <li key={i}><Badge tone="neutral">{i}</Badge></li>)}</ul>}
              </Card>
            ))}
          </div>
        )
      )}

      {tab === "calendar" && <CalendarPanel />}
      {tab === "profile" && <ProfileForm profile={p} onSaved={() => { show("حُفظ ملفك"); load(); }} />}

      {editing && <ProductDialog data={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); show("حُفظ المنتج — يظهر محدّثًا في المناسبات التي أضافتك"); load(); }} />}
    </div>
  );
}

function ProfileForm({ profile, onSaved }: { profile?: any; onSaved: () => void }) {
  const [form, setForm] = React.useState({
    name: profile?.name ?? "", category: profile?.category ?? CATEGORIES[0], city: profile?.city ?? "", phone: profile?.phone ?? "",
    description: profile?.description ?? "", daily_capacity: String(profile?.daily_capacity ?? 1), is_public: profile ? !!profile.is_public : true,
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  async function save() {
    setBusy(true); setError("");
    try { await api.put("/api/vendor/profile", { ...form, daily_capacity: Number(form.daily_capacity) }); onSaved(); }
    catch (e: any) { setError(e.message); }
    setBusy(false);
  }
  return (
    <Card>
      <CardHeader><CardTitle>{profile ? "ملف النشاط" : "أنشئ ملفك كمورد"}</CardTitle></CardHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="اسم النشاط" htmlFor="vp-name"><Input id="vp-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="مثال: قاعة الياسمين" /></Field>
        <Field label="الفئة" htmlFor="vp-cat">
          <Select id="vp-cat" value={form.category} onChange={(e) => set("category", e.target.value)}>
            {[...new Set([...CATEGORIES, form.category])].map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="المدينة" htmlFor="vp-city"><Input id="vp-city" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="الرياض" /></Field>
        <Field label="رقم التواصل" htmlFor="vp-phone"><Input id="vp-phone" dir="ltr" className="text-left" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="05xxxxxxxx" /></Field>
        <Field label="عدد المناسبات في اليوم الواحد" htmlFor="vp-cap" hint="القاعة غالبًا 1 — يمنع الحجز المزدوج في اليوم نفسه">
          <Input id="vp-cap" type="number" min={1} max={100} value={form.daily_capacity} onChange={(e) => set("daily_capacity", e.target.value)} />
        </Field>
        <div className="flex items-end pb-1"><Switch id="vp-public" checked={form.is_public} onChange={(v) => set("is_public", v)} label="ظاهر في دليل الموردين" /></div>
      </div>
      <div className="mt-3"><Field label="نبذة عن خدماتك"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></Field></div>
      {error && <div className="mt-3"><ErrorState message={error} /></div>}
      <div className="mt-4 flex justify-end"><Button onClick={save} loading={busy} disabled={!form.name.trim()}>{profile ? "حفظ" : "إنشاء الملف"}</Button></div>
    </Card>
  );
}

function ProductDialog({ data, onClose, onSaved }: { data: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState({
    kind: data.kind ?? "product", name: data.name ?? "", description: data.description ?? "", pricing_type: data.pricing_type ?? "fixed",
    unit_price: String(data.unit_price ?? ""), unit: data.unit ?? "", vat_included: !!data.vat_included,
    includes: (data.includes ?? []) as string[], active: data.active === undefined ? true : !!data.active, extra: "",
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  async function save() {
    setBusy(true); setError("");
    const body = { ...form, unit_price: Number(form.unit_price || 0) };
    try {
      if (data.id) await api.patch(`/api/vendor/products/${data.id}`, body); else await api.post("/api/vendor/products", body);
      onSaved();
    } catch (e: any) { setError(e.message); setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title={data.id ? "تعديل المنتج" : "منتج أو باقة جديدة"} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="النوع" htmlFor="vpp-kind" hint="الباقة مجموعة بسعر واحد">
            <Select id="vpp-kind" value={form.kind} onChange={(e) => set("kind", e.target.value)}><option value="product">منتج (بند منفرد)</option><option value="package">باقة</option></Select>
          </Field>
          <Field label="الاسم" htmlFor="vpp-name"><Input id="vpp-name" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="التسعير" htmlFor="vpp-type">
            <Select id="vpp-type" value={form.pricing_type} onChange={(e) => set("pricing_type", e.target.value)}>
              {Object.entries(PRICING).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <Field label={`السعر (ر.س)${PRICING[form.pricing_type].per ? ` ${PRICING[form.pricing_type].per}` : ""}`} htmlFor="vpp-price">
            <Input id="vpp-price" type="number" min={0} inputMode="decimal" value={form.unit_price} onChange={(e) => set("unit_price", e.target.value)} />
          </Field>
          <Field label="الوحدة (اختياري)" htmlFor="vpp-unit"><Input id="vpp-unit" value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="قطعة، ساعة، يوم…" /></Field>
          <div className="flex flex-col justify-end gap-1 pb-1">
            <Switch id="vpp-vat" checked={form.vat_included} onChange={(v) => set("vat_included", v)} label="السعر شامل الضريبة" />
            <Switch id="vpp-active" checked={form.active} onChange={(v) => set("active", v)} label="معروض للعملاء" />
          </div>
        </div>
        <Field label="الوصف"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
        {form.kind === "package" && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">ما تشمله الباقة</legend>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {[...new Set([...INCLUDES, ...form.includes])].map((x) => (
                <Checkbox key={x} checked={form.includes.includes(x)} label={x}
                  onChange={() => set("includes", form.includes.includes(x) ? form.includes.filter((i) => i !== x) : [...form.includes, x])} />
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input value={form.extra} onChange={(e) => set("extra", e.target.value)} placeholder="بند آخر" aria-label="بند آخر تشمله الباقة" />
              <Button variant="outline" onClick={() => { if (form.extra.trim()) setForm((f) => ({ ...f, includes: [...f.includes, f.extra.trim()], extra: "" })); }}>إضافة</Button>
            </div>
          </fieldset>
        )}
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button onClick={save} loading={busy} disabled={!form.name.trim()}>حفظ</Button></div>
      </div>
    </Dialog>
  );
}

function CalendarPanel() {
  const { show, node } = useToast();
  const [data, setData] = React.useState<any>(null);
  const [day, setDay] = React.useState("");
  const [note, setNote] = React.useState("");
  const load = React.useCallback(() => { api.get("/api/vendor/calendar").then(setData).catch((e) => show(e.message, "error")); }, [show]);
  React.useEffect(load, [load]);
  async function setBlocked(d: string, blocked: boolean) {
    try { await api.post("/api/vendor/calendar", { day: d, blocked, note }); setDay(""); setNote(""); show(blocked ? "أُغلق اليوم للحجوزات" : "أُعيد فتح اليوم"); load(); }
    catch (e: any) { show(e.message, "error"); }
  }
  if (!data) return <Loading />;
  const confirmed = data.bookings.filter((b: any) => b.state === "confirmed");
  const interested = data.bookings.filter((b: any) => b.state === "interested");
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {node}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><CalendarCheck2 className="h-4.5 w-4.5 text-success" /> الحجوزات المعتمدة</CardTitle><Badge tone="success">{formatNumber(confirmed.length)}</Badge></CardHeader>
        <p className="mb-3 text-xs text-muted">سعتك {formatNumber(data.daily_capacity)} مناسبة في اليوم — اليوم المكتمل لا يظهر متاحًا لأصحاب المناسبات.</p>
        {confirmed.length === 0 ? <p className="text-sm text-muted">لا حجوزات معتمدة بعد.</p> : <BookingList list={confirmed} />}
        {interested.length > 0 && (
          <>
            <p className="mb-2 mt-5 text-sm font-bold">مناسبات أضافتك ولم تعتمد بعد</p>
            <BookingList list={interested} />
          </>
        )}
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><CalendarX2 className="h-4.5 w-4.5 text-danger" /> أيام غير متاحة</CardTitle></CardHeader>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="اليوم" htmlFor="blk-day"><Input id="blk-day" type="date" dir="ltr" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
          <Field label="السبب (اختياري)" htmlFor="blk-note"><Input id="blk-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="محجوز خارج المنصة" /></Field>
          <Button onClick={() => setBlocked(day, true)} disabled={!day}>إغلاق اليوم</Button>
        </div>
        <ul className="mt-4 divide-y divide-navy-950/6">
          {data.blocked.length === 0 && <li className="py-2 text-sm text-muted">كل الأيام متاحة.</li>}
          {data.blocked.map((b: any) => (
            <li key={b.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span><b className="tabular-nums" dir="ltr">{b.day}</b>{b.note && <span className="text-muted"> · {b.note}</span>}</span>
              <Button variant="ghost" size="sm" onClick={() => setBlocked(b.day, false)}>إعادة فتح</Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function BookingList({ list }: { list: any[] }) {
  return (
    <ul className="space-y-2">
      {list.map((b, i) => (
        <li key={i} className="rounded-xl border border-navy-950/8 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold">{b.event_title}</p>
              <p className="text-xs text-muted">{b.starts_at ? formatDateShort(b.starts_at, b.timezone) : "الموعد يُحدد لاحقًا"}{b.venue && ` · ${b.venue}`}</p>
            </div>
            {b.total !== null && <b className="shrink-0 tabular-nums">{sar(b.total)}</b>}
          </div>
          {b.items.length > 0 && <p className="mt-1 text-xs">اختار: {b.items.join("، ")}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            المنظّم: {b.organizer}
            {b.organizer_phone && <a href={`tel:${b.organizer_phone}`} dir="ltr" className="inline-flex items-center gap-1 font-bold text-navy-950"><Phone className="h-3 w-3" />{b.organizer_phone}</a>}
          </p>
        </li>
      ))}
    </ul>
  );
}
