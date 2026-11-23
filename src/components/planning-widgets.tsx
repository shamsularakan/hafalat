"use client";
/** عناصر تشغيل المناسبة: التنبيهات الأسبوعية، تقييم الموردين، وجدول اليوم المعتمد للطباعة والإرسال */
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, BellRing, Info, ChevronLeft, Star, Printer, Share2, Phone, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { formatDateShort, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Loading, useToast } from "@/components/ui/feedback";

const LEVEL = {
  danger: { icon: AlertTriangle, box: "border-danger/20 bg-danger/5", text: "text-danger" },
  warning: { icon: BellRing, box: "border-brand-orange/25 bg-brand-orange/5", text: "text-brown-700" },
  info: { icon: Info, box: "border-navy-950/10 bg-ivory-soft", text: "text-navy-950" },
} as const;

/** «مراجعة أسبوعية للمهام المتأخرة والمدفوعات المستحقة» — القاعدة الخامسة في الوثيقة */
export function AlertsCard({ compact }: { compact?: boolean }) {
  const { event } = useEvent();
  const [data, setData] = React.useState<any>(null);
  React.useEffect(() => {
    api.get(`/api/events/${event.id}/alerts`).then(setData).catch(() => setData({ alerts: [] }));
  }, [event.id]);
  if (!data) return null;
  const list = compact ? data.alerts.slice(0, 4) : data.alerts;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm"><BellRing className="h-4.5 w-4.5 text-gold-500" /> التنبيهات ومراجعة الأسبوع</CardTitle>
        {data.alerts.length > 0 && <Badge tone={data.counts.danger ? "danger" : "warning"}>{data.alerts.length}</Badge>}
      </CardHeader>
      {data.alerts.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4.5 w-4.5" /> لا مهام متأخرة ولا دفعات مستحقة — كل شيء في موعده.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((a: any) => {
            const L = LEVEL[a.level as keyof typeof LEVEL];
            return (
              <li key={a.key}>
                <Link href={`/app/events/${event.id}/${a.seg}`} className={cn("flex items-start gap-2.5 rounded-xl border p-3 transition-colors hover:border-lime-400", L.box)}>
                  <L.icon className={cn("mt-0.5 h-4.5 w-4.5 shrink-0", L.text)} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-bold", L.text)}>{a.title}</span>
                    <span className="block truncate text-xs text-muted">{a.detail}</span>
                  </span>
                  <ChevronLeft className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
          {compact && data.alerts.length > list.length && (
            <li><Link href={`/app/events/${event.id}/plan`} className="text-xs font-bold text-navy-950 underline decoration-lime-400 underline-offset-4">عرض كل التنبيهات ({data.alerts.length})</Link></li>
          )}
        </ul>
      )}
    </Card>
  );
}

