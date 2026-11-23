"use client";
import * as React from "react";
import { Eye, X, Sparkles } from "lucide-react";
import { api } from "@/lib/client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InvitationCard } from "@/components/invitation-card";
import { type EngineSchema, type TemplateVars } from "@/lib/invitation-engine";
import { cn } from "@/lib/utils";

export const OCCASIONS: Record<string, { label: string; event: any; vars: TemplateVars }> = {
  wedding: { label: "زواج", event: { title: "حفل زفاف عبدالله ونورة", host_name: "عبدالله ونورة", venue_name: "قاعة الاحتفالات الكبرى", starts_at: "2026-12-20T20:00:00Z", timezone: "Asia/Riyadh", map_url: "https://maps.google.com/?q=Riyadh" }, vars: { "guest.name": "أحمد محمد", "host.names": "عبدالله ونورة", "event.venue": "قاعة الاحتفالات الكبرى" } },
  engagement: { label: "خطوبة", event: { title: "حفل خطوبة سارة ومحمد", host_name: "سارة ومحمد", venue_name: "حديقة الياسمين", starts_at: "2026-11-28T19:00:00Z", timezone: "Asia/Riyadh", map_url: "https://maps.google.com/?q=Riyadh" }, vars: { "guest.name": "نورة العتيبي", "host.names": "سارة ومحمد", "event.venue": "حديقة الياسمين" } },
  graduation: { label: "تخرج", event: { title: "حفل تخرج دفعة 2026", host_name: "جامعة الملك سعود", venue_name: "المسرح الجامعي", starts_at: "2027-01-15T18:00:00Z", timezone: "Asia/Riyadh", map_url: "https://maps.google.com/?q=Riyadh" }, vars: { "guest.name": "خالد الحربي", "host.names": "جامعة الملك سعود", "event.venue": "المسرح الجامعي" } },
  family: { label: "عائلي", event: { title: "لم شمل العائلة", host_name: "آل السعد", venue_name: "استراحة آل السعد", starts_at: "2026-12-05T17:00:00Z", timezone: "Asia/Riyadh", map_url: "https://maps.google.com/?q=Riyadh" }, vars: { "guest.name": "سارة السعد", "host.names": "آل السعد", "event.venue": "استراحة آل السعد" } },
  conference: { label: "مؤتمر", event: { title: "المؤتمر السنوي للابتكار", host_name: "اللجنة المنظمة", venue_name: "مركز الرياض للمعارض", starts_at: "2027-02-10T09:00:00Z", timezone: "Asia/Riyadh", map_url: "https://maps.google.com/?q=Riyadh" }, vars: { "guest.name": "د. نورة العتيبي", "host.names": "اللجنة المنظمة", "event.venue": "مركز الرياض للمعارض" } },
  opening: { label: "افتتاح", event: { title: "حفل افتتاح المعرض", host_name: "شركة النمو", venue_name: "واجهة الرياض", starts_at: "2027-03-01T19:30:00Z", timezone: "Asia/Riyadh", map_url: "https://maps.google.com/?q=Riyadh" }, vars: { "guest.name": "محمد القحطاني", "host.names": "شركة النمو", "event.venue": "واجهة الرياض" } },
  meeting: { label: "اجتماع", event: { title: "اجتماع الفريق التنسيقي", host_name: "إدارة المشاريع", venue_name: "قاعة الاجتماعات", starts_at: "2026-11-30T10:00:00Z", timezone: "Asia/Riyadh", map_url: "https://maps.google.com/?q=Riyadh" }, vars: { "guest.name": "أمل الشمري", "host.names": "إدارة المشاريع", "event.venue": "قاعة الاجتماعات" } },
  festival: { label: "مهرجان", event: { title: "مهرجان المدينة الصيفي", host_name: "أمانة المدينة", venue_name: "الساحة الرئيسية", starts_at: "2027-06-01T20:00:00Z", timezone: "Asia/Riyadh", map_url: "https://maps.google.com/?q=Riyadh" }, vars: { "guest.name": "فهد العتيبي", "host.names": "أمانة المدينة", "event.venue": "الساحة الرئيسية" } },
};

export interface TemplateItem { id: string; name_ar: string; category: string; style: string; is_premium: number; schema_json: string; favorite: number; tags: string }

