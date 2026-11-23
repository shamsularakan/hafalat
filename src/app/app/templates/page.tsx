"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Palette, Search, Sparkles, Check, ArrowLeft } from "lucide-react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Field } from "@/components/ui/input";
import { Loading, ErrorState, useToast } from "@/components/ui/feedback";
import { InvitationCard } from "@/components/invitation-card";
import { OCCASIONS, type TemplateItem } from "@/components/template-preview";
import { type EngineSchema } from "@/lib/invitation-engine";
import { cn } from "@/lib/utils";

export default function TemplatesPage() {
  const router = useRouter();
  const { show, node } = useToast();
  const [items, setItems] = React.useState<TemplateItem[] | null>(null);
  const [events, setEvents] = React.useState<any[]>([]);
  const [cat, setCat] = React.useState("wedding");
  const [priceFilter, setPriceFilter] = React.useState<"all" | "free" | "paid">("all");
  const [favOnly, setFavOnly] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<TemplateItem | null>(null);
  const [eventId, setEventId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (favOnly) p.set("favorite", "1");
    api.get<TemplateItem[]>(`/api/templates?${p}`).then((list) => {
      setItems(list);
      setSelected((prev) => list.find((x) => x.id === prev?.id) ?? list.find((x) => x.category === cat) ?? list[0] ?? null);
    }).catch((e) => setError(e.message));
    api.get<any[]>("/api/events").then((list) => {
      setEvents(list);
      setEventId((prev) => prev || (list.find((e) => e.status === "draft") ?? list[0])?.id || "");
    }).catch(() => {});
  }, [q, favOnly, cat]);
  React.useEffect(load, [load]);

  async function toggleFav(id: string) {
    try { await api.post(`/api/templates/${id}/favorite`); load(); }
    catch (e: any) { show(e.message, "error"); }
  }

  async function apply() {
    if (!selected || !eventId) return;
    let schema: EngineSchema;
    try { schema = JSON.parse(selected.schema_json); }
    catch { show("مخطط القالب غير صالح", "error"); return; }
    setBusy(true); setError("");
    try {
      await api.put(`/api/events/${eventId}/design`, { template_id: selected.id, schema, audio_asset_id: null });
      show(`تم تطبيق «${selected.name_ar}» على المناسبة — افتح المحرر للحفظ أو النشر`);
      router.push(`/app/events/${eventId}/design`);
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  if (error && !items) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <Loading />;

  const categories = Array.from(new Set(items.map((x) => x.category).filter(Boolean)));
  const shown = items.filter((x) => x.category === cat && (priceFilter === "all" || (priceFilter === "paid" ? x.is_premium === 1 : x.is_premium !== 1)));
  let schema: EngineSchema | null = null;
  if (selected) {
    try { schema = JSON.parse(selected.schema_json) as EngineSchema; } catch { /* */ }
  }
  const occasion = OCCASIONS[cat] ?? OCCASIONS.wedding;

  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold"><Palette className="h-6 w-6 text-gold-500" /> معرض قوالب الدعوات</h1>
          <p className="mt-1 text-sm text-muted">عاين قالب الدعوة لكل مناسبة كما سيظهر لصاحب المناسبة ولضيوفه، ثم طبّقه على مناسبتك.</p>
        </div>
        <Link href="/app/events"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> المناسبات</Button></Link>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="h-9 w-40 sm:w-56" placeholder="بحث بالاسم…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button variant={favOnly ? "primary" : "outline"} size="sm" onClick={() => setFavOnly((v) => !v)}>المفضلة</Button>
          <div className="flex gap-1">
            {(["all", "free", "paid"] as const).map((f) => (
              <button key={f} onClick={() => setPriceFilter(f)}
                className={cn("cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-bold transition-all",
                  priceFilter === f ? "bg-navy-950 text-cream-50" : "bg-ivory-soft text-muted")}>
                {f === "all" ? "الكل" : f === "free" ? "مجاني" : "مدفوع"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button key={c} onClick={() => { setCat(c); setSelected(items.find((x) => x.category === c) ?? null); }}
              className={cn("cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold transition-all",
                cat === c ? "bg-gold-400 text-navy-950" : "bg-ivory-soft text-muted hover:bg-lime-100")}>
              {OCCASIONS[c]?.label ?? c}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader><CardTitle className="text-sm">قوالب {OCCASIONS[cat]?.label ?? cat} ({shown.length})</CardTitle></CardHeader>
          {shown.length === 0 ? <p className="py-12 text-center text-sm text-muted">لا قوالب مطابقة.</p> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((t) => {
                let pal: any = {}; let ornament = "✦"; let title = t.name_ar; let sub = "دعوة خاصة لك";
                try { const s = JSON.parse(t.schema_json); pal = s.palette ?? {}; ornament = s.cover?.ornament ?? ornament; title = s.cover?.title || title; sub = s.cover?.subtitle || sub; } catch { /* */ }
                return (
                  <div key={t.id} className="relative">
                    <button onClick={() => setSelected(t)}
                      className={cn("w-full cursor-pointer overflow-hidden rounded-xl border-2 p-3 text-center transition-all",
                        selected?.id === t.id ? "border-gold-400 shadow-md" : "border-navy-950/8 hover:border-gold-400/60")}>
                      <div className="relative mx-auto mb-2 flex h-32 w-20 flex-col items-center justify-center rounded-lg p-2 shadow-inner"
                        style={{ background: pal.bg ?? "#EDE9E6", color: pal.text ?? "#5A4A44" }}>
                        <span className="absolute inset-1 rounded border opacity-40" style={{ borderColor: pal.accent }} />
                        <span className="text-xl" style={{ color: pal.accent }}>{ornament}</span>
                        <span className="font-display mt-1 line-clamp-2 text-[11px] font-bold leading-tight">{title}</span>
                        <span className="mt-1 text-[8px] opacity-70">{sub}</span>
                      </div>
                      <p className="truncate text-xs font-bold">{t.name_ar}</p>
                      <div className="mt-1 flex justify-center gap-1">
                        {t.is_premium ? <Badge tone="warning">مدفوع</Badge> : <Badge tone="success">مجاني</Badge>}
                      </div>
                    </button>
                    <button onClick={() => toggleFav(t.id)} aria-label="مفضلة" className="absolute left-1 top-1 cursor-pointer rounded-full bg-white/90 px-1.5 text-xs shadow">{t.favorite ? "★" : "☆"}</button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader className="mb-3">
              <CardTitle className="text-sm">معاينة صاحب المناسبة</CardTitle>
              <Badge tone="navy">{OCCASIONS[cat]?.label ?? cat}</Badge>
            </CardHeader>
            {schema ? (
              <InvitationCard schema={schema} event={occasion.event} guestName={String(occasion.vars["guest.name"] ?? "ضيف")} opened={false} onOpen={() => {}} vars={occasion.vars} compact />
            ) : <p className="py-12 text-center text-xs text-muted">لا معاينة</p>}
          </Card>
          <Card className="space-y-3">
            <Field label="طبّق القالب على مناسبتك">
              <Select value={eventId} onChange={(e) => setEventId(e.target.value)}>
                <option value="">اختر المناسبة…</option>
                {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </Select>
            </Field>
            {error && <p className="text-xs font-bold text-danger">{error}</p>}
            <Button className="w-full" onClick={apply} loading={busy} disabled={!selected || !eventId}>
              <Sparkles className="h-4 w-4" /> استخدام القالب
            </Button>
            <p className="flex items-center gap-1 text-[11px] text-muted"><Check className="h-3.5 w-3.5" /> المعاينة تطابق ما سيراه الضيف تمامًا.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
