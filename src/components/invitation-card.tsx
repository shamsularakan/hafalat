"use client";
import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { MapPin, CalendarPlus, Music4, Volume2, VolumeX, Play, Pause, Clock } from "lucide-react";
import { formatDualDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { substitute, layerText, safeImageUrl, type EngineSchema, type Layer, type Scene, type TemplateVars } from "@/lib/invitation-engine";
import { EditorialInvitation } from "./editorial-invitation";

export interface CardEvent {
  title: string; type: string; host_name: string | null; description?: string | null;
  starts_at: string | null; ends_at: string | null; timezone: string;
  venue_name: string | null; venue_address: string | null; map_url: string | null;
  is_virtual?: number; virtual_url?: string | null;
}

/** حركات المستوى الأول (القسم 05-2): قصيرة ووظيفية، transform/opacity، وتحترم reduced motion */
function useVariants(preset: string | undefined, reduced: boolean | null) {
  if (reduced) {
    return {
      coverExit: { opacity: 0, transition: { duration: 0 } },
      content: { initial: { opacity: 1 }, animate: { opacity: 1, transition: { duration: 0 } } },
      item: { initial: { opacity: 1 }, animate: { opacity: 1, transition: { duration: 0 } } },
    };
  }
  const t = { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };
  const contentByPreset: Record<string, any> = {
    envelope: { initial: { opacity: 0, y: 40, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1, transition: { ...t, delay: 0.15 } } },
    fade: { initial: { opacity: 0 }, animate: { opacity: 1, transition: t } },
    slide: { initial: { opacity: 0, x: 60 }, animate: { opacity: 1, x: 0, transition: t } },
    scale: { initial: { opacity: 0, scale: 0.88 }, animate: { opacity: 1, scale: 1, transition: t } },
    reveal: { initial: { clipPath: "inset(0 0 100% 0)" }, animate: { clipPath: "inset(0 0 0% 0)", transition: { duration: 0.6, ease: "easeOut" as const } } },
    flip: { initial: { opacity: 0, rotateY: -70 }, animate: { opacity: 1, rotateY: 0, transition: { ...t, duration: 0.55 } } },
  };
  const coverExitByPreset: Record<string, any> = {
    envelope: { opacity: 0, rotateX: 65, y: -30, transition: { duration: 0.4, ease: "easeIn" as const } },
    fade: { opacity: 0, transition: { duration: 0.25 } },
    slide: { opacity: 0, x: -60, transition: { duration: 0.3 } },
    scale: { opacity: 0, scale: 1.08, transition: { duration: 0.3 } },
    reveal: { opacity: 0, transition: { duration: 0.25 } },
    flip: { opacity: 0, rotateY: 70, transition: { duration: 0.35 } },
  };
  return {
    coverExit: coverExitByPreset[preset ?? "fade"] ?? coverExitByPreset.fade,
    content: contentByPreset[preset ?? "fade"] ?? contentByPreset.fade,
    item: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } } },
  };
}

