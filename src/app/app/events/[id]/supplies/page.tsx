"use client";
import * as React from "react";
import Link from "next/link";
import { Plus, Download, Wallet, Trash2, RotateCcw, Users, Table2, AlertTriangle, PackageCheck, Search, UserCheck, Printer } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { formatNumber, cn } from "@/lib/utils";
import {
  SUPPLY_CATEGORIES, SUPPLY_ITEMS, SUPPLY_STATUS_AR, ruleLabel, type RuleType,
} from "@/lib/supplies-catalog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select, Switch } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { Loading, ErrorState, EmptyState, useToast } from "@/components/ui/feedback";

const sar = (n: number) => `${formatNumber(Math.round(n))} ر.س`;
const catName = (id: string) => SUPPLY_CATEGORIES.find((c) => c.id === id)?.name ?? "—";

export default function SuppliesPage() {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [cat, setCat] = React.useState("all");
  const [catalog, setCatalog] = React.useState(false);
  const [busy, setBusy] = React.useState("");
  const [vendors, setVendors] = React.useState<any[]>([]);
  React.useEffect(() => { api.get<any[]>(`/api/events/${event.id}/vendors`).then(setVendors).catch(() => {}); }, [event.id]);

  const load = React.useCallback(() => {
    api.get(`/api/events/${event.id}/supplies`).then(setData).catch((e) => setError(e.message));
  }, [event.id]);
  React.useEffect(load, [load]);

  async function run(key: string, fn: () => Promise<any>, ok: string) {
    setBusy(key);
    try { await fn(); show(ok); load(); } catch (e: any) { show(e.message, "error"); } finally { setBusy(""); }
  }

  async function patchItem(id: string, body: any) {
    try { await api.patch(`/api/events/${event.id}/supplies/${id}`, body); load(); }
    catch (e: any) { show(e.message, "error"); }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loading />;

  const usedCats = data.categories.filter((c: any) => c.count > 0);
  const items = cat === "all" ? data.items : data.items.filter((i: any) => i.category_key === cat);
  const t = data.totals;

  return (
    <div className="print-area space-y-5 animate-fade-up">
      {node}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold">قائمتي والكميات</h2>
          <p className="mt-1 text-sm text-muted">أدخل عدد الضيوف مرة واحدة، وتُحسب كمية كل بند وتكلفته تلقائيًا من قاعدته.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setCatalog(true)}><Plus className="h-4 w-4" /> إضافة من الكتالوج</Button>
          {data.items.length > 0 && (
            <>
              <Button variant="outline" loading={busy === "push"} onClick={() => run("push", () => api.post(`/api/events/${event.id}/supplies/push-budget`), "تم اعتماد التقدير في فئات الميزانية")}>
                <Wallet className="h-4 w-4" /> اعتماد في الميزانية
              </Button>
              <a href={`/api/events/${event.id}/supplies/export`}><Button variant="ghost"><Download className="h-4 w-4" /> CSV</Button></a>
              <Button variant="ghost" onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة</Button>
            </>
          )}
        </div>
      </div>

      <HeadcountCard data={data} onSaved={() => { show("تم حفظ إعدادات الحساب"); load(); }} onError={(m) => show(m, "error")} />

      {/* الإجماليات */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Total label="المجموع قبل الضريبة" value={sar(t.subtotal)} />
        <Total label={data.settings.vat_enabled ? `الضريبة ${formatNumber(data.settings.vat_rate)}%` : "الضريبة (غير مفعّلة)"} value={sar(t.vat)} />
        <Total label={`الاحتياطي ${formatNumber(data.settings.reserve_percent)}%`} value={sar(t.reserve)} />
        <Total label="الإجمالي التقديري" value={sar(t.grand)} strong />
      </div>
      {t.budget > 0 ? (
        <div className={cn("flex items-start gap-2.5 rounded-card border p-4 text-sm",
          t.over_budget ? "border-danger/25 bg-danger/5 text-danger" : "border-success/25 bg-success/5 text-success")} role={t.over_budget ? "alert" : undefined}>
          {t.over_budget ? <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0" /> : <PackageCheck className="mt-0.5 h-4.5 w-4.5 shrink-0" />}
          <p className="font-semibold">
            {t.over_budget
              ? `التقدير يتجاوز الميزانية المعتمدة (${sar(t.budget)}) بـ ${sar(-t.diff)}. ابدأ بالقاعة والضيافة: هما أكبر بندين.`
              : `ضمن الميزانية المعتمدة (${sar(t.budget)}) — يتبقى ${sar(t.diff)}.`}
          </p>
        </div>
      ) : (
        <p className="rounded-card border border-dashed border-navy-950/15 p-4 text-sm text-muted">
          لم تُحدَّد ميزانية معتمدة بعد — حدّدها من <Link className="font-bold text-navy-950 underline decoration-lime-400 underline-offset-4" href={`/app/events/${event.id}/plan`}>مركز التخطيط</Link> لتظهر مقارنة التقدير بها.
        </p>
      )}

      {data.items.length === 0 ? (
        <EmptyState
          title="قائمتك فارغة"
          hint="ابدأ بقائمة حفل زواج كاملة (البنود الأساسية في 15 فئة) ثم احذف ما لا تحتاجه، أو اختر البنود واحدًا واحدًا من الكتالوج."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button loading={busy === "preset"} onClick={() => run("preset", () => api.post(`/api/events/${event.id}/supplies`, { preset: "wedding_full" }), "أُضيفت قائمة حفل الزواج الكاملة")}>
                قائمة حفل زواج كاملة
              </Button>
              <Button variant="outline" onClick={() => setCatalog(true)}>اختيار من الكتالوج</Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_18rem]">
          <div className="min-w-0 space-y-3">
            <Tabs
              active={cat}
              onChange={setCat}
              tabs={[{ id: "all", label: `الكل (${formatNumber(data.items.length)})` }, ...usedCats.map((c: any) => ({ id: c.id, label: `${c.name} (${formatNumber(c.count)})` }))]}
            />
            <div className="space-y-2">
              {items.map((i: any) => <SupplyRow key={i.id} item={i} vendors={vendors} onPatch={patchItem}
                onRemove={() => run("rm", () => api.del(`/api/events/${event.id}/supplies/${i.id}`), "حُذف البند")} />)}
            </div>
          </div>

          <div className="space-y-4">
            <Card className="p-0">
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">أعلى عشرة بنود تكلفة</CardTitle></CardHeader>
              <ol className="divide-y divide-navy-950/6">
                {data.top.map((i: any, n: number) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-5 shrink-0 text-xs font-bold text-muted tabular-nums">{formatNumber(n + 1)}</span>
                      <span className="truncate">{i.name}</span>
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">{sar(i.total)}</span>
                  </li>
                ))}
              </ol>
            </Card>
            <Card className="p-0">
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">الفئات مقابل نصيبها من الميزانية</CardTitle></CardHeader>
              <div className="space-y-3 px-4 pb-4">
                {usedCats.map((c: any) => {
                  const pct = c.target > 0 ? Math.min(100, (c.total_with_vat / c.target) * 100) : 0;
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-semibold">{c.name}</span>
                        <span className={cn("shrink-0 tabular-nums", c.over ? "font-bold text-danger" : "text-muted")}>
                          {sar(c.total_with_vat)}{c.target > 0 && ` / ${sar(c.target)}`}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-950/8">
                        <div className={cn("h-full rounded-full", c.over ? "bg-danger" : "bg-lime-400")} style={{ width: `${c.target > 0 ? pct : 0}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {catalog && (
        <CatalogDialog
          existing={new Set(data.items.map((i: any) => i.item_key))}
          onClose={() => setCatalog(false)}
          onDone={(msg) => { setCatalog(false); show(msg); load(); }}
        />
      )}
    </div>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Card className={cn("flex flex-col gap-1 p-4", strong && "bg-navy-950 text-ivory")}>
      <span className={cn("text-xs font-medium", strong ? "text-ivory/80" : "text-muted")}>{label}</span>
      <span className="text-lg font-extrabold tabular-nums sm:text-xl">{value}</span>
    </Card>
  );
}

function HeadcountCard({ data, onSaved, onError }: { data: any; onSaved: () => void; onError: (m: string) => void }) {
  const { event } = useEvent();
  const s = data.settings;
  const [form, setForm] = React.useState({
    men_count: String(s.men_count), women_count: String(s.women_count), seats_per_table: String(s.seats_per_table),
    reserve_percent: String(s.reserve_percent), vat_rate: String(s.vat_rate), vat_enabled: s.vat_enabled,
    headcount_source: s.headcount_source as "manual" | "rsvp",
  });
  const [busy, setBusy] = React.useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify({
    men_count: String(s.men_count), women_count: String(s.women_count), seats_per_table: String(s.seats_per_table),
    reserve_percent: String(s.reserve_percent), vat_rate: String(s.vat_rate), vat_enabled: s.vat_enabled, headcount_source: s.headcount_source,
  });
  const c = data.confirmed;
  const confirmedTotal = c.men + c.women + c.unassigned;

  async function save(extra?: Partial<typeof form>) {
    setBusy(true);
    try {
      const body = { ...form, ...extra };
      await api.patch(`/api/events/${event.id}/planning`, {
        ...body, men_count: Number(body.men_count), women_count: Number(body.women_count),
        seats_per_table: Number(body.seats_per_table), reserve_percent: Number(body.reserve_percent), vat_rate: Number(body.vat_rate),
      });
      onSaved();
    } catch (e: any) { onError(e.message); } finally { setBusy(false); }
  }
  async function syncRsvp() {
    setBusy(true);
    try {
      const r: any = await api.post(`/api/events/${event.id}/supplies/sync-rsvp`);
      setForm((f) => ({ ...f, men_count: String(r.men), women_count: String(r.women) }));
      onSaved();
    } catch (e: any) { onError(e.message); } finally { setBusy(false); }
  }

  const live = form.headcount_source === "rsvp";
  return (
    <Card>
      <CardHeader className="flex-wrap">
        <CardTitle className="flex items-center gap-2"><Users className="h-4.5 w-4.5 text-gold-500" /> عدد الضيوف وإعدادات الحساب</CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="lime"><Users className="h-3.5 w-3.5" /> {formatNumber(data.headcount.guests)} ضيف</Badge>
          <Badge tone="neutral"><Table2 className="h-3.5 w-3.5" /> {formatNumber(data.headcount.tables)} طاولة</Badge>
        </div>
      </CardHeader>

      <div role="radiogroup" aria-label="مصدر عدد الضيوف" className="mb-4 grid gap-2 sm:grid-cols-2">
        {([
          ["manual", "عدد مخطط (يدوي)", "تدخل عدد الرجال والنساء المتوقع"],
          ["rsvp", "المؤكدون من الردود (تلقائي)", "تتحدث الكميات مع كل رد «سأحضر»"],
        ] as const).map(([v, title, hint]) => (
          <button key={v} role="radio" aria-checked={form.headcount_source === v} onClick={() => set("headcount_source", v)}
            className={cn("cursor-pointer rounded-xl border p-3 text-right transition-colors",
              form.headcount_source === v ? "border-lime-500 bg-lime-100" : "border-navy-950/10 bg-white hover:border-lime-400")}>
            <span className="block text-sm font-bold">{title}</span>
            <span className="block text-xs text-muted">{hint}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="ضيوف الرجال" htmlFor="men"><Input id="men" type="number" min={0} inputMode="numeric" disabled={live} value={live ? String(data.headcount.men) : form.men_count} onChange={(e) => set("men_count", e.target.value)} /></Field>
        <Field label="ضيوف النساء" htmlFor="women"><Input id="women" type="number" min={0} inputMode="numeric" disabled={live} value={live ? String(data.headcount.women) : form.women_count} onChange={(e) => set("women_count", e.target.value)} /></Field>
        <Field label="كراسي الطاولة" htmlFor="seats"><Input id="seats" type="number" min={2} max={50} inputMode="numeric" value={form.seats_per_table} onChange={(e) => set("seats_per_table", e.target.value)} /></Field>
        <Field label="الاحتياطي %" htmlFor="reserve" hint="بين 5% و10% موصى به"><Input id="reserve" type="number" min={0} max={50} value={form.reserve_percent} onChange={(e) => set("reserve_percent", e.target.value)} /></Field>
        <Field label="نسبة الضريبة %" htmlFor="vat"><Input id="vat" type="number" min={0} max={50} value={form.vat_rate} onChange={(e) => set("vat_rate", e.target.value)} /></Field>
        <div className="flex items-end pb-1"><Switch id="vat-on" checked={form.vat_enabled} onChange={(v) => set("vat_enabled", v)} label="احتساب الضريبة" /></div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-navy-950/8 pt-4">
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <UserCheck className="h-4 w-4 shrink-0" />
          المؤكدون حتى الآن: {formatNumber(c.men)} رجال · {formatNumber(c.women)} نساء
          {c.unassigned > 0 && ` · ${formatNumber(c.unassigned)} بلا قسم (يُوزّعون بنسبة الخطة)`}
        </p>
        <div className="flex flex-wrap gap-2">
          {confirmedTotal > 0 && !live && (
            <Button variant="outline" size="sm" onClick={syncRsvp} disabled={busy}>نقل عدد المؤكدين</Button>
          )}
          <Button size="sm" onClick={() => save()} loading={busy} disabled={!dirty}>حفظ وإعادة الحساب</Button>
        </div>
      </div>
    </Card>
  );
}

function SupplyRow({ item, vendors, onPatch, onRemove }: { item: any; vendors: any[]; onPatch: (id: string, b: any) => void; onRemove: () => void }) {
  const [qty, setQty] = React.useState(item.qty_override === null ? "" : String(item.qty_override));
  const [price, setPrice] = React.useState(String(item.unit_price));
  React.useEffect(() => { setQty(item.qty_override === null ? "" : String(item.qty_override)); setPrice(String(item.unit_price)); }, [item.qty_override, item.unit_price]);
  const commitQty = () => {
    const next = qty.trim() === "" ? null : Number(qty);
    if (next !== item.qty_override) onPatch(item.id, { qty_override: next });
  };
  const commitPrice = () => { if (Number(price) !== item.unit_price) onPatch(item.id, { unit_price: Number(price || 0) }); };

  return (
    <div className="rounded-card border border-navy-950/8 bg-white p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">{item.name}</p>
          <p className="mt-0.5 text-xs text-muted">{catName(item.category_key)} · {item.rule_label} = {formatNumber(item.auto_qty)} {item.unit}</p>
          {vendors.length > 0 && (
            <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
              المورد:
              <select className="max-w-44 cursor-pointer rounded-lg border border-navy-950/10 bg-white px-2 py-1 text-xs font-semibold text-navy-950"
                value={item.vendor_id ?? ""} onChange={(e) => onPatch(item.id, { vendor_id: e.target.value || null, ...(e.target.value && item.status === "req" ? { status: "sel" } : {}) })} aria-label={`مورد ${item.name}`}>
                <option value="">لم يُحدَّد</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="shrink-0 text-left">
          <p className="text-base font-extrabold tabular-nums">{sar(item.total)}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-[minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(8rem,1fr)_auto]">
        <label className="block text-xs font-semibold text-muted">
          الكمية {item.qty_override !== null && <span className="text-brand-orange">(يدوية)</span>}
          <span className="mt-1 flex gap-1">
            <Input type="number" min={0} inputMode="decimal" className="h-10" placeholder={String(item.auto_qty)} value={qty}
              onChange={(e) => setQty(e.target.value)} onBlur={commitQty} onKeyDown={(e) => e.key === "Enter" && commitQty()} aria-label={`كمية ${item.name}`} />
            {item.qty_override !== null && (
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => onPatch(item.id, { qty_override: null })} aria-label="العودة للكمية التلقائية" title="العودة للكمية التلقائية">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </span>
        </label>
        <label className="block text-xs font-semibold text-muted">
          سعر الوحدة (ر.س)
          <Input type="number" min={0} inputMode="decimal" className="mt-1 h-10" value={price}
            onChange={(e) => setPrice(e.target.value)} onBlur={commitPrice} onKeyDown={(e) => e.key === "Enter" && commitPrice()} aria-label={`سعر ${item.name}`} />
        </label>
        <label className="block text-xs font-semibold text-muted">
          الحالة
          <Select className="mt-1 h-10" value={item.status} onChange={(e) => onPatch(item.id, { status: e.target.value })} aria-label={`حالة ${item.name}`}>
            {Object.entries(SUPPLY_STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </label>
        <div className="flex items-end justify-end print:hidden">
          <Button variant="ghost" size="sm" className="text-danger" onClick={onRemove} aria-label={`حذف ${item.name}`}><Trash2 className="h-4 w-4" /> حذف</Button>
        </div>
      </div>
    </div>
  );
}

function CatalogDialog({ existing, onClose, onDone }: { existing: Set<string>; onClose: () => void; onDone: (msg: string) => void }) {
  const { event } = useEvent();
  const [cat, setCat] = React.useState(SUPPLY_CATEGORIES[0].id);
  const [q, setQ] = React.useState("");
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [custom, setCustom] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({ name: "", unit: "قطعة", rule_type: "f" as RuleType, rule_value: "1", unit_price: "0" });

  const list = SUPPLY_ITEMS.filter((i) => (q.trim() ? i.n.includes(q.trim()) : i.c === cat));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function add() {
    setBusy(true); setError("");
    try {
      if (custom) {
        await api.post(`/api/events/${event.id}/supplies`, { custom: { ...form, category_key: cat, rule_value: Number(form.rule_value), unit_price: Number(form.unit_price) } });
        onDone("أُضيف البند المخصص");
      } else {
        const r: any = await api.post(`/api/events/${event.id}/supplies`, { item_keys: [...picked] });
        onDone(`أُضيف ${formatNumber(r.added)} بند`);
      }
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  return (
    <Dialog open onClose={onClose} title="كتالوج المستلزمات" wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الفئة" htmlFor="cat">
            <Select id="cat" value={cat} onChange={(e) => { setCat(e.target.value); setQ(""); }}>
              {SUPPLY_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          {!custom && (
            <Field label="بحث في كل الفئات" htmlFor="q">
              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input id="q" className="pr-9" placeholder="مثال: فناجين" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </Field>
          )}
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant={custom ? "outline" : "dark"} onClick={() => setCustom(false)}>من الكتالوج</Button>
          <Button size="sm" variant={custom ? "dark" : "outline"} onClick={() => setCustom(true)}>بند مخصص</Button>
        </div>

        {custom ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اسم البند" htmlFor="cn"><Input id="cn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="الوحدة" htmlFor="cu"><Input id="cu" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
            <Field label="قاعدة الكمية" htmlFor="cr">
              <Select id="cr" value={form.rule_type} onChange={(e) => setForm({ ...form, rule_type: e.target.value as RuleType })}>
                {(["f", "g", "gd", "t", "w", "m"] as RuleType[]).map((t) => <option key={t} value={t}>{ruleLabel({ t, v: Number(form.rule_value) || 1 })}</option>)}
              </Select>
            </Field>
            <Field label={form.rule_type === "f" ? "الكمية الثابتة" : "المعامل"} htmlFor="cv"><Input id="cv" type="number" min={0} step="0.1" value={form.rule_value} onChange={(e) => setForm({ ...form, rule_value: e.target.value })} /></Field>
            <Field label="سعر الوحدة (ر.س)" htmlFor="cp"><Input id="cp" type="number" min={0} value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></Field>
          </div>
        ) : (
          <div className="max-h-[50dvh] space-y-1.5 overflow-y-auto">
            {list.length === 0 && <p className="py-6 text-center text-sm text-muted">لا نتائج</p>}
            {list.map((i) => {
              const has = existing.has(i.id);
              return (
                <label key={i.id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                  has ? "cursor-default border-navy-950/6 bg-ivory-soft opacity-70" : picked.has(i.id) ? "border-lime-500 bg-lime-100" : "border-navy-950/8 hover:border-lime-400")}>
                  <input type="checkbox" className="h-4.5 w-4.5 shrink-0 accent-lime-500" disabled={has} checked={has || picked.has(i.id)} onChange={() => toggle(i.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{i.n}</span>
                    <span className="block text-xs text-muted">{q.trim() && `${catName(i.c)} · `}{ruleLabel(i.r)} · {formatNumber(i.p)} ر.س / {i.u}</span>
                  </span>
                  {has && <Badge tone="success">في قائمتك</Badge>}
                </label>
              );
            })}
          </div>
        )}

        {error && <ErrorState message={error} />}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-navy-950/8 pt-3">
          <p className="text-xs text-muted">{custom ? "الأسعار تقديرية — عدّلها بعد الإضافة." : `محدد: ${formatNumber(picked.size)}`}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>إلغاء</Button>
            <Button onClick={add} loading={busy} disabled={custom ? !form.name.trim() : picked.size === 0}>إضافة</Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
