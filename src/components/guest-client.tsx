"use client";
import * as React from "react";
import { Check, X, Minus, Plus, QrCode, ShieldCheck, Music4, MapPin, CalendarPlus, ChevronLeft, ChevronRight, Loader2, Printer } from "lucide-react";
import { api } from "@/lib/client";
import type { GuestPagePayload } from "@/server/services/rsvp";
import { InvitationCard, AudioPlayer, CalendarButton } from "@/components/invitation-card";
import { BUILTIN_TEMPLATES } from "@/lib/seeds";
import { defaultScenes, type EngineSchema, type Scene } from "@/lib/invitation-engine";
import { cn } from "@/lib/utils";

const STEP_LABELS = ["الغلاف", "الترحيب", "التفاصيل", "الحضور", "التذكرة"];

export function GuestClient({ payload: initial, token }: { payload: GuestPagePayload; token: string }) {
  const [payload, setPayload] = React.useState(initial);
  const [step, setStep] = React.useState(0);
  const [answer, setAnswer] = React.useState<"confirmed" | "declined" | null>((initial.rsvp?.answer as "confirmed" | "declined") ?? null);
  const [persons, setPersons] = React.useState(initial.rsvp?.persons_confirmed || 1);
  const [message, setMessage] = React.useState(initial.rsvp?.message ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [showQr, setShowQr] = React.useState(false);

  const schema = (payload.design ?? BUILTIN_TEMPLATES[0].schema) as EngineSchema;
  const p = schema.palette;
  const maxPersons = 1 + payload.companions_allowed;
  const scenes: Scene[] = React.useMemo(() => defaultScenes(schema), [schema]);
  const scene = scenes[step] ?? scenes[0];
  const confirmed = ["confirmed", "checked_in"].includes(payload.status);

  async function submitRsvp() {
    if (!answer) return;
    setBusy(true); setError("");
    try {
      await api.post(`/api/i/${token}/rsvp`, {
        answer, persons: answer === "confirmed" ? persons : 0, message: message || undefined,
      });
      const fresh = await api.get<GuestPagePayload>(`/api/i/${token}`);
      setPayload(fresh);
      setStep(4);
      setShowQr(answer === "confirmed");
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  }

  function openInvitation() {
    setStep(payload.rsvp && confirmed ? 4 : 1);
  }

  return (
    <div className="min-h-screen py-6 sm:py-10" style={{ background: `linear-gradient(180deg, ${p.bg} 0%, ${p.card} 140%)` }} dir="rtl">
      <div className="mx-auto max-w-md px-3 sm:px-4">
        {/* شريط تقدم المشاهد */}
        {step > 0 && (
          <div className="mb-4 flex items-center gap-1.5 rounded-full bg-white/70 p-1.5 shadow-sm backdrop-blur">
            {STEP_LABELS.slice(1).map((label, i) => {
              const idx = i + 1;
              return (
                <button key={label} onClick={() => idx <= step && setStep(idx)} disabled={idx > step}
                  className={cn("flex-1 rounded-full py-1.5 text-[10px] font-bold transition-all",
                    step === idx ? "bg-navy-950 text-cream-50" : idx < step ? "bg-gold-400/20 text-navy-950" : "text-muted opacity-60")}>
                  {label}
                </button>
              );
            })}
          </div>
        )}

        <InvitationCard
          schema={schema}
          event={payload.event as any}
          guestName={payload.guest_name}
          opened={step > 0}
          onOpen={openInvitation}
          logoUrl={payload.logo_url}
          backgroundUrl={payload.background_url}
          vars={payload.vars}
          scene={scene}
        >
          {step > 0 && (
            <div className="space-y-5">
              {payload.audio_url && <AudioPlayer src={payload.audio_url} palette={p} autoTryPlay={step === 1} />}

              {/* المشهد 3: التفاصيل */}
              {step === 2 && (
                <MotionSection>
                  <div className="rounded-2xl border p-4" style={{ borderColor: p.accent + "44", background: p.card + "22" }}>
                    <p className="text-xs" style={{ color: p.muted }}>{schema.details?.date_label ?? "الموعد"}</p>
                    <p className="mt-1 text-sm font-bold">{payload.vars["event.date"]} · {payload.vars["event.time"]}</p>
                    <p className="mt-1 text-xs" style={{ color: p.muted }}>{payload.vars["event.venue"]}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {payload.event.map_url && <a href={payload.event.map_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: p.primary + "66", color: p.primary }}><MapPin className="h-3.5 w-3.5" /> الموقع</a>}
                      <CalendarButton href={payload.calendar_url} palette={p} />
                    </div>
                  </div>
                </MotionSection>
              )}

              {/* المشهد 4: RSVP */}
              {step === 3 && (
                <MotionSection>
                  {payload.status === "checked_in" ? (
                    <div className="rounded-2xl border p-4 text-center" style={{ borderColor: p.accent + "44" }}>
                      <p className="text-lg font-extrabold" style={{ color: p.primary }}>تم تسجيل دخولك ✓</p>
                    </div>
                  ) : confirmed ? (
                    <div className="rounded-2xl border p-4 text-center" style={{ borderColor: p.accent + "44" }}>
                      <p className="text-base font-extrabold" style={{ color: p.primary }}>حضورك مؤكد ✓ — تذكرتك جاهزة</p>
                      <ButtonLite onClick={() => setStep(4)} style={{ background: p.primary, color: p.bg }}>عرض التذكرة</ButtonLite>
                    </div>
                  ) : (
                    <div className="rounded-2xl border p-4" style={{ borderColor: p.accent + "44" }}>
                      <p className="mb-3 text-sm font-bold">{schema.details?.rsvp_note ?? "هل ستشرّفنا بالحضور؟"}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setAnswer("confirmed")}
                          className={cn("flex cursor-pointer items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-extrabold transition-all", answer === "confirmed" && "scale-[1.02]")}
                          style={{ background: answer === "confirmed" ? p.primary : p.card + "44", color: answer === "confirmed" ? p.bg : p.text }}>
                          <Check className="h-4 w-4" /> سأحضر
                        </button>
                        <button onClick={() => setAnswer("declined")}
                          className={cn("flex cursor-pointer items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-extrabold transition-all", answer === "declined" && "scale-[1.02]")}
                          style={{ background: answer === "declined" ? "#A24B3F" : p.card + "44", color: answer === "declined" ? "#fff" : p.text }}>
                          <X className="h-4 w-4" /> أعتذر
                        </button>
                      </div>
                      {answer === "confirmed" && (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: p.card + "33" }}>
                            <span className="text-xs font-bold">الأشخاص (أنت + المرافقون)</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setPersons((x) => Math.max(1, x - 1))} disabled={persons <= 1} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full disabled:opacity-40" style={{ background: p.primary, color: p.bg }}><Minus className="h-3.5 w-3.5" /></button>
                              <span className="text-lg font-extrabold tabular-nums">{persons}</span>
                              <button onClick={() => setPersons((x) => Math.min(maxPersons, x + 1))} disabled={persons >= maxPersons} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full disabled:opacity-40" style={{ background: p.primary, color: p.bg }}><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                          <p className="text-[11px]" style={{ color: p.muted }}>الحد المسموح: {maxPersons} {payload.companions_allowed > 0 ? `(مرافقون حتى ${payload.companions_allowed})` : "(بدون مرافقين)"}</p>
                          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={2} placeholder="كلمة لصاحب المناسبة (اختياري)…"
                            className="w-full rounded-xl border bg-transparent px-3 py-2 text-xs placeholder:opacity-50 focus:outline-none" style={{ borderColor: p.muted + "44", color: p.text }} />
                        </div>
                      )}
                      {error && <p className="mt-2 text-center text-xs font-bold" style={{ color: "#A24B3F" }} role="alert">{error}</p>}
                      <button onClick={submitRsvp} disabled={!answer || busy || !payload.accepts_rsvp}
                        className="mt-3 w-full cursor-pointer rounded-xl py-3 text-sm font-extrabold disabled:opacity-50" style={{ background: p.primary, color: p.bg }}>
                        {busy ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ الإرسال…</span> : "إرسال الرد"}
                      </button>
                    </div>
                  )}
                </MotionSection>
              )}

              {/* المشهد 5: التذكرة */}
              {step === 4 && (
                <MotionSection>
                  {confirmed ? (
                    <div className="rounded-2xl border-2 p-4 text-center" style={{ borderColor: p.accent, background: p.card + "22" }}>
                      <p className="text-xs" style={{ color: p.muted }}>تذكرة دخول — ابرزها عند البوابة</p>
                      <p className="font-display mt-1 text-lg font-extrabold" style={{ color: p.text }}>{payload.guest_name}</p>
                      <p className="text-xs" style={{ color: p.muted }}>{payload.rsvp?.persons_confirmed ?? 1} أشخاص · {payload.vars["invitation.category"] || "ضيف"}</p>
                      <button onClick={() => setShowQr((v) => !v)} className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold" style={{ borderColor: p.primary + "66", color: p.primary }}>
                        <QrCode className="h-3.5 w-3.5" /> {showQr ? "إخفاء الرمز" : "إظهار رمز الدخول"}
                      </button>
                      {showQr && (
                        <div className="mt-3 inline-block rounded-xl bg-white p-3 shadow animate-fade-in">
                          <img src={`/api/i/${token}/qr.svg`} alt="رمز الدخول" className="h-auto w-[min(190px,58vw)]" />
                        </div>
                      )}
                      <div className="mt-3 flex justify-center gap-2">
                        <button onClick={() => window.print()} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold" style={{ borderColor: p.primary + "66", color: p.primary }}><Printer className="h-3.5 w-3.5" /> حفظ التذكرة</button>
                        <CalendarButton href={payload.calendar_url} palette={p} />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border p-4 text-center text-sm" style={{ borderColor: p.accent + "44" }}>
                      <p style={{ color: p.muted }}>أكد حضورك أولًا لإصدار تذكرتك.</p>
                      <ButtonLite onClick={() => setStep(3)} style={{ background: p.primary, color: p.bg }}>تأكيد الحضور</ButtonLite>
                    </div>
                  )}
                </MotionSection>
              )}

              {/* تنقّل بين المشاهد */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button onClick={() => setStep((s) => Math.max(0, s - 1))} className="flex cursor-pointer items-center gap-1 rounded-full border px-3 py-2 text-xs font-bold disabled:opacity-40" style={{ borderColor: p.muted + "44", color: p.muted }}>
                  <ChevronRight className="h-3.5 w-3.5" /> السابق
                </button>
                <span className="text-[11px] font-bold" style={{ color: p.muted }}>{step} من 5 · {STEP_LABELS[step]}</span>
                {step < 4 ? (
                  <button onClick={() => setStep((s) => Math.min(4, s + 1))} className="flex cursor-pointer items-center gap-1 rounded-full px-3 py-2 text-xs font-bold" style={{ background: p.primary, color: p.bg }}>
                    التالي <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span className="w-16" />
                )}
              </div>
            </div>
          )}
        </InvitationCard>

        <p className="mx-auto mt-5 flex max-w-sm items-center justify-center gap-1.5 text-center text-[10px] leading-5" style={{ color: p.muted }}>
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          صفحة خاصة بدعوتك فقط؛ لا تُعرض قائمة الضيوف. بياناتك تُستخدم لتنظيم المناسبة.
        </p>
        <p className="mt-2 text-center text-[10px] opacity-60" style={{ color: p.muted }}>ليلتنا | LAYLATNA · {musicHint(!!payload.audio_url)}</p>
      </div>
    </div>
  );
}

function MotionSection({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up">{children}</div>;
}

function ButtonLite({ children, onClick, style }: { children: React.ReactNode; onClick: () => void; style?: React.CSSProperties }) {
  return <button onClick={onClick} className="mt-3 cursor-pointer rounded-full px-4 py-2 text-xs font-bold" style={style}>{children}</button>;
}

function musicHint(hasAudio: boolean) {
  return hasAudio ? "الصوت يتحكم به الضيف" : "دعوة تفاعلية";
}