export function Stars({ value, onChange, label }: { value: number | null; onChange?: (v: number) => void; label: string }) {
  return (
    <div role={onChange ? "radiogroup" : "img"} aria-label={`${label}: ${value ?? 0} من 5`} className="flex gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (value ?? 0) >= n;
        const star = <Star className={cn("h-5 w-5", on ? "fill-gold-400 text-gold-500" : "text-navy-950/20")} aria-hidden />;
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} من 5`} onClick={() => onChange(n)}
            className="cursor-pointer rounded p-0.5 hover:scale-110">{star}</button>
        ) : <span key={n}>{star}</span>;
      })}
    </div>
  );
}

/** تقييم الموردين بعد المناسبة — مرحلة «ما بعد المناسبة» */
export function VendorRatings() {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [vendors, setVendors] = React.useState<any[] | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const load = React.useCallback(() => {
    api.get<any[]>(`/api/events/${event.id}/vendors`).then((v) => setVendors(v.filter((x) => ["contracted", "done"].includes(x.status)))).catch(() => setVendors([]));
  }, [event.id]);
  React.useEffect(load, [load]);
  async function rate(v: any, rating: number | null, review?: string) {
    try {
      await api.put(`/api/events/${event.id}/vendors/${v.id}/rating`, { rating, review: review ?? v.review ?? "" });
      show("حُفظ التقييم"); load();
    } catch (e: any) { show(e.message, "error"); }
  }
  return (
    <Card className="print:break-inside-avoid">
      {node}
      <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Star className="h-4.5 w-4.5 text-gold-500" /> تقييم الموردين</CardTitle></CardHeader>
      {!vendors ? <Loading /> : vendors.length === 0 ? (
        <p className="text-sm text-muted">لا موردين متعاقدين لتقييمهم.</p>
      ) : (
        <ul className="divide-y divide-navy-950/6">
          {vendors.map((v) => (
            <li key={v.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0"><p className="font-bold">{v.name}</p><p className="text-xs text-muted">{v.category}</p></div>
                <Stars value={v.rating} onChange={(n) => rate(v, n)} label={`تقييم ${v.name}`} />
              </div>
              <div className="flex gap-2 print:hidden">
                <Textarea className="min-h-10" rows={1} placeholder="ملاحظة: الالتزام بالوقت، الجودة، التعامل…" aria-label={`ملاحظة تقييم ${v.name}`}
                  value={drafts[v.id] ?? v.review ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [v.id]: e.target.value }))} />
                <Button variant="outline" size="sm" className="self-end" onClick={() => rate(v, v.rating, drafts[v.id] ?? v.review ?? "")}>حفظ</Button>
              </div>
              {v.review && <p className="hidden text-sm print:block">{v.review}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const timeOf = (iso: string, tz?: string) =>
  new Date(iso).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit", timeZone: tz || "Asia/Riyadh" });

/** «جدول زمني واحد معتمد يُرسل لجميع الموردين» مع رقم تواصل كل مورد */
export function DaySheetDialog({ onClose }: { onClose: () => void }) {
  const { event } = useEvent();
  const [data, setData] = React.useState<any>(null);
  React.useEffect(() => { api.get(`/api/events/${event.id}/timeline/day-sheet`).then(setData).catch(() => setData({ steps: [], contacts: [] })); }, [event.id]);

  const text = data ? [
    `جدول يوم المناسبة — ${data.event?.title ?? event.title}`,
    data.event?.starts_at ? formatDateShort(data.event.starts_at, data.event.timezone) : "",
    [data.event?.venue_name, data.event?.venue_address].filter(Boolean).join(" — "),
    "",
    ...data.steps.map((s: any) => `${s.starts_at ? timeOf(s.starts_at, data.event?.timezone) : "—"}  ${s.title}${s.vendor_name || s.owner_label ? ` (${s.vendor_name ?? s.owner_label}${s.vendor_phone ? ` ${s.vendor_phone}` : ""})` : ""}`),
    ...(data.contacts.length ? ["", "أرقام الموردين:", ...data.contacts.map((c: any) => `${c.name} (${c.category}): ${c.phone ?? "—"}`)] : []),
  ].filter((l, i, arr) => l !== "" || arr[i - 1] !== "").join("\n") : "";

  return (
    <Dialog open onClose={onClose} title="الجدول المعتمد ليوم المناسبة" wide>
      {!data ? <Loading /> : (
        <div className="space-y-4">
          <div className="print-area space-y-4">
            <div>
              <h3 className="font-display text-xl font-bold">{data.event?.title}</h3>
              <p className="text-sm text-muted">
                {data.event?.starts_at && formatDateShort(data.event.starts_at, data.event.timezone)}
                {data.event?.venue_name && ` · ${data.event.venue_name}`}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-navy-950/15 text-right text-xs text-muted"><th className="py-2 pl-3 font-bold">الوقت</th><th className="py-2 pl-3 font-bold">الخطوة</th><th className="py-2 font-bold">المسؤول والتواصل</th></tr></thead>
              <tbody>
                {data.steps.map((s: any) => (
                  <tr key={s.id} className="border-b border-navy-950/6 align-top">
                    <td className="whitespace-nowrap py-2 pl-3 font-bold tabular-nums">{s.starts_at ? timeOf(s.starts_at, data.event?.timezone) : "—"}</td>
                    <td className="py-2 pl-3">{s.title}{!s.show_to_guests && <span className="text-xs text-muted"> · داخلية</span>}</td>
                    <td className="py-2 text-xs">
                      {s.vendor_name ?? s.owner_label ?? <span className="text-danger">بلا مسؤول</span>}
                      {s.vendor_phone && <a href={`tel:${s.vendor_phone}`} className="mr-1 inline-flex items-center gap-1 font-bold" dir="ltr"><Phone className="h-3 w-3" />{s.vendor_phone}</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.contacts.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-bold">أرقام الموردين المتعاقدين</p>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {data.contacts.map((c: any) => <li key={c.name}>{c.name} <span className="text-muted">({c.category})</span>: <span dir="ltr" className="font-bold">{c.phone ?? "—"}</span></li>)}
                </ul>
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-navy-950/8 pt-3">
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><Button variant="outline"><Share2 className="h-4 w-4" /> إرسال عبر واتساب</Button></a>
            <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة / PDF</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
