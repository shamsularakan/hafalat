"use client";
/** بطاقة الشكر للفزعة + صفحة طلب الفزعة العامة (/f/<رمز>) */
import * as React from "react";
import { HandHeart, Check, X, MapPin, Phone, Loader2, CalendarDays } from "lucide-react";
import { api } from "@/lib/client";
import { formatDateShort } from "@/lib/utils";
import { Brand } from "@/components/brand";

const OLIVE = "#5F6553";
const CREAM = "#FBF8F5";
const GOLD = "#C9A86A";
const INK = "#2E2A26";

/** بطاقة الشكر — بهوية الدعوة الكاملة (زيتوني/كريمي/ذهبي) */
export function ThanksCard({ name, message, from, eventTitle }: { name: string; message: string; from?: string; eventTitle: string }) {
  return (
    <article className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl shadow-xl" style={{ background: CREAM }} aria-label={`بطاقة شكر إلى ${name}`}>
      <div className="px-6 py-7 text-center" style={{ background: OLIVE, color: CREAM }}>
        <HandHeart className="mx-auto h-8 w-8" style={{ color: GOLD }} aria-hidden />
        <p className="mt-2 text-xs tracking-wide" style={{ color: "#F2E9D4" }}>بطاقة شكر</p>
        <h2 className="font-display mt-1 text-3xl font-bold">{name}</h2>
      </div>
      <div className="px-6 py-7 text-center" style={{ color: INK }}>
        <p className="font-display whitespace-pre-line text-lg leading-9">{message}</p>
        <div className="mx-auto my-5 h-px w-20" style={{ background: GOLD }} />
        <p className="text-xs" style={{ color: "#6B665C" }}>{eventTitle}</p>
        {from && <p className="font-display mt-1 text-base font-bold">{from}</p>}
      </div>
    </article>
  );
}

export function HelperClient({ code, data }: { code: string; data: any }) {
  const [status, setStatus] = React.useState<string>(data.status);
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");
  const ev = data.event;
  async function respond(accept: boolean) {
    setBusy(accept ? "a" : "d"); setError("");
    try { const r = await api.post<any>(`/api/f/${code}/respond`, { accept }); setStatus(r.status); }
    catch (e: any) { setError(e.message); }
    setBusy("");
  }
  return (
    <div className="min-h-screen px-4 py-8" style={{ background: OLIVE }} dir="rtl">
      <div className="mx-auto max-w-sm space-y-5">
        {data.thanks && <ThanksCard name={data.name} message={data.thanks.message} from={data.thanks.from} eventTitle={ev.title} />}

        <section className="overflow-hidden rounded-3xl shadow-xl" style={{ background: CREAM, color: INK }} aria-label="طلب الفزعة">
          <div className="px-6 py-6 text-center" style={{ background: data.thanks ? CREAM : OLIVE, color: data.thanks ? INK : CREAM }}>
            <p className="text-xs" style={{ color: data.thanks ? "#6B665C" : "#F2E9D4" }}>طلب فزعة</p>
            <h1 className="font-display mt-1 text-2xl font-bold">{data.name}</h1>
            <p className="mt-2 text-sm leading-7">{ev.host_name || ev.organizer} {data.thanks ? "شكر فزعتك في" : "يطلب فزعتك في"} «{ev.title}»</p>
          </div>
          <div className="space-y-3 px-6 py-5 text-sm">
            {data.task && <p className="rounded-xl p-3 text-center" style={{ background: "#EFEADF" }}>مهمتك: <b>{data.task}</b></p>}
            {data.notes && <p className="leading-7" style={{ color: "#4A453D" }}>{data.notes}</p>}
            {ev.starts_at && <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0" style={{ color: OLIVE }} /> {formatDateShort(ev.starts_at, ev.timezone)}</p>}
            {(ev.venue_name || ev.venue_address) && (
              <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: OLIVE }} />
                <span>{[ev.venue_name, ev.venue_address].filter(Boolean).join(" — ")}
                  {ev.map_url && <> · <a href={ev.map_url} target="_blank" rel="noreferrer" className="font-bold underline">الموقع</a></>}</span>
              </p>
            )}
            {ev.organizer_phone && (
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" style={{ color: OLIVE }} /> للتنسيق:
                <a href={`tel:${ev.organizer_phone}`} dir="ltr" className="font-bold">{ev.organizer_phone}</a></p>
            )}
          </div>
          {!data.thanks && (
            <div className="space-y-2 px-6 pb-6">
              {status === "accepted" && <p className="flex items-center justify-center gap-1.5 rounded-xl p-3 font-bold" style={{ background: "#E4EBDD", color: "#3E5A35" }}><Check className="h-5 w-5" /> أبشر — سجّلنا فزعتك، الله يجزاك خير</p>}
              {status === "declined" && <p className="rounded-xl p-3 text-center text-sm" style={{ background: "#F3E7E4" }}>سجّلنا اعتذارك — ما قصّرت</p>}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => respond(true)} disabled={!!busy || status === "accepted"}
                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50" style={{ background: INK }}>
                  {busy === "a" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} أبشر، أنا حاضر
                </button>
                <button onClick={() => respond(false)} disabled={!!busy || status === "declined"}
                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 py-3 text-sm font-bold disabled:opacity-50" style={{ borderColor: INK, color: INK }}>
                  {busy === "d" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} أعتذر
                </button>
              </div>
              {error && <p className="text-center text-xs font-bold" style={{ color: "#A24B3F" }} role="alert">{error}</p>}
            </div>
          )}
        </section>

        <div className="text-center" style={{ color: CREAM }}>
          <Brand size={28} tone="cream" />
          <p className="mt-2 text-[11px]" style={{ color: "rgba(251,248,245,.8)" }}>سجّل في ليلتنا برقم جوالك لتجد كل دعواتك وفزعاتك في مكان واحد</p>
        </div>
      </div>
    </div>
  );
}
