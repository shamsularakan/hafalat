"use client";
/** دليل الموردين: يتصفح صاحب المناسبة ملفات الموردين المسجّلين، ويرى توفرهم في يوم مناسبته، ويضيفهم بضغطة */
import * as React from "react";
import { Search, Store, Star, MapPin, Phone, CheckCircle2, CalendarX2, Plus } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { formatNumber, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Loading, ErrorState, EmptyState, useToast } from "@/components/ui/feedback";

export function VendorDirectory({ onLinked }: { onLinked?: () => void }) {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState("");

  const load = React.useCallback(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (category) p.set("category", category);
    api.get(`/api/events/${event.id}/directory?${p}`).then(setData).catch((e) => setError(e.message));
  }, [event.id, q, category]);
  React.useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function link(v: any) {
    setBusy(v.id);
    try {
      await api.post(`/api/events/${event.id}/directory`, { profile_id: v.id });
      show(`أُضيف ${v.name} — منتجاته الآن في «منتجات الموردين»`);
      load(); onLinked?.();
    } catch (e: any) { show(e.message, "error"); }
    setBusy("");
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  return (
    <div className="space-y-4">
      {node}
      <Card className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input className="pr-9" placeholder="ابحث باسم المورد أو خدمته" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث في الدليل" />
        </div>
        <Select className="w-44" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="الفئة">
          <option value="">كل الفئات</option>
          {(data?.categories ?? []).map((c: string) => <option key={c} value={c}>{c}</option>)}
        </Select>
        {data?.day && <p className="w-full text-xs text-muted">التوفر محسوب ليوم مناسبتك <b dir="ltr" className="tabular-nums">{data.day}</b>.</p>}
      </Card>

      {!data ? <Loading /> : data.vendors.length === 0 ? (
        <EmptyState title="لا موردين مطابقين" hint="الدليل يعرض الموردين المسجّلين في المنصة. يمكنك أيضًا إضافة مورد يدويًا من «الموردون والخدمات»." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.vendors.map((v: any) => (
            <Card key={v.id} className={cn("flex flex-col gap-2 p-4", !v.available && "opacity-80")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-bold"><Store className="h-4 w-4 shrink-0 text-gold-500" aria-hidden />{v.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Badge tone="neutral">{v.category}</Badge>
                    {v.city && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{v.city}</span>}
                  </p>
                </div>
                {v.available
                  ? <Badge tone="success"><CheckCircle2 className="h-3.5 w-3.5" /> متاح</Badge>
                  : <Badge tone="danger"><CalendarX2 className="h-3.5 w-3.5" /> غير متاح</Badge>}
              </div>
              {!v.available && <p className="text-xs font-semibold text-danger">{v.unavailable_reason}</p>}
              {v.description && <p className="line-clamp-3 text-sm leading-6">{v.description}</p>}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                <span>{formatNumber(v.products)} منتج وباقة</span>
                {v.price_from !== null && <span>يبدأ من <b className="text-navy-950 tabular-nums">{formatNumber(v.price_from)} ر.س</b></span>}
                {v.rating !== null && <span className="inline-flex items-center gap-0.5"><Star className="h-3.5 w-3.5 fill-gold-400 text-gold-500" />{formatNumber(v.rating)} ({formatNumber(v.ratings)})</span>}
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-navy-950/8 pt-3">
                {v.phone ? <a href={`tel:${v.phone}`} dir="ltr" className="inline-flex items-center gap-1 text-xs font-bold"><Phone className="h-3.5 w-3.5" />{v.phone}</a> : <span />}
                {v.linked
                  ? <Badge tone="lime">مضاف لمناسبتك</Badge>
                  : <Button size="sm" onClick={() => link(v)} loading={busy === v.id}><Plus className="h-4 w-4" /> إضافة للمناسبة</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
