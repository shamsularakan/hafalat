"use client";
/**
 * الدعوة الكاملة — صفحة واحدة بترتيب «قالب الدعوة» المعتمد:
 * دعوة خاصة باسم المدعو ولقبه ← الصورة وعنوان الحفل ← اليوم والتاريخان والتقويم ← العد التنازلي
 * ← القاعة والموقع (صورة + QR) ← فقرات الحفل ← تأكيد الحضور والتذكرة ← العبارة الختامية
 * ← معلومات الضيوف ← «اترك بصمتك الجميلة».
 * كل النصوص تمر عبر substitute() الآمنة، والصور عبر safeImageUrl().
 */
import * as React from "react";
import QRCode from "qrcode";
import { motion, useReducedMotion } from "motion/react";
import { CalendarPlus, MapPin, Heart, Check, X, Minus, Plus, Loader2, QrCode, Printer } from "lucide-react";
import { api } from "@/lib/client";
import { formatDualDate } from "@/lib/dates";
import { substitute, safeImageUrl, type EngineSchema, type TemplateVars } from "@/lib/invitation-engine";
import { AudioPlayer } from "@/components/invitation-card";

export interface ScrollEvent {
  title: string; starts_at: string | null; timezone: string;
  venue_name: string | null; venue_address: string | null; map_url: string | null;
}

/** وضع الضيف الحي (token) أو المعاينة في المحرر (بدون token) */
export interface ScrollGuestState {
  token: string;
  status: string;
  companions_allowed: number;
  accepts_rsvp: boolean;
  rsvp: { answer: string; persons_confirmed: number; message: string | null } | null;
  calendar_url: string;
  audio_url: string | null;
  wish: string | null;
  wishes_open: boolean;
  category?: string;
}

const ROSE = "#E9A7B4";
/** أسماء أيام قصيرة واضحة تتسع لعمود الجوال (لا قصّ «الس»/«الأ») */
const WEEK = ["سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];
/** أرقام موحّدة في الدعوة كلها (القالب يستخدم 0-9) */
const latin = (s: string) => s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));

function partsIn(iso: string, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", weekday: "short" });
  const o = Object.fromEntries(f.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { y: Number(o.year), m: Number(o.month), d: Number(o.day) };
}

/** شبكة الشهر بأسبوع يبدأ بالسبت، مع تمييز يوم المناسبة */
function MonthGrid({ iso, tz, color, mark }: { iso: string; tz: string; color: string; mark: string }) {
  const { y, m, d } = partsIn(iso, tz);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0=الأحد
  const lead = (first + 1) % 7; // إزاحة لتبدأ بالسبت
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const monthName = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="mx-auto w-full max-w-xs" aria-label={`تقويم ${monthName}`}>
      <p className="mb-2 text-center text-xs font-bold" style={{ color }}>{monthName}</p>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid">
        {WEEK.map((w) => <span key={w} className="truncate pb-1 text-[9px] font-bold sm:text-[10px]" style={{ color }} role="columnheader">{w}</span>)}
        {cells.map((c, i) => (
          <span key={i} role="gridcell" aria-current={c === d ? "date" : undefined}
            className="relative flex aspect-square items-center justify-center rounded-md text-xs tabular-nums"
            style={c === d ? { background: mark, color: "#fff", fontWeight: 800 } : { background: c ? "rgba(255,255,255,.14)" : "transparent", color }}>
            {c ?? ""}
            {c === d && <Heart className="absolute -top-1.5 -left-1 h-3.5 w-3.5 fill-current" style={{ color: ROSE }} aria-hidden />}
          </span>
        ))}
      </div>
    </div>
  );
}

function Countdown({ target, color }: { target: string; color: string }) {
  const [left, setLeft] = React.useState(() => Math.max(0, Date.parse(target) - Date.now()));
  React.useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Date.parse(target) - Date.now())), 1000);
    return () => clearInterval(t);
  }, [target]);
  const cells = [
    { v: Math.floor(left / 864e5), l: "يومًا" },
    { v: Math.floor((left % 864e5) / 3600e3), l: "ساعة" },
    { v: Math.floor((left % 3600e3) / 60e3), l: "دقيقة" },
    { v: Math.floor((left % 60e3) / 1000), l: "ثانية" },
  ];
  return (
    <div className="flex justify-center gap-2" role="timer" aria-label="العد التنازلي">
      {cells.map((c) => (
        <div key={c.l} className="w-16 overflow-hidden rounded-lg border text-center" style={{ borderColor: ROSE }}>
          <p className="py-0.5 text-[11px] font-bold" style={{ background: ROSE, color: "#4A1F28" }}>{c.l}</p>
          <p className="py-1.5 text-2xl font-extrabold tabular-nums" style={{ color }}>{String(c.v).padStart(2, "0")}</p>
        </div>
      ))}
    </div>
  );
}

