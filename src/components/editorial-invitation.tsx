"use client";
/**
 * قالب الدعوة البصري — ليلتنا
 * هوية كريمية/زيتونية/ذهبية، ثلاث لوحات: الغلاف (مع صورة اختيارية)، البرنامج، والتأكيد/التذكرة.
 * كل النصوص تمر عبر substitute() الآمنة، والصورة تُفلتر عبر safeImageUrl().
 */
import * as React from "react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { CarFront, BedDouble, Camera, Gift, Quote, MapPin, Music4, Play } from "lucide-react";
import { formatDualDate } from "@/lib/dates";
import { substitute, safeImageUrl, type EngineSchema, type TemplateVars } from "@/lib/invitation-engine";
import type { CardEvent } from "./invitation-card";

function Sprig({ className = "", flip = false, style }: { className?: string; flip?: boolean; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden className={className} style={{ ...style, ...(flip ? { transform: "scaleX(-1)" } : {}) }}>
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M60 116 C58 82 60 52 74 22" />
        <path d="M61 96 C46 88 38 76 35 62 C50 66 59 76 61 96Z" fill="currentColor" fillOpacity=".14" />
        <path d="M64 80 C78 74 86 62 89 48 C75 52 66 62 64 80Z" fill="currentColor" fillOpacity=".14" />
        <path d="M68 58 C55 52 48 42 46 30 C59 34 67 43 68 58Z" fill="currentColor" fillOpacity=".14" />
        <path d="M73 36 C84 31 90 23 92 13 C80 16 74 24 73 36Z" fill="currentColor" fillOpacity=".14" />
      </g>
    </svg>
  );
}

function InfoRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 text-right">
      <span className="mt-0.5 shrink-0" style={{ color }}>{icon}</span>
      <div>
        <p className="text-[10px] tracking-wider" style={{ color: "rgba(251,248,245,.6)" }}>{label}</p>
        <p className="text-xs leading-6" style={{ color: "#FBF8F5" }}>{value}</p>
      </div>
    </div>
  );
}