export function InvitationCard({
  schema, event, guestName, opened, onOpen, children, compact, logoUrl, backgroundUrl, vars, scene, step,
}: {
  schema: EngineSchema;
  event: CardEvent;
  guestName?: string;
  opened: boolean;
  onOpen: () => void;
  children?: React.ReactNode; // منطقة RSVP/QR
  compact?: boolean;
  logoUrl?: string | null;
  backgroundUrl?: string | null;
  vars?: TemplateVars;
  scene?: Scene | null;
  step?: number;
}) {
  const reduced = useReducedMotion();
  if (schema.template_style === "editorial") {
    return (
      <EditorialInvitation
        schema={schema} event={event} vars={vars ?? {}} opened={opened} onOpen={onOpen}
        children={children} compact={compact} guestName={guestName} step={step ?? 0}
      />
    );
  }
  const v = useVariants(scene?.motion ?? schema.motion, reduced);
  const p = schema.palette;
  const dual = formatDualDate(event.starts_at, event.timezone);

  return (
    <div
      className={cn("relative mx-auto w-full overflow-hidden rounded-[2rem] shadow-2xl", compact ? "max-w-sm" : "max-w-md")}
      style={{ background: p.bg, color: p.text, perspective: 1200 }}
      dir="rtl"
    >
      {/* خلفية مخصصة */}
      {backgroundUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={backgroundUrl} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20" />
      )}
      {/* إطار زخرفي */}
      <div className="pointer-events-none absolute inset-3 rounded-[1.6rem] border" style={{ borderColor: p.accent + "55" }} />
      <div className="pointer-events-none absolute inset-4 rounded-[1.4rem] border" style={{ borderColor: p.primary + "22" }} />

      <AnimatePresence>
        {!opened ? (
          <motion.div
            key="cover"
            exit={v.coverExit}
            className={cn(
              opened
                ? "absolute inset-0 z-10 flex flex-col items-center justify-between gap-5 p-6 text-center sm:gap-6 sm:p-8"
                : "relative flex min-h-[30rem] flex-col items-center justify-between gap-5 p-6 text-center sm:min-h-[32rem] sm:gap-6 sm:p-8",
            )}
            style={{ transformOrigin: "top center" }}
          >
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="شعار المناسبة" className="mx-auto mb-2 h-12 w-auto object-contain" />
            )}
            <motion.span
              className="text-4xl"
              style={{ color: p.accent }}
              animate={reduced ? {} : { rotate: [0, 8, -8, 0], scale: [1, 1.08, 1] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            >
              {schema.cover.ornament || "✦"}
            </motion.span>
            <div>
              {scene?.layers?.length ? (
                <LayerStack layers={scene.layers} vars={vars ?? {}} palette={p} display={guestName ? { "guest.name": guestName } : {}} />
              ) : (
                <>
                  <p className="text-xs tracking-[0.3em]" style={{ color: p.muted }}>{substitute(schema.cover.subtitle, vars ?? {})}</p>
                  <h1 className="font-display mt-3 text-2xl font-bold leading-relaxed sm:text-3xl" style={{ color: p.text }}>
                    {substitute(schema.cover.title, vars ?? {})}
                  </h1>
                  {schema.cover.hosts && <p className="mt-3 text-sm" style={{ color: p.primary }}>{substitute(schema.cover.hosts, vars ?? {})}</p>}
                </>
              )}
              {guestName && (
                <p className="mt-5 inline-block rounded-full border px-4 py-1.5 text-xs" style={{ borderColor: p.accent + "66", color: p.muted }}>
                  دعوة خاصة باسم <span className="font-bold" style={{ color: p.text }}>{guestName}</span>
                </p>
              )}
            </div>
            <div className="w-full space-y-3">
              <button
                onClick={onOpen}
                className="w-full cursor-pointer rounded-2xl py-3.5 text-base font-extrabold transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: p.primary, color: p.bg }}
              >
                فتح الدعوة ♪
              </button>
              <p className="flex items-center justify-center gap-1.5 text-[10px]" style={{ color: p.muted }}>
                <Music4 className="h-3 w-3" /> يبدأ النشيد بعد ضغطك — تحكم كامل بالصوت
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div key="content" {...v.content} className="relative space-y-5 p-6 pt-8 text-center sm:space-y-6 sm:p-8 sm:pt-10">
            <motion.div {...v.item} transition={{ delay: reduced ? 0 : 0.1 }}>
              <span className="text-2xl" style={{ color: p.accent }} aria-hidden>{schema.cover.ornament || "✦"}</span>
              <h2 className="font-display mt-2 text-xl font-bold leading-relaxed sm:text-2xl">{substitute(schema.cover.title, vars ?? {})}</h2>
              {schema.cover.hosts && <p className="mt-1 text-sm" style={{ color: p.primary }}>{substitute(schema.cover.hosts, vars ?? {})}</p>}
              {guestName && <p className="mt-2 text-xs" style={{ color: p.muted }}>ضيفنا الكريم: <b style={{ color: p.text }}>{guestName}</b></p>}
            </motion.div>

            {scene?.layers?.length ? (
              <LayerStack layers={scene.layers} vars={vars ?? {}} palette={p} display={guestName ? { "guest.name": guestName } : {}} />
            ) : (
              <motion.p {...v.item} transition={{ delay: reduced ? 0 : 0.2 }} className="text-sm leading-8" style={{ color: p.text + "dd" }}>
                {substitute(schema.details.message, vars ?? {})}
              </motion.p>
            )}

            {dual && (
              <motion.div {...v.item} transition={{ delay: reduced ? 0 : 0.3 }}
                className="rounded-2xl border p-4" style={{ borderColor: p.accent + "44", background: p.card + "22" }}>
                <p className="text-xs" style={{ color: p.muted }}>{schema.details.date_label}</p>
                <p className="font-display mt-1 text-lg font-bold" style={{ color: p.primary }}>{dual.hijri}</p>
                <p className="mt-0.5 text-sm" style={{ color: p.text }}>{dual.gregorian} · {dual.time}</p>
                {schema.show_countdown && event.starts_at && <Countdown target={event.starts_at} palette={p} />}
              </motion.div>
            )}

            {(event.venue_name || event.venue_address || event.is_virtual) && (
              <motion.div {...v.item} transition={{ delay: reduced ? 0 : 0.4 }} className="space-y-1.5">
                <p className="text-xs" style={{ color: p.muted }}>{schema.details.venue_label}</p>
                <p className="text-sm font-bold">
                  {event.is_virtual ? "مناسبة افتراضية — عن بُعد" : [event.venue_name, event.venue_address].filter(Boolean).join(" — ")}
                </p>
                {event.map_url && !event.is_virtual && (
                  <a href={event.map_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-transform hover:scale-105"
                    style={{ borderColor: p.primary + "66", color: p.primary }}>
                    <MapPin className="h-3.5 w-3.5" /> الاتجاهات على الخريطة
                  </a>
                )}
                {event.is_virtual && event.virtual_url && (
                  <a href={event.virtual_url} target="_blank" rel="noreferrer"
                    className="inline-block rounded-full border px-3.5 py-1.5 text-xs font-bold"
                    style={{ borderColor: p.primary + "66", color: p.primary }}>
                    رابط الاجتماع
                  </a>
                )}
              </motion.div>
            )}

            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** عرض طبقات المشهد — نفس المحرك في المعاينة وصفحة المدعو */
function LayerStack({
  layers, vars, palette, display,
}: {
  layers: Layer[];
  vars: TemplateVars;
  palette: EngineSchema["palette"];
  display?: TemplateVars;
}) {
  return (
    <div className="space-y-2">
      {layers.map((l) => {
        const merged = { ...vars, ...display };
        const text = layerText(l, merged);
        if (!text) return null;
        const st = l.style ?? {};
        if (l.type === "ornament") {
          return <div key={l.id} className="text-3xl" style={{ color: st.color ?? palette.accent, opacity: st.opacity ?? 1 }} aria-hidden>{text}</div>;
        }
        if (l.type === "image") {
          const src = safeImageUrl(text);
          return src ? <img key={l.id} src={src} alt="" className="mx-auto max-h-48 rounded-xl object-cover" style={{ opacity: st.opacity ?? 1 }} /> : null;
        }
        if (l.type === "monogram") {
          return <p key={l.id} className="font-display text-3xl tracking-[.2em]" style={{ color: st.color ?? palette.accent }}>{text}</p>;
        }
        if (l.type === "program") {
          const items = text.split("\n").map((x) => x.trim()).filter(Boolean);
          if (!items.length) return null;
          return (
            <div key={l.id} className="space-y-2 text-right">
              {items.map((line, i) => {
                const [time, ...rest] = line.split("|");
                return (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: palette.card + "33" }}>
                    <span className="text-xs font-bold" style={{ color: palette.text }}>{rest.join("|")}</span>
                    <span className="text-[11px]" dir="ltr" style={{ color: palette.accent }}>{time}</span>
                  </div>
                );
              })}
            </div>
          );
        }
        if (l.type === "qr" || l.type === "button" || l.type === "audio") return null; // تُرسم عناصر التفاعل في GuestClient
        return (
          <p key={l.id}
            className="leading-8"
            style={{
              fontSize: st.fontSize ?? 14,
              color: st.color ?? palette.text,
              textAlign: st.align ?? "center",
              opacity: st.opacity ?? 1,
              fontWeight: st.weight === "bold" ? 700 : 400,
              transform: `translate(${st.x ?? 0}px, ${st.y ?? 0}px)`,
            }}>
            {text}
          </p>
        );
      })}
    </div>
  );
}

function Countdown({ target, palette }: { target: string; palette: EngineSchema["palette"] }) {
  const [left, setLeft] = React.useState(() => Math.max(0, Date.parse(target) - Date.now()));
  React.useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Date.parse(target) - Date.now())), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (left <= 0) return <p className="mt-2 text-xs font-bold" style={{ color: palette.accent }}>بدأت المناسبة — حياكم الله!</p>;
  const d = Math.floor(left / 864e5);
  const h = Math.floor((left % 864e5) / 3600e3);
  const m = Math.floor((left % 3600e3) / 60e3);
  const s = Math.floor((left % 60e3) / 1000);
  const cells = [
    { v: d, l: "يوم" }, { v: h, l: "ساعة" }, { v: m, l: "دقيقة" }, { v: s, l: "ثانية" },
  ];
  return (
    <div className="mt-3 flex items-center justify-center gap-1.5 sm:gap-2" aria-label="العد التنازلي للموعد">
      <Clock className="h-3.5 w-3.5" style={{ color: palette.muted }} />
      {cells.map((c) => (
        <div key={c.l} className="min-w-10 rounded-lg px-1.5 py-1 sm:min-w-12 sm:px-2" style={{ background: palette.card + "33" }}>
          <p className="text-sm font-extrabold tabular-nums sm:text-base" style={{ color: palette.text }}>{String(c.v).padStart(2, "0")}</p>
          <p className="text-[9px]" style={{ color: palette.muted }}>{c.l}</p>
        </div>
      ))}
    </div>
  );
}

