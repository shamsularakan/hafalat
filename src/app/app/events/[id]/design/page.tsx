"use client";
import * as React from "react";
import Link from "next/link";
import { Palette, Music4, ImagePlus, Save, Send, Check, Eye, Undo2, Redo2, Layers, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { api } from "@/lib/client";
import { useEvent } from "@/components/event-context";
import { BUILTIN_TEMPLATES } from "@/lib/seeds";
import { defaultScenes, ALLOWED_VARS, type EngineSchema, type Scene, type Layer, type TemplateVars } from "@/lib/invitation-engine";
import { InvitationCard } from "@/components/invitation-card";
import { TemplatePreviewDialog } from "@/components/template-preview";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select, Switch, Textarea, Checkbox } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { Loading, ErrorState, useToast } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

const SAMPLE_VARS: TemplateVars = {
  "guest.name": "أحمد محمد", "event.name": "حفل زفاف", "event.date": "٢٠ نوفمبر ٢٠٢٦",
  "event.time": "٨:٠٠ مساءً", "event.venue": "قاعة الاحتفالات",
  "guest.allowed_companions": 2, "invitation.category": "VIP", "host.names": "عبدالله ونورة",
  "event.program": "19:00|الاستقبال\n20:00|حفل الزفاف\n21:30|العشاء",
  "event.dress_code": "رسمي — بدلة / فستان سهرة", "event.transport": "مواصلات من القاعة الساعة ١٠ مساءً",
  "event.accommodation": "فندق ...) للضيوف", "event.quote": "الحب ما يعرف حدود",
  "event.photo": "", "event.rsvp_deadline": "١٥ نوفمبر", "event.rsvp_phone": "05xxxxxxxx",
  "event.monogram": "ع | ن", "event.groom": "عبدالله", "event.bride": "نورة",
  "event.invitation_line": "يتشرفان بدعوتكم لحضور حفل زفافهما",
};

const MOTIONS: { id: EngineSchema["motion"]; ar: string }[] = [
  { id: "envelope", ar: "فتح ظرف" },
  { id: "fade", ar: "تلاشٍ" },
  { id: "slide", ar: "انزلاق" },
  { id: "scale", ar: "تكبير" },
  { id: "reveal", ar: "كشف بقناع" },
  { id: "flip", ar: "قلب بطاقة" },
];

const COLOR_FIELDS: [keyof EngineSchema["palette"], string][] = [
  ["bg", "الخلفية"], ["card", "البطاقات"], ["primary", "الزر الرئيسي"],
  ["accent", "الزخرفة"], ["text", "النص"], ["muted", "النص الثانوي"],
];