export function EditorialInvitation({
  schema, event, vars, opened, onOpen, children, compact, guestName, step,
}: {
  schema: EngineSchema;
  event: CardEvent;
  vars: TemplateVars;
  opened: boolean;
  onOpen: () => void;
  children?: React.ReactNode;
  compact?: boolean;
  guestName?: string;
  step: number;
}) {
  const reduced = useReducedMotion();
  const p = schema.palette;
  const v = (k: string) => substitute(String(vars[k] ?? ""), vars);
  const photo = safeImageUrl(v("event.photo") || schema.details?.photo_url || "");
  const dual = formatDualDate(event.starts_at, event.timezone);
  const dayName = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString("ar-SA-u-nu-latn", { weekday: "long", timeZone: event.timezone || "Asia/Riyadh" })
    : "";
  const program = v("event.program")
    .split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => { const [time, ...rest] = l.split("|"); return { time: time?.trim() ?? "", title: rest.join("|").trim() }; })
    .filter((x) => x.title);
  const mono = v("event.monogram") || schema.details?.monogram || "";
  const g = v("event.groom") || schema.details?.groom || "";
  const b = v("event.bride") || schema.details?.bride || "";
  const names = [g, b].filter(Boolean).join(" و ");

  const fade = reduced ? { initial: { opacity: 1 }, animate: { opacity: 1 } } : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: .45, ease: "easeOut" as const } } };

  return (
    <div className={compact ? "max-w-sm" : "max-w-md"} style={{ background: p.bg, color: p.text }} dir="rtl">
      <AnimatePresence mode="wait">
        {!opened ? (
          <motion.div key="cover" exit={{ opacity: 0, y: -20 }} className="relative min-h-[34rem] overflow-hidden px-7 pb-8 pt-10 text-center sm:min-h-[38rem] sm:px-10">
            <Sprig className="absolute -top-6 right-2 h-32 w-32 opacity-70" style={{ color: p.accent }} />
            <Sprig className="absolute -bottom-8 left-0 h-40 w-40 opacity-60" flip style={{ color: p.accent }} />
            <motion.div {...fade} className="relative">
              {mono && <p className="font-display text-3xl tracking-[.15em]" style={{ color: p.primary }}>{mono}</p>}
              <p className="mt-2 text-[11px]" style={{ color: p.muted }}>بسم الله الرحمن الرحيم</p>
              <h1 className="font-display mt-5 text-3xl leading-[1.5] sm:text-4xl" style={{ color: p.text }}>
                {names || substitute(schema.cover.title, vars)}
              </h1>
              <p className="mx-auto mt-4 max-w-[16rem] text-xs leading-7" style={{ color: p.muted }}>
                {v("event.invitation_line") || schema.details?.invitation_line || schema.cover.subtitle}
              </p>
              <div className="mx-auto my-5 h-px w-24" style={{ background: p.accent }} />
              <p className="font-display text-base font-bold" style={{ color: p.primary }}>
                {dayName ? `${dayName} — ` : ""}{v("event.date") || dual?.gregorian}
              </p>
              <p className="mt-1 text-xs" style={{ color: p.muted }}>{v("event.venue") || event.venue_name}</p>
              {event.starts_at && <p className="mt-1 text-xs" style={{ color: p.muted }}>الاستقبال الساعة {dual?.time || v("event.time")}</p>}

              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <div className="mx-auto mt-6 h-52 w-40 overflow-hidden shadow-lg sm:h-60 sm:w-44" style={{ borderRadius: "48% 48% 12px 12px / 30% 30% 12px 12px", border: `2px solid ${p.accent}` }}>
                  <img src={photo} alt="صورة العريس" className="h-full w-full object-cover" />
                </div>
              )}
              {guestName && <p className="mt-5 text-[11px]" style={{ color: p.muted }}>دعوة خاصة باسم <b style={{ color: p.text }}>{guestName}</b></p>}
            </motion.div>
            <button onClick={onOpen} className="absolute bottom-6 inset-x-7 rounded-full py-3.5 text-sm font-extrabold shadow-lg sm:inset-x-10"
              style={{ background: p.primary, color: p.bg }}>
              فتح الدعوة ♪
            </button>
          </motion.div>
        ) : (
          <motion.div key="content" {...fade} className={step === 2 ? "min-h-[34rem] px-6 py-10 sm:px-9" : "min-h-[30rem] px-7 py-10 text-center sm:px-10"}>
            {step === 2 ? (
              <>
                <div className="mb-7 text-center">
                  <Sprig className="mx-auto h-14 w-14" style={{ color: p.accent }} />
                  <h2 className="font-display mt-1 text-2xl" style={{ color: "#FBF8F5" }}>برنامج الحفل</h2>
                  <p className="mt-1 text-[10px] tracking-[.35em]" style={{ color: p.accent }}>BIG DAY</p>
                </div>
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <div className="mx-auto mb-7 h-40 w-full overflow-hidden rounded-2xl" style={{ border: `1px solid ${p.accent}66` }}>
                    <img src={photo} alt="صورة العريس" className="h-full w-full object-cover object-center" />
                  </div>
                )}
                {program.length ? (
                  <div className="relative space-y-5 pr-6">
                    <span className="absolute right-[7px] top-2 bottom-2 w-px" style={{ background: p.accent + "77" }} />
                    {program.map((x, i) => (
                      <div key={i} className="relative">
                        <span className="absolute -right-6 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold" style={{ background: p.accent, color: "#2E3629" }}>{i + 1}</span>
                        <p className="font-display text-sm font-bold" style={{ color: "#FBF8F5" }}>{x.title}</p>
                        <p className="text-[11px]" dir="ltr" style={{ color: p.accent }}>{x.time}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-xs" style={{ color: "#D6D8C8" }}>لم يُنشأ جدول اليوم بعد</p>
                )}
                {v("event.dress_code") && (
                  <div className="mt-8 border-t pt-5 text-center" style={{ borderColor: p.accent + "44" }}>
                    <p className="text-[10px] tracking-wider" style={{ color: p.accent }}>الزي المطلوب</p>
                    <p className="font-display mt-1 text-lg" style={{ color: "#F2E9D4" }}>{v("event.dress_code")}</p>
                  </div>
                )}
                <div className="mt-7 space-y-4 rounded-2xl border p-4" style={{ borderColor: p.accent + "44", background: "rgba(255,255,255,.04)" }}>
                  <InfoRow icon={<CarFront className="h-4 w-4" />} label="المواصلات" value={v("event.transport")} color={p.accent} />
                  <InfoRow icon={<BedDouble className="h-4 w-4" />} label="الإقامة" value={v("event.accommodation")} color={p.accent} />
                  <InfoRow icon={<Camera className="h-4 w-4" />} label="التصوير" value={v("event.quote")} color={p.accent} />
                </div>
                <p className="mt-7 flex items-center justify-center gap-2 text-center text-xs" style={{ color: p.accent }}><Gift className="h-4 w-4" /> حضوركم هو أجمل هدية</p>
              </>
            ) : step === 1 ? (
              <>
                <Sprig className="mx-auto h-20 w-20" style={{ color: p.accent }} />
                <p className="mt-3 text-[11px] tracking-[.25em]" style={{ color: p.muted }}>أهلًا وسهلًا بكم</p>
                <h2 className="font-display mt-2 text-2xl" style={{ color: p.text }}>{names || substitute(schema.cover.title, vars)}</h2>
                <p className="mx-auto mt-3 max-w-xs text-xs leading-7" style={{ color: p.muted }}>
                  {v("event.invitation_line") || schema.details?.invitation_line || "نتشرف بدعوتكم"}
                </p>
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <div className="mx-auto mt-6 h-44 w-36 overflow-hidden shadow-md" style={{ borderRadius: "48% 48% 12px 12px / 30% 30% 12px 12px", border: `2px solid ${p.accent}` }}>
                    <img src={photo} alt="صورة العريس" className="h-full w-full object-cover" />
                  </div>
                )}
                {guestName && <p className="mt-6 text-xs" style={{ color: p.muted }}>ضيفنا الكريم: <b style={{ color: p.text }}>{guestName}</b></p>}
                <div className="mt-6">{children}</div>
              </>
            ) : (
              <>
                <Sprig className="mx-auto h-16 w-16" style={{ color: p.accent }} />
                <p className="mt-2 text-[11px] tracking-wider" style={{ color: p.muted }}>تأكيد الحضور</p>
                <h2 className="font-display mt-2 text-2xl" style={{ color: p.text }}>نسعد بحضوركم</h2>
                {v("event.rsvp_deadline") && <p className="mt-3 text-xs" style={{ color: p.muted }}>يرجى التأكيد قبل {v("event.rsvp_deadline")}</p>}
                {v("event.rsvp_phone") && <p className="mt-2 text-xs" dir="ltr" style={{ color: p.muted }}>للتأكيد: {v("event.rsvp_phone")}</p>}
                {v("event.quote") && (
                  <div className="mx-auto mt-5 max-w-xs rounded-xl border p-4 text-center" style={{ borderColor: p.accent + "55", background: p.card + "33" }}>
                    <Quote className="mx-auto h-4 w-4" style={{ color: p.accent }} />
                    <p className="font-display mt-2 text-sm leading-7" style={{ color: p.text }}>{v("event.quote")}</p>
                  </div>
                )}
                {guestName && <p className="mt-4 text-xs" style={{ color: p.muted }}>ضيفنا الكريم: <b style={{ color: p.text }}>{guestName}</b></p>}
                <div className="mt-6">{children}</div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