/** مشغل النشيد — لا تشغيل تلقائي قبل تفاعل الضيف (القسم 05-3 / AC-08) */
export function AudioPlayer({ src, palette, autoTryPlay }: { src: string; palette: EngineSchema["palette"]; autoTryPlay: boolean }) {
  const ref = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [volume, setVolume] = React.useState(0.7);
  const [blocked, setBlocked] = React.useState(false);

  React.useEffect(() => {
    const a = ref.current;
    if (!a) return;
    a.volume = volume;
    if (autoTryPlay) {
      a.play().then(() => { setPlaying(true); setBlocked(false); }).catch(() => { setBlocked(true); setPlaying(false); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTryPlay]);

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else a.play().then(() => { setPlaying(true); setBlocked(false); }).catch(() => setBlocked(true));
  }

  return (
    <div className="mx-auto mt-4 flex w-fit items-center gap-3 rounded-full border px-4 py-2"
      style={{ borderColor: palette.primary + "44", background: palette.card + "22" }}>
      <audio ref={ref} src={src} loop preload="none" />
      <button onClick={toggle} aria-label={playing ? "إيقاف النشيد" : "تشغيل النشيد"}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110"
        style={{ background: palette.primary, color: palette.bg }}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button onClick={() => { const a = ref.current; if (a) { a.muted = !muted; setMuted(!muted); } }}
        aria-label={muted ? "إلغاء الكتم" : "كتم"} className="cursor-pointer" style={{ color: palette.muted }}>
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
      <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
        onChange={(e) => { const v = Number(e.target.value); setVolume(v); setMuted(v === 0); const a = ref.current; if (a) { a.volume = v; a.muted = v === 0; } }}
        className="w-16 cursor-pointer sm:w-20" style={{ accentColor: palette.primary }} aria-label="مستوى الصوت" />
      {blocked && <span className="text-[10px]" style={{ color: palette.muted }}>اضغط للتشغيل</span>}
    </div>
  );
}

export function CalendarButton({ href, palette }: { href: string; palette: EngineSchema["palette"] }) {
  return (
    <a href={href} download
      className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-transform hover:scale-105"
      style={{ borderColor: palette.primary + "66", color: palette.primary }}>
      <CalendarPlus className="h-3.5 w-3.5" /> أضف إلى تقويمك
    </a>
  );
}