function MapQr({ url }: { url: string }) {
  const [src, setSrc] = React.useState("");
  React.useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#2E2A26", light: "#FFFFFF" } }).then(setSrc).catch(() => setSrc(""));
  }, [url]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="رمز QR لموقع القاعة" className="mx-auto h-28 w-28 rounded-lg bg-white p-1.5" /> : null;
}

function Section({ children, dark, palette, className = "" }: { children: React.ReactNode; dark?: boolean; palette: EngineSchema["palette"]; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`px-6 py-9 text-center sm:px-9 ${className}`}
      style={dark ? { background: palette.card, color: "#FBF8F5" } : { background: palette.bg, color: palette.text }}
    >
      {children}
    </motion.section>
  );
}

export function ScrollInvitation({
  schema, event, vars, guestName, guestTitle, guest, compact,
}: {
  schema: EngineSchema;
  event: ScrollEvent;
  vars: TemplateVars;
  guestName?: string;
  guestTitle?: string | null;
  guest?: ScrollGuestState;
  compact?: boolean;
}) {
  const p = schema.palette;
  const v = (k: string) => substitute(String(vars[k] ?? ""), vars);
  const tz = event.timezone || "Asia/Riyadh";
  const dual = formatDualDate(event.starts_at, tz);
  const dayName = event.starts_at ? new Date(event.starts_at).toLocaleDateString("ar-SA-u-nu-latn", { weekday: "long", timeZone: tz }) : "";
  const photo = safeImageUrl(v("event.photo") || schema.details?.photo_url || "");
  const venuePhoto = safeImageUrl(v("event.venue_photo") || schema.details?.venue_photo_url || "");
  const program = v("event.program").split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => { const [time, ...rest] = l.split("|"); return { time: time?.trim() ?? "", title: rest.join("|").trim() }; })
    .filter((x) => x.title);
  const notes = (v("event.guest_notes") || schema.details?.guest_notes || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const title = guestTitle ?? (v("guest.title") || "");
  const name = guestName ?? v("guest.name");
  const invitationLine = v("event.invitation_line") || schema.details?.invitation_line || "يسرّنا ويشرّفنا حضوركم ومشاركتكم فرحتنا";
  const closing = v("event.closing_line") || schema.details?.closing_line || "بحضوركم تزدان أفراحنا، وبكم تكتمل مسرّاتنا.";
  const deadline = v("event.rsvp_deadline");
  const isPast = event.starts_at ? Date.parse(event.starts_at) < Date.now() : false;

  return (
    <div className={`mx-auto w-full overflow-hidden shadow-2xl ${compact ? "max-w-sm rounded-3xl" : "max-w-md sm:rounded-3xl"}`} style={{ background: p.bg }} dir="rtl">
      {/* 1) دعوة خاصة باسم المدعو */}
      <Section dark palette={p}>
        <p className="text-sm tracking-wide" style={{ color: "#F2E9D4" }}>دعوة خاصة</p>
        {title && <p className="mt-3 text-xs" style={{ color: "rgba(251,248,245,.8)" }}>{title}</p>}
        {name && <h1 className="font-display mt-1 text-3xl font-bold leading-[1.5]">{name}</h1>}
        <p className="mx-auto mt-2 max-w-xs text-sm leading-7" style={{ color: "rgba(251,248,245,.85)" }}>{invitationLine}</p>
      </Section>

      {/* 2) الصورة وعنوان الحفل */}
      <Section palette={p} className="pt-6">
        {photo ? (
          <div className="relative mx-auto aspect-[4/5] w-full max-w-xs overflow-hidden rounded-2xl shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="صورة المناسبة" className="h-full w-full object-cover" />
            <span className="font-display pointer-events-none absolute inset-x-0 bottom-1 text-center text-7xl font-bold"
              style={{ color: p.accent, textShadow: "0 2px 18px rgba(0,0,0,.45)" }} aria-hidden>دعوة</span>
          </div>
        ) : (
          <p className="font-display text-7xl font-bold" style={{ color: p.accent }} aria-hidden>دعوة</p>
        )}
        <h2 className="font-display mt-5 text-4xl font-bold" style={{ color: p.text }}>{event.title}</h2>
        {guest?.audio_url && <div className="mx-auto mt-5 max-w-xs"><AudioPlayer src={guest.audio_url} palette={p} autoTryPlay={false} /></div>}
      </Section>

      {/* 3) اليوم والتاريخان والتقويم */}
      {event.starts_at && (
        <Section dark palette={p}>
          <p className="text-xs" style={{ color: "rgba(251,248,245,.8)" }}>وذلك بمشيئة الله تعالى</p>
          <p className="font-display mt-2 text-2xl font-bold">يوم {dayName}</p>
          {dual?.hijri && <p className="mt-1 text-sm">{latin(dual.hijri)}</p>}
          <p className="mt-1 text-xs" style={{ color: "#F2E9D4" }}>الاستقبال الساعة {latin(dual?.time ?? "")}</p>
          <p className="mt-1 text-sm">{latin(dual?.gregorian ?? "")}</p>
          <div className="mt-5"><MonthGrid iso={event.starts_at} tz={tz} color="#FBF8F5" mark={p.primary} /></div>
          {guest && (
            <a href={guest.calendar_url} className="mt-5 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold" style={{ borderColor: "rgba(251,248,245,.5)" }}>
              <CalendarPlus className="h-4 w-4" /> اضغط هنا للإضافة إلى التقويم
            </a>
          )}
        </Section>
      )}

      {/* 4) العد التنازلي */}
      {event.starts_at && !isPast && (
        <Section palette={p}>
          <p className="mb-3 text-sm font-bold" style={{ color: p.text }}>العد التنازلي</p>
          <Countdown target={event.starts_at} color={p.text} />
        </Section>
      )}

      {/* 5) القاعة والموقع */}
      {(event.venue_name || event.venue_address || venuePhoto) && (
        <Section dark palette={p}>
          {venuePhoto && (
            <div className="mx-auto mb-5 aspect-video w-full max-w-xs overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={venuePhoto} alt={`صورة ${event.venue_name ?? "القاعة"}`} className="h-full w-full object-cover" />
            </div>
          )}
          {event.venue_name && <p className="font-display text-2xl font-bold">{event.venue_name}</p>}
          {event.venue_address && <p className="mt-1 text-sm" style={{ color: "rgba(251,248,245,.85)" }}>{event.venue_address}</p>}
          {event.map_url && (
            <>
              <div className="mt-4"><MapQr url={event.map_url} /></div>
              <a href={event.map_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold underline decoration-2 underline-offset-4" style={{ color: "#FBF8F5", textDecorationColor: ROSE }}>
                <MapPin className="h-4 w-4" /> عرض الموقع
              </a>
            </>
          )}
        </Section>
      )}

      {/* 6) فقرات الحفل — مسار متعرج كالقالب */}
      {program.length > 0 && (
        <Section palette={p}>
          <h3 className="font-display mb-6 text-2xl font-bold">فقرات الحفل</h3>
          <ol className="mx-auto max-w-xs">
            {program.map((x, i) => {
              const right = i % 2 === 0;
              const last = i === program.length - 1;
              return (
                <li key={i} className="relative flex min-h-24" style={{ flexDirection: right ? "row" : "row-reverse" }}>
                  {/* المنحنى الواصل */}
                  {!last && (
                    <span aria-hidden className="absolute top-4 h-full w-1/2"
                      style={{
                        [right ? "right" : "left"]: "1rem",
                        border: `2px solid ${p.text}`,
                        [right ? "borderLeft" : "borderRight"]: "none",
                        borderTop: "none",
                        borderRadius: right ? "0 0 2.5rem 0" : "0 0 0 2.5rem",
                      } as React.CSSProperties} />
                  )}
                  <span className="relative z-10 mt-1 h-8 w-8 shrink-0 rounded-full" style={{ background: p.text }} aria-hidden />
                  {/* النص تحت مستوى الخط الأفقي حتى لا يمر المنحنى فوق العنوان */}
                  <div className={`relative z-10 flex-1 px-3 pt-9 ${right ? "text-right" : "text-left"}`}>
                    <p className="text-sm font-bold">{x.title}</p>
                    <p className="text-xs tabular-nums" dir="ltr" style={{ color: p.muted }}>{x.time}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      {/* 7) تأكيد الحضور */}
      <Section palette={p} className="pt-2">
        {deadline && <p className="font-display text-xl leading-9">نأمل منكم تأكيد حضوركم<br />قبل {deadline}</p>}
        {guest ? <RsvpBlock guest={guest} palette={p} name={name} /> : (
          <div className="mx-auto mt-4 flex max-w-xs flex-col gap-2">
            <span className="rounded-lg py-2.5 text-sm font-bold text-white" style={{ background: "#2E2A26" }}>يسعدني الحضور</span>
            <span className="rounded-lg py-2.5 text-sm font-bold text-white" style={{ background: "#2E2A26" }}>يتعذّر عليّ الحضور</span>
          </div>
        )}
      </Section>

      {/* 8) العبارة الختامية */}
      <Section palette={p} className="pt-0">
        <p className="font-display mx-auto max-w-xs text-xl leading-9">{closing}</p>
      </Section>

      {/* 9) معلومات الضيوف */}
      {notes.length > 0 && (
        <Section palette={p} className="pt-0">
          <h3 className="mb-3 text-lg font-bold" style={{ color: "#C0453A" }}>معلومات الضيوف</h3>
          <ul className="mx-auto max-w-xs space-y-2 text-right text-sm">
            {notes.map((n) => <li key={n} className="flex items-start gap-2"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.text }} aria-hidden />{n}</li>)}
          </ul>
        </Section>
      )}

      {/* 10) اترك بصمتك الجميلة */}
      {schema.details?.wishes_enabled !== false && (
        <Section dark palette={p}>
          <p className="flex items-center justify-center gap-1.5 text-sm font-bold">اترك بصمتك الجميلة <Heart className="h-4 w-4 fill-current" style={{ color: ROSE }} aria-hidden /></p>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-6" style={{ color: "rgba(251,248,245,.85)" }}>شاركنا فرحتنا بكلماتك الطيبة، واترك تهنئة تبقى ذكرى جميلة في قلوبنا.</p>
          <WishBox guest={guest} palette={p} />
        </Section>
      )}
    </div>
  );
}

function RsvpBlock({ guest, palette: p, name }: { guest: ScrollGuestState; palette: EngineSchema["palette"]; name: string }) {
  const [state, setState] = React.useState(guest);
  const [answer, setAnswer] = React.useState<"confirmed" | "declined" | null>((guest.rsvp?.answer as any) ?? null);
  const [persons, setPersons] = React.useState(guest.rsvp?.persons_confirmed || 1);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [showQr, setShowQr] = React.useState(false);
  const max = 1 + state.companions_allowed;
  const confirmed = ["confirmed", "checked_in"].includes(state.status);

  async function send(a: "confirmed" | "declined") {
    setAnswer(a); setBusy(true); setError("");
    try {
      await api.post(`/api/i/${state.token}/rsvp`, { answer: a, persons: a === "confirmed" ? persons : 0 });
      const fresh = await api.get<any>(`/api/i/${state.token}`);
      setState((s) => ({ ...s, status: fresh.status, rsvp: fresh.rsvp, accepts_rsvp: fresh.accepts_rsvp }));
      if (a === "confirmed") setShowQr(true);
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  }

  if (state.status === "checked_in") return <p className="mt-4 text-lg font-extrabold" style={{ color: p.primary }}>تم تسجيل دخولك — أهلًا بك</p>;

  return (
    <div className="mx-auto mt-5 max-w-xs space-y-3">
      {max > 1 && !confirmed && (
        <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: p.muted + "55" }}>
          <span className="text-xs font-bold">عدد الحضور (أنت والمرافقون)</span>
          <div className="flex items-center gap-2">
            <button aria-label="إنقاص" onClick={() => setPersons((x) => Math.max(1, x - 1))} disabled={persons <= 1} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white disabled:opacity-40" style={{ background: "#2E2A26" }}><Minus className="h-4 w-4" /></button>
            <span className="w-5 text-center text-lg font-extrabold tabular-nums">{persons}</span>
            <button aria-label="زيادة" onClick={() => setPersons((x) => Math.min(max, x + 1))} disabled={persons >= max} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white disabled:opacity-40" style={{ background: "#2E2A26" }}><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      )}
      {confirmed ? (
        <div className="rounded-2xl border-2 p-4" style={{ borderColor: p.accent }}>
          <p className="flex items-center justify-center gap-1.5 font-extrabold" style={{ color: p.primary }}><Check className="h-5 w-5" /> حضورك مؤكد</p>
          <p className="mt-1 text-xs" style={{ color: p.muted }}>{name} · {state.rsvp?.persons_confirmed ?? 1} {(state.rsvp?.persons_confirmed ?? 1) > 1 ? "أشخاص" : "شخص"}</p>
          <button onClick={() => setShowQr((x) => !x)} className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold" style={{ borderColor: p.primary }}>
            <QrCode className="h-4 w-4" /> {showQr ? "إخفاء تذكرة الدخول" : "تذكرة الدخول"}
          </button>
          {showQr && (
            <div className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/i/${state.token}/qr.svg`} alt="رمز الدخول" className="mx-auto h-auto w-44 rounded-xl bg-white p-2" />
              <p className="mt-2 text-[11px]" style={{ color: p.muted }}>اعرض هذا الرمز عند بوابة القاعة</p>
              <button onClick={() => window.print()} className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-bold" style={{ color: p.primary }}><Printer className="h-3.5 w-3.5" /> حفظ التذكرة</button>
            </div>
          )}
          {state.accepts_rsvp && <button onClick={() => send("declined")} className="mt-3 block w-full cursor-pointer text-[11px] underline" style={{ color: p.muted }}>تغيّرت ظروفي — أعتذر عن الحضور</button>}
        </div>
      ) : (
        <>
          <button onClick={() => send("confirmed")} disabled={busy || !state.accepts_rsvp}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg py-3 text-sm font-bold text-white disabled:opacity-50" style={{ background: "#2E2A26" }}>
            {busy && answer === "confirmed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} يسعدني الحضور
          </button>
          <button onClick={() => send("declined")} disabled={busy || !state.accepts_rsvp}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg py-3 text-sm font-bold text-white disabled:opacity-50" style={{ background: "#2E2A26" }}>
            {busy && answer === "declined" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} يتعذّر عليّ الحضور
          </button>
          {state.rsvp?.answer === "declined" && <p className="text-xs" style={{ color: p.muted }}>سجّلنا اعتذارك — شكرًا لك، ويمكنك تغيير ردك.</p>}
          {!state.accepts_rsvp && <p className="text-xs" style={{ color: p.muted }}>انتهت فترة تأكيد الحضور.</p>}
        </>
      )}
      {error && <p className="text-xs font-bold" style={{ color: "#C0453A" }} role="alert">{error}</p>}
    </div>
  );
}

function WishBox({ guest, palette: p }: { guest?: ScrollGuestState; palette: EngineSchema["palette"] }) {
  const [text, setText] = React.useState(guest?.wish ?? "");
  const [saved, setSaved] = React.useState(!!guest?.wish);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const open = !!guest?.wishes_open;
  async function send() {
    if (!guest) return;
    setBusy(true); setError("");
    try { await api.post(`/api/i/${guest.token}/wish`, { message: text }); setSaved(true); }
    catch (e: any) { setError(e.message); }
    setBusy(false);
  }
  return (
    <div className="mx-auto mt-4 max-w-xs">
      <textarea value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} disabled={!open} maxLength={500} rows={4}
        placeholder="اكتب تهنئتك هنا…" aria-label="تهنئتك"
        className="w-full rounded-xl border-2 bg-white/95 px-3 py-2 text-sm text-[#2E2A26] placeholder:text-[#8A847A] focus:outline-none disabled:opacity-70"
        style={{ borderColor: ROSE }} />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] leading-5" style={{ color: "rgba(251,248,245,.8)" }}>
          {open ? (saved ? "وصلت تهنئتك — شكرًا لك" : "تصل تهنئتك لأصحاب المناسبة") : "سيتم تفعيل التهنئة للحاضرين وغير الحاضرين في يوم العرس"}
        </p>
        <button onClick={send} disabled={!open || busy || text.trim().length < 2}
          className="shrink-0 cursor-pointer rounded-lg px-5 py-2 text-sm font-bold disabled:opacity-50" style={{ background: "#FBF8F5", color: "#2E2A26" }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? "تعديل" : "أرسل"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs font-bold" style={{ color: ROSE }} role="alert">{error}</p>}
    </div>
  );
}