export default function DesignPage() {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [schema, setSchema] = React.useState<EngineSchema | null>(null);
  const [templateId, setTemplateId] = React.useState<string | null>(null);
  const [audioAsset, setAudioAsset] = React.useState<string | null>(null);
  const [publishedVersion, setPublishedVersion] = React.useState<number | null>(null);
  const [tab, setTab] = React.useState("texts");
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    api.get<any>(`/api/events/${event.id}/design`)
      .then((d) => {
        const src = d.draft ?? d.published;
        if (src) {
          setSchema(JSON.parse(src.scenes_json));
          setTemplateId(src.template_id);
          setAudioAsset(src.audio_asset_id);
        } else {
          setSchema({ ...BUILTIN_TEMPLATES[0].schema, cover: { ...BUILTIN_TEMPLATES[0].schema.cover, title: event.title, hosts: event.host_name ?? "" } });
          setTemplateId("tpl-royal");
        }
        if (d.published) setPublishedVersion(d.published.version);
        setLoading(false);
      })
      .catch((e) => { show(e.message, "error"); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const history = React.useRef<EngineSchema[]>([]);
  const future = React.useRef<EngineSchema[]>([]);
  const [previewScene, setPreviewScene] = React.useState<Scene | null>(null);
  const [library, setLibrary] = React.useState<any[]>([]);
  const [libQ, setLibQ] = React.useState("");
  const [libCat, setLibCat] = React.useState("");
  const [favOnly, setFavOnly] = React.useState(false);
  const [gallery, setGallery] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("gallery") === "1")
      setGallery(true);
  }, []);

  const loadLibrary = React.useCallback(() => {
    const params = new URLSearchParams();
    if (libQ) params.set("q", libQ);
    if (libCat) params.set("category", libCat);
    if (favOnly) params.set("favorite", "1");
    api.get<any[]>(`/api/templates?${params}`).then(setLibrary).catch(() => setLibrary([]));
  }, [libQ, libCat, favOnly]);
  React.useEffect(loadLibrary, [loadLibrary]);

  async function toggleFavorite(id: string) {
    try { await api.post(`/api/templates/${id}/favorite`); loadLibrary(); }
    catch (e: any) { show(e.message, "error"); }
  }

  function commit(next: EngineSchema) {
    if (!schema) return;
    history.current.push(schema);
    if (history.current.length > 40) history.current.shift();
    future.current = [];
    setSchema(next);
    setDirty(true);
  }
  function patch(p: Partial<EngineSchema>) {
    if (!schema) return;
    commit({ ...schema, ...p });
  }
  function undo() {
    const prev = history.current.pop();
    if (!prev || !schema) return;
    future.current.push(schema);
    setSchema(prev);
    setDirty(true);
  }
  function redo() {
    const next = future.current.pop();
    if (!next || !schema) return;
    history.current.push(schema);
    setSchema(next);
    setDirty(true);
  }

  function applyTemplate(tpl: (typeof BUILTIN_TEMPLATES)[number]) {
    commit({
      ...tpl.schema,
      cover: { ...tpl.schema.cover, title: schema?.cover.title || event.title, hosts: schema?.cover.hosts || event.host_name || "" },
      details: { ...tpl.schema.details, message: schema?.details.message || tpl.schema.details.message },
      logo_asset_id: schema?.logo_asset_id ?? null,
      background_asset_id: schema?.background_asset_id ?? null,
    });
    setTemplateId(tpl.id);
    setDirty(true);
  }

  async function save(publish = false) {
    if (!schema) return;
    setSaving(true);
    try {
      await api.put(`/api/events/${event.id}/design`, { template_id: templateId, schema, audio_asset_id: audioAsset });
      if (publish) {
        const pub = await api.post<any>(`/api/events/${event.id}/design/publish`);
        setPublishedVersion(pub.version);
        show("تم نشر التصميم — سيظهر لكل الضيوف");
      } else {
        show("تم حفظ المسودة");
      }
      setDirty(false);
    } catch (e: any) { show(e.message, "error"); }
    setSaving(false);
  }

  async function upload(kind: "audio" | "image" | "logo", file: File, rights: boolean, note?: string): Promise<any> {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    form.append("event_id", event.id);
    form.append("rights_attested", rights ? "true" : "false");
    if (note) form.append("rights_note", note);
    return api.form<any>("/api/uploads", form);
  }

  if (loading) return <Loading />;
  if (!schema) return <ErrorState message="تعذر تحميل التصميم" />;

  const previewEvent = {
    title: event.title, type: event.type, host_name: event.host_name,
    starts_at: event.starts_at, ends_at: event.ends_at, timezone: event.timezone,
    venue_name: event.venue_name, venue_address: event.venue_address, map_url: event.map_url,
    is_virtual: event.is_virtual, virtual_url: event.virtual_url,
  };

  return (
    <div className="space-y-4 animate-fade-up">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Palette className="h-5 w-5 text-muted" /> محرر الدعوة</h2>
          <p className="text-sm text-muted">
            {publishedVersion ? <Badge tone="success">منشور · إصدار {publishedVersion}</Badge> : <Badge tone="warning">لم يُنشر بعد</Badge>}
            {" "}التغيير بعد الإرسال لا يمس الدعوات والحصص والردود.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="icon" onClick={undo} aria-label="تراجع" title="تراجع"><Undo2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={redo} aria-label="إعادة" title="إعادة"><Redo2 className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => setGallery(true)}><Eye className="h-4 w-4" /> معاينة كل المناسبات</Button>
          <Link href="/app/templates"><Button variant="outline"><Palette className="h-4 w-4" /> معرض القوالب</Button></Link>
          <Button variant="outline" onClick={() => save(false)} loading={saving}><Save className="h-4 w-4" /> حفظ مسودة {dirty && "•"}</Button>
          <Button onClick={() => save(true)} loading={saving}><Send className="h-4 w-4" /> نشر التصميم</Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        {/* المحرر */}
        <div className="min-w-0 space-y-4">
          {/* القوالب */}
          <Card>
            <CardHeader>
              <CardTitle>مكتبة القوالب</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Input className="h-9 w-32 text-xs sm:w-44" placeholder="بحث…" value={libQ} onChange={(e) => setLibQ(e.target.value)} />
                <Button variant={favOnly ? "primary" : "outline"} size="sm" onClick={() => setFavOnly((v) => !v)}>المفضلة</Button>
              </div>
            </CardHeader>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {["", "wedding", "engagement", "graduation", "family", "conference", "opening", "meeting", "festival"].map((c) => (
                <button key={c} onClick={() => setLibCat(c)}
                  className={cn("cursor-pointer rounded-full px-3 py-1 text-[11px] font-bold transition-all", libCat === c ? "bg-navy-950 text-cream-50" : "bg-ivory-soft text-muted hover:bg-lime-100")}>
                  {c || "الكل"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              {library.length === 0 && <p className="col-span-full py-6 text-center text-xs text-muted">لا قوالب مطابقة — جرّب تعديل البحث أو التصنيف.</p>}
              {library.map((t) => {
                let pal: any = {};
                try { pal = JSON.parse(t.schema_json).palette ?? {}; } catch { /* */ }
                const tplSchema = { ...BUILTIN_TEMPLATES[0].schema, ...JSON.parse(t.schema_json || "{}") };
                return (
                  <div key={t.id} className="relative">
                    <button onClick={() => { commit({ ...tplSchema, cover: { ...tplSchema.cover, title: schema?.cover.title || event.title }, details: tplSchema.details, logo_asset_id: schema?.logo_asset_id ?? null, background_asset_id: schema?.background_asset_id ?? null }); setTemplateId(t.id); }}
                      className={cn("w-full cursor-pointer rounded-xl border-2 p-2 text-center transition-all", templateId === t.id ? "border-gold-400 shadow-md" : "border-transparent hover:border-navy-950/20")}>
                      <span className="mb-1.5 flex h-14 items-center justify-center rounded-lg text-lg"
                        style={{ background: pal.bg ?? "#EDE9E6", color: pal.primary ?? "#5A4A44" }}>
                        {JSON.parse(t.schema_json || "{}").cover?.ornament ?? "✦"}
                      </span>
                      <span className="block truncate text-[11px] font-bold">{t.name_ar}</span>
                      {t.is_premium ? <span className="text-[9px] text-gold-500">مدفوع</span> : null}
                    </button>
                    <button onClick={() => toggleFavorite(t.id)} aria-label="مفضلة"
                      className="absolute left-1 top-1 cursor-pointer rounded-full bg-white/90 px-1.5 text-xs shadow" title="مفضلة">
                      {t.favorite ? "★" : "☆"}
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Tabs active={tab} onChange={setTab} tabs={[
            { id: "texts", label: "النصوص" },
            { id: "invite-data", label: "بيانات الدعوة" },
            { id: "scenes", label: "المشاهد والطبقات" },
            { id: "colors", label: "الألوان والحركة" },
            { id: "media", label: "الصوت والوسائط" },
          ]} />

          {tab === "scenes" && (
            <ScenesEditor schema={schema} onChange={(next, selected) => { commit(next); if (selected) setPreviewScene(selected); }} />
          )}

          {tab === "texts" && (
            <Card className="space-y-4 animate-fade-in">
              <Field label="عنوان الدعوة"><Input value={schema.cover.title} onChange={(e) => patch({ cover: { ...schema.cover, title: e.target.value } })} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="سطر تمهيدي"><Input value={schema.cover.subtitle} onChange={(e) => patch({ cover: { ...schema.cover, subtitle: e.target.value } })} /></Field>
                <Field label="أسماء أصحاب الدعوة"><Input value={schema.cover.hosts} onChange={(e) => patch({ cover: { ...schema.cover, hosts: e.target.value } })} placeholder="مثال: عبدالله ونورة" /></Field>
              </div>
              <Field label="نص الدعوة"><Textarea rows={3} value={schema.details.message} onChange={(e) => patch({ details: { ...schema.details, message: e.target.value } })} /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="تسمية الموقع"><Input value={schema.details.venue_label} onChange={(e) => patch({ details: { ...schema.details, venue_label: e.target.value } })} /></Field>
                <Field label="تسمية الموعد"><Input value={schema.details.date_label} onChange={(e) => patch({ details: { ...schema.details, date_label: e.target.value } })} /></Field>
                <Field label="ملاحظة RSVP"><Input value={schema.details.rsvp_note} onChange={(e) => patch({ details: { ...schema.details, rsvp_note: e.target.value } })} /></Field>
              </div>
              <Field label="رمز الزخرفة"><Input value={schema.cover.ornament} onChange={(e) => patch({ cover: { ...schema.cover, ornament: e.target.value } })} className="w-24 text-center" /></Field>
            </Card>
          )}

          {tab === "invite-data" && (
            <Card className="space-y-4 animate-fade-in">
              <p className="text-xs text-muted">هذه البيانات تظهر في قالب الدعوة البصري (الغلاف، البرنامج، التأكيد). اترك أي حقل فارغًا ليُخفى تلقائيًا.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="اسم العريس"><Input value={schema.details.groom ?? ""} onChange={(e) => patch({ details: { ...schema.details, groom: e.target.value } })} placeholder="عبدالله" /></Field>
                <Field label="اسم العروس"><Input value={schema.details.bride ?? ""} onChange={(e) => patch({ details: { ...schema.details, bride: e.target.value } })} placeholder="نورة" /></Field>
                <Field label="الأحرف الأولى (مونوغرام)"><Input value={schema.details.monogram ?? ""} onChange={(e) => patch({ details: { ...schema.details, monogram: e.target.value } })} placeholder="ع | ن" /></Field>
                <Field label="سطر الدعوة"><Input value={schema.details.invitation_line ?? ""} onChange={(e) => patch({ details: { ...schema.details, invitation_line: e.target.value } })} /></Field>
              </div>
              <Field label="صورة العريس (اختيارية)">
                <Input value={schema.details.photo_url ?? ""} onChange={(e) => patch({ details: { ...schema.details, photo_url: e.target.value } })} placeholder="/api/i/.../asset/... أو رابط https" dir="ltr" />
              </Field>
              <Field label="برنامج الحفل (كل سطر: الوقت|العنوان)">
                <Textarea rows={5} value={schema.details.program ?? ""} onChange={(e) => patch({ details: { ...schema.details, program: e.target.value } })} placeholder={"19:00|الاستقبال\n20:00|حفل الزفاف"} dir="ltr" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="الزي المطلوب"><Input value={schema.details.dress_code ?? ""} onChange={(e) => patch({ details: { ...schema.details, dress_code: e.target.value } })} /></Field>
                <Field label="المواصلات"><Input value={schema.details.transport ?? ""} onChange={(e) => patch({ details: { ...schema.details, transport: e.target.value } })} /></Field>
                <Field label="الإقامة"><Input value={schema.details.accommodation ?? ""} onChange={(e) => patch({ details: { ...schema.details, accommodation: e.target.value } })} /></Field>
                <Field label="رسالة/اقتباس"><Input value={schema.details.quote ?? ""} onChange={(e) => patch({ details: { ...schema.details, quote: e.target.value } })} /></Field>
                <Field label="رقم تأكيد الحضور"><Input value={schema.details.rsvp_phone ?? ""} onChange={(e) => patch({ details: { ...schema.details, rsvp_phone: e.target.value } })} dir="ltr" /></Field>
              </div>
            </Card>
          )}

          {tab === "colors" && (
            <Card className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {COLOR_FIELDS.map(([key, label]) => (
                  <Field key={key} label={label}>
                    <div className="flex items-center gap-2">
                      <input type="color" value={schema.palette[key]}
                        onChange={(e) => patch({ palette: { ...schema.palette, [key]: e.target.value } })}
                        className="h-10 w-12 cursor-pointer rounded-lg border border-navy-950/15 bg-white p-1" aria-label={label} />
                      <Input dir="ltr" className="text-left text-xs" value={schema.palette[key]}
                        onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && patch({ palette: { ...schema.palette, [key]: e.target.value } })} />
                    </div>
                  </Field>
                ))}
              </div>
              <Field label="حركة فتح الدعوة" hint="حركات قصيرة ووظيفية — تتوقف تلقائيًا عند تفعيل «تقليل الحركة» في جهاز الضيف">
                <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
                  {MOTIONS.map((m) => (
                    <button key={m.id} onClick={() => patch({ motion: m.id })}
                      className={cn("cursor-pointer rounded-xl border px-3 py-2.5 text-xs font-bold transition-all",
                        schema.motion === m.id ? "border-lime-500 bg-lime-100" : "border-navy-950/10 hover:border-navy-950/30")}>
                      {m.ar}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="rounded-xl bg-ivory-soft p-4">
                <Switch checked={schema.show_countdown ?? false} onChange={(v) => patch({ show_countdown: v })} label="عداد تنازلي للموعد" />
                <Switch checked={schema.show_qr ?? false} onChange={(v) => patch({ show_qr: v })} label="إظهار رمز الدخول QR للضيف" />
              </div>
            </Card>
          )}

          {tab === "media" && (
            <MediaTab schema={schema} patch={patch} audioAsset={audioAsset} setAudioAsset={(id) => { setAudioAsset(id); setDirty(true); }} upload={upload} />
          )}
        </div>

        {/* المعاينة الحية */}
        <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-4">
            <CardHeader className="mb-3">
              <CardTitle className="flex items-center gap-2 text-sm"><Eye className="h-4 w-4" /> معاينة حية</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setPreviewOpen((v) => !v)}>
                {previewOpen ? "إعادة الغلاف" : "فتح الدعوة"}
              </Button>
            </CardHeader>
            <InvitationCard
              schema={schema}
              event={previewEvent as any}
              guestName="اسم الضيف"
              opened={previewOpen}
              onOpen={() => setPreviewOpen(true)}
              compact
              scene={previewScene}
              vars={SAMPLE_VARS}
              logoUrl={schema.logo_asset_id ? `/api/assets/${schema.logo_asset_id}` : null}
              backgroundUrl={schema.background_asset_id ? `/api/assets/${schema.background_asset_id}` : null}
            >
              {previewOpen && (
                <div className="rounded-2xl border p-4 text-center text-xs" style={{ borderColor: schema.palette.accent + "44", color: schema.palette.muted }}>
                  منطقة رد الضيف (RSVP) ورمز QR تظهر هنا للضيف
                  {audioAsset && <p className="mt-2 flex items-center justify-center gap-1" style={{ color: schema.palette.primary }}><Music4 className="h-3.5 w-3.5" /> نشيد مرفق ✓</p>}
                </div>
              )}
            </InvitationCard>
          </Card>
        </div>
      </div>

      {gallery && (
        <TemplatePreviewDialog
          open={gallery}
          onClose={() => setGallery(false)}
          onUse={(item, nextSchema) => {
            commit({ ...nextSchema, cover: { ...nextSchema.cover, title: schema?.cover.title || event.title, hosts: schema?.cover.hosts || event.host_name || "" }, logo_asset_id: schema?.logo_asset_id ?? null, background_asset_id: schema?.background_asset_id ?? null });
            setTemplateId(item.id);
            setPreviewScene(null);
            show(`تم اختيار قالب «${item.name_ar}» — احفظ أو انشر التصميم`);
          }}
        />
      )}
    </div>
  );
}

function MediaTab({ schema, patch, audioAsset, setAudioAsset, upload }: {
  schema: EngineSchema;
  patch: (p: Partial<EngineSchema>) => void;
  audioAsset: string | null;
  setAudioAsset: (id: string | null) => void;
  upload: (kind: "audio" | "image" | "logo", file: File, rights: boolean, note?: string) => Promise<any>;
}) {
  const { event } = useEvent();
  const { show, node } = useToast();
  const [rights, setRights] = React.useState(false);
  const [rightsNote, setRightsNote] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [media, setMedia] = React.useState<any[]>([]);

  React.useEffect(() => {
    api.get<any[]>(`/api/events/${event.id}/media`).then(setMedia).catch(() => {});
  }, [event.id]);

  async function onAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!rights) { show("أكد حق استخدام الملف الصوتي أولًا", "error"); e.target.value = ""; return; }
    setBusy("audio");
    try {
      const asset = await upload("audio", file, true, rightsNote || undefined);
      setAudioAsset(asset.id);
      setMedia((m) => [asset, ...m]);
      show("تم رفع المقطع الصوتي");
    } catch (err: any) { show(err.message, "error"); }
    setBusy(null);
    e.target.value = "";
  }

  async function onImage(e: React.ChangeEvent<HTMLInputElement>, kind: "logo" | "image") {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(kind);
    try {
      const asset = await upload(kind, file, false);
      patch(kind === "logo" ? { logo_asset_id: asset.id } : { background_asset_id: asset.id });
      setMedia((m) => [asset, ...m]);
      show(kind === "logo" ? "تم رفع الشعار" : "تم رفع الخلفية");
    } catch (err: any) { show(err.message, "error"); }
    setBusy(null);
    e.target.value = "";
  }

  const audios = media.filter((m) => m.kind === "audio");

  return (
    <Card className="space-y-5 animate-fade-in">
      {node}
      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-bold"><Music4 className="h-4 w-4" /> النشيد / المقطع الصوتي</p>
        <div className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 p-4">
          <Checkbox checked={rights} onChange={setRights}
            label={<span className="text-xs leading-6">أؤكد أنني أملك هذا الملف أو أملك ترخيصًا صريحًا باستخدامه، وأتحمل مسؤولية حقوقه. المنصة لا توفر تراخيص تلقائية.</span>} />
          <Input className="mt-2" placeholder="ملاحظة الحقوق (اختياري): مصدر الترخيص…" value={rightsNote} onChange={(e) => setRightsNote(e.target.value)} />
          <label className={cn("mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-navy-950/25 bg-white py-3 text-sm font-bold transition-colors hover:border-lime-500", !rights && "pointer-events-none opacity-50")}>
            <Music4 className="h-4 w-4" /> {busy === "audio" ? "جارٍ الرفع…" : "رفع MP3 / AAC / WAV (≤ 15MB)"}
            <input type="file" accept="audio/mpeg,audio/mp3,audio/aac,audio/mp4,audio/wav,audio/ogg" className="hidden" onChange={onAudio} disabled={!rights || busy === "audio"} />
          </label>
        </div>
        {audios.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {audios.map((m) => (
              <button key={m.id} onClick={() => setAudioAsset(m.id)}
                className={cn("flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors",
                  audioAsset === m.id ? "border-lime-500 bg-lime-100 font-bold" : "border-navy-950/10 hover:border-navy-950/30")}>
                <span className="truncate">{m.original_name}</span>
                {audioAsset === m.id && <Check className="h-4 w-4 text-success" />}
              </button>
            ))}
            {audioAsset && <Button variant="ghost" size="sm" className="text-danger" onClick={() => setAudioAsset(null)}>إزالة الصوت من الدعوة</Button>}
          </div>
        )}
        <p className="mt-2 text-[11px] leading-5 text-muted">لا يبدأ التشغيل تلقائيًا عند فتح الصفحة؛ يبدأ بعد ضغط الضيف «فتح الدعوة» مع تحكم كامل بالتشغيل والكتم ومستوى الصوت.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-bold"><ImagePlus className="h-4 w-4" /> الشعار</p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-navy-950/25 bg-white py-3 text-xs font-bold hover:border-lime-500">
            {busy === "logo" ? "جارٍ الرفع…" : schema.logo_asset_id ? "تغيير الشعار ✓" : "رفع شعار (≤ 5MB)"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onImage(e, "logo")} />
          </label>
          {schema.logo_asset_id && <Button variant="ghost" size="sm" className="mt-1 text-danger" onClick={() => patch({ logo_asset_id: null })}>إزالة</Button>}
        </div>
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-bold"><ImagePlus className="h-4 w-4" /> خلفية مخصصة</p>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-navy-950/25 bg-white py-3 text-xs font-bold hover:border-lime-500">
            {busy === "image" ? "جارٍ الرفع…" : schema.background_asset_id ? "تغيير الخلفية ✓" : "رفع خلفية (≤ 5MB)"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onImage(e, "image")} />
          </label>
          {schema.background_asset_id && <Button variant="ghost" size="sm" className="mt-1 text-danger" onClick={() => patch({ background_asset_id: null })}>إزالة</Button>}
        </div>
      </div>
      <p className="text-[11px] leading-5 text-muted">الصيغ المسموحة: PNG/JPEG/WebP للصور وMP3/AAC/WAV/OGG للصوت. يُرفض SVG وملفات التنفيذ. تُحذف الوسائط غير المستخدمة عند الطلب، والوصول للضيف مقصور على ملفات دعوته.</p>
    </Card>
  );
}

/* ===== محرر المشاهد والطبقات ===== */
function ScenesEditor({ schema, onChange }: { schema: EngineSchema; onChange: (next: EngineSchema, selected: Scene | null) => void }) {
  const scenes = React.useMemo(() => defaultScenes(schema), [schema]);
  const [selected, setSelected] = React.useState(scenes[0]?.id ?? "");
  const scene = scenes.find((s) => s.id === selected) ?? scenes[0];

  function emit(next: Scene[], selectedId?: string) {
    const chosen = next.find((s) => s.id === (selectedId ?? selected)) ?? next[0] ?? null;
    onChange({ ...schema, scenes: next }, chosen);
  }
  function updateScene(patch: Partial<Scene>) {
    emit(scenes.map((s) => (s.id === scene.id ? { ...s, ...patch } : s)));
  }
  function addScene() {
    const id = `scene-${Date.now()}`;
    const next: Scene[] = [...scenes, {
      id, kind: "welcome", title: "مشهد جديد", motion: schema.motion ?? "fade", duration: 5,
      layers: [{ id: `layer-${Date.now()}`, type: "text", content: "نص جديد" }],
    }];
    emit(next, id); setSelected(id);
  }
  function removeScene() {
    if (scenes.length <= 1) return;
    const next = scenes.filter((s) => s.id !== scene.id);
    emit(next, next[0].id); setSelected(next[0].id);
  }
  function moveScene(dir: number) {
    const i = scenes.findIndex((s) => s.id === scene.id);
    const j = i + dir;
    if (j < 0 || j >= scenes.length) return;
    const next = [...scenes];
    [next[i], next[j]] = [next[j], next[i]];
    emit(next);
  }
  function updateLayer(id: string, patch: Partial<Layer>) {
    emit(scenes.map((s) => (s.id === scene.id ? { ...s, layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) } : s)));
  }
  function addLayer() {
    const id = `layer-${Date.now()}`;
    emit(scenes.map((s) => (s.id === scene.id ? { ...s, layers: [...s.layers, { id, type: "text", content: "نص جديد", style: { fontSize: 16, align: "center", opacity: 1 } }] } : s)));
  }
  function removeLayer(id: string) {
    emit(scenes.map((s) => (s.id === scene.id ? { ...s, layers: s.layers.filter((l) => l.id !== id) } : s)));
  }
  function moveLayer(id: string, dir: number) {
    emit(scenes.map((s) => {
      if (s.id !== scene.id) return s;
      const i = s.layers.findIndex((l) => l.id === id), j = i + dir;
      if (j < 0 || j >= s.layers.length) return s;
      const layers = [...s.layers]; [layers[i], layers[j]] = [layers[j], layers[i]];
      return { ...s, layers };
    }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm"><Layers className="h-4 w-4" /> المشاهد والطبقات — نفس محرك العرض للمدعو</CardTitle>
        <Button variant="outline" size="sm" onClick={addScene}><Plus className="h-3.5 w-3.5" /> مشهد</Button>
      </CardHeader>

      {/* الخط الزمني */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto rounded-xl bg-ivory-soft p-2" aria-label="الخط الزمني للمشاهد">
        {scenes.map((s, i) => (
          <button key={s.id} onClick={() => { setSelected(s.id); onChange(schema, s); }}
            className={cn("min-w-20 flex-1 cursor-pointer rounded-lg border px-2 py-2 text-center transition-all",
              s.id === scene.id ? "border-gold-400 bg-white shadow-sm" : "border-transparent hover:bg-white/60")}>
            <span className="block text-[10px] text-muted">{i + 1}. {s.kind}</span>
            <span className="block truncate text-xs font-bold">{s.title || "بدون عنوان"}</span>
            <span className="block text-[10px] text-muted">{s.duration ?? 5}ث</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-navy-950/8 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">إعدادات المشهد</p>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveScene(-1)} aria-label="تقديم"><ChevronUp className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveScene(1)} aria-label="تأخير"><ChevronDown className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={removeScene} aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <Field label="اسم المشهد"><Input value={scene.title ?? ""} onChange={(e) => updateScene({ title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="النوع">
              <Select value={scene.kind} onChange={(e) => updateScene({ kind: e.target.value as Scene["kind"] })}>
                {["cover","welcome","details","rsvp","ticket"].map((k) => <option key={k} value={k}>{k}</option>)}
              </Select>
            </Field>
            <Field label="المدة (ثانية)"><Input type="number" min={1} value={scene.duration ?? 5} onChange={(e) => updateScene({ duration: Number(e.target.value) })} /></Field>
          </div>
          <Field label="الحركة">
            <Select value={scene.motion ?? schema.motion ?? "fade"} onChange={(e) => updateScene({ motion: e.target.value })}>
              {MOTIONS.map((m) => <option key={m.id} value={m.id}>{m.ar}</option>)}
            </Select>
          </Field>
          <p className="text-[11px] leading-5 text-muted">المعاينة على اليمين تعرض هذا المشهد بعينه بالمتغيرات التجريبية.</p>
        </div>

        <div className="space-y-3 rounded-xl border border-navy-950/8 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold">الطبقات ({scene.layers.length})</p>
            <Button variant="outline" size="sm" onClick={addLayer}><Plus className="h-3.5 w-3.5" /> طبقة</Button>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {scene.layers.map((l, i) => (
              <div key={l.id} className="rounded-xl border border-navy-950/8 p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">{i + 1}. {l.type}</span>
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveLayer(l.id, -1)} aria-label="تقديم"><ChevronUp className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveLayer(l.id, 1)} aria-label="تأخير"><ChevronDown className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" onClick={() => removeLayer(l.id)} aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="النوع">
                    <Select value={l.type} onChange={(e) => updateLayer(l.id, { type: e.target.value as Layer["type"] })}>
                      {["text","ornament","image","qr","button"].map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </Field>
                  <Field label="متغير (اختياري)">
                    <Select value={l.variable ?? ""} onChange={(e) => updateLayer(l.id, { variable: e.target.value || undefined })}>
                      <option value="">— نص ثابت —</option>
                      {ALLOWED_VARS.map((v) => <option key={v} value={v}>{`{{${v}}}`}</option>)}
                    </Select>
                  </Field>
                </div>
                <div className="mt-2"><Field label="النص"><Input value={l.content ?? ""} onChange={(e) => updateLayer(l.id, { content: e.target.value })} /></Field></div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  <Field label="الحجم"><Input type="number" value={l.style?.fontSize ?? 16} onChange={(e) => updateLayer(l.id, { style: { ...l.style, fontSize: Number(e.target.value) } })} /></Field>
                  <Field label="الشفافية"><Input type="number" min={0} max={1} step={0.1} value={l.style?.opacity ?? 1} onChange={(e) => updateLayer(l.id, { style: { ...l.style, opacity: Number(e.target.value) } })} /></Field>
                  <Field label="س"> <Input type="number" value={l.style?.x ?? 0} onChange={(e) => updateLayer(l.id, { style: { ...l.style, x: Number(e.target.value) } })} /></Field>
                  <Field label="ص"> <Input type="number" value={l.style?.y ?? 0} onChange={(e) => updateLayer(l.id, { style: { ...l.style, y: Number(e.target.value) } })} /></Field>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Field label="اللون"><input type="color" value={l.style?.color ?? schema.palette.text} onChange={(e) => updateLayer(l.id, { style: { ...l.style, color: e.target.value } })} className="h-10 w-full cursor-pointer rounded-lg border p-1" /></Field>
                  <Field label="المحاذاة">
                    <Select value={l.style?.align ?? "center"} onChange={(e) => updateLayer(l.id, { style: { ...l.style, align: e.target.value as "right"|"center"|"left" } })}>
                      <option value="right">يمين</option><option value="center">وسط</option><option value="left">يسار</option>
                    </Select>
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}