export function TemplatePreviewDialog({
  open, onClose, onUse,
}: {
  open: boolean;
  onClose: () => void;
  onUse: (item: TemplateItem, schema: EngineSchema) => void;
}) {
  const [items, setItems] = React.useState<TemplateItem[]>([]);
  const [cat, setCat] = React.useState("wedding");
  const [priceFilter, setPriceFilter] = React.useState<"all" | "free" | "paid">("all");
  const [selected, setSelected] = React.useState<TemplateItem | null>(null);

  React.useEffect(() => {
    if (!open) return;
    api.get<TemplateItem[]>("/api/templates").then((list) => {
      setItems(list);
      setSelected((prev) => prev ?? list[0] ?? null);
    }).catch(() => setItems([]));
  }, [open]);

  React.useEffect(() => {
    if (items.length && !items.some((x) => x.id === selected?.id)) setSelected(items[0]);
  }, [items, selected]);

  const categories = Array.from(new Set(items.map((x) => x.category).filter(Boolean)));
  const shown = items.filter((x) => x.category === cat && (priceFilter === "all" || (priceFilter === "paid" ? x.is_premium === 1 : x.is_premium !== 1)));
  const schema = React.useMemo(() => {
    if (!selected) return null;
    try { return JSON.parse(selected.schema_json) as EngineSchema; } catch { return null; }
  }, [selected]);
  const occasion = OCCASIONS[cat] ?? OCCASIONS.wedding;

  return (
    <Dialog open={open} onClose={onClose} title="معاينة قوالب الدعوات لكل مناسبة" wide>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "free", "paid"] as const).map((f) => (
            <button key={f} onClick={() => setPriceFilter(f)}
              className={cn("cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-bold transition-all",
                priceFilter === f ? "bg-gold-400 text-navy-950" : "bg-ivory-soft text-muted hover:bg-lime-100")}>
              {f === "all" ? "الكل" : f === "free" ? "مجاني" : "مدفوع"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button key={c} onClick={() => { setCat(c); const first = items.find((x) => x.category === c); if (first) setSelected(first); }}
              className={cn("cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold transition-all",
                cat === c ? "bg-navy-950 text-cream-50" : "bg-ivory-soft text-muted hover:bg-lime-100")}>
              {OCCASIONS[c]?.label ?? c}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* قائمة القوالب */}
          <div className="grid max-h-[34rem] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {shown.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted">لا قوالب لهذه المناسبة بعد.</p>}
            {shown.map((t) => {
              let pal: any = {};
              try { pal = JSON.parse(t.schema_json).palette ?? {}; } catch { /* */ }
              let ornament = "✦"; let title = t.name_ar; let sub = "دعوة خاصة لك";
              try { const s = JSON.parse(t.schema_json); ornament = s.cover?.ornament ?? ornament; title = s.cover?.title || title; sub = s.cover?.subtitle || sub; } catch { /* */ }
              return (
                <button key={t.id} onClick={() => setSelected(t)}
                  className={cn("relative cursor-pointer overflow-hidden rounded-xl border-2 p-3 text-center transition-all",
                    selected?.id === t.id ? "border-gold-400 shadow-md" : "border-navy-950/8 hover:border-gold-400/60")}>
                  <div className="relative mx-auto mb-2 flex h-28 w-20 flex-col items-center justify-center rounded-lg p-2 shadow-inner"
                    style={{ background: pal.bg ?? "#EDE9E6", color: pal.text ?? "#5A4A44" }}>
                    <span className="absolute inset-1 rounded border opacity-40" style={{ borderColor: pal.accent }} />
                    <span className="text-lg" style={{ color: pal.accent }}>{ornament}</span>
                    <span className="font-display mt-1 line-clamp-2 text-[10px] font-bold leading-tight">{title}</span>
                    <span className="mt-1 text-[8px] opacity-70">{sub}</span>
                  </div>
                  <p className="truncate text-[11px] font-bold">{t.name_ar}</p>
                  <div className="mt-1 flex items-center justify-center gap-1">
                    {t.is_premium ? <Badge tone="warning">مدفوع</Badge> : <Badge tone="success">مجاني</Badge>}
                    {t.favorite ? <span className="text-xs text-gold-500">★</span> : null}
                  </div>
                </button>
              );
            })}
          </div>

          {/* المعاينة الكاملة لصاحب المناسبة */}
          <div className="rounded-card border border-navy-950/8 bg-ivory-soft p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold"><Eye className="h-4 w-4" /> معاينة الضيف</p>
              <Badge tone="navy">{OCCASIONS[cat]?.label ?? cat}</Badge>
            </div>
            {schema ? (
              <InvitationCard
                schema={schema}
                event={occasion.event}
                guestName={String(occasion.vars["guest.name"] ?? "ضيف")}
                opened={false}
                onOpen={() => {}}
                vars={occasion.vars}
                compact
              />
            ) : <p className="py-16 text-center text-xs text-muted">لا توجد معاينة</p>}
            {selected && (
              <div className="mt-3 space-y-2">
                <p className="text-center text-xs font-bold">{selected.name_ar}</p>
                <Button className="w-full" onClick={() => { onUse(selected, schema!); onClose(); }} disabled={!schema}>
                  <Sparkles className="h-4 w-4" /> استخدام هذا القالب
                </Button>
                <Button variant="ghost" className="w-full" onClick={onClose}><X className="h-4 w-4" /> إغلاق</Button>
              </div>
            )}
          </div>
        </div>
        <p className="text-center text-[11px] text-muted">المعاينة تعرض بيانات تجريبية للضيف باسمه — مثلما سيظهر لكل مدعو عند فتح رابطه الخاص.</p>
      </div>
    </Dialog>
  );
}
