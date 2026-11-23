import { getDb } from "@/lib/db";
import { getGuestPage } from "@/server/services/rsvp";
import { AppError } from "@/lib/errors";
import { GuestClient } from "@/components/guest-client";
import { Brand } from "@/components/brand";
import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { findInvitationByToken } from "@/server/services/rsvp";
import { getSessionUser } from "@/server/context";
import { verifyByInvitationToken } from "@/server/services/helpers";
import { hashToken } from "@/lib/tokens";

/** زواحف معاينة الروابط (واتساب وغيرها) تفتح الرابط تلقائيًا — لا نحسبها «مشاهدة» من الضيف */
const PREVIEW_BOTS = /WhatsApp|facebookexternalhit|Facebot|TelegramBot|Twitterbot|Slackbot|LinkedInBot|Discordbot|SkypeUriPreview|Googlebot/i;

async function previewInfo(token: string) {
  try {
    const db = await getDb();
    const inv = await findInvitationByToken(db, token);
    const ev = await db.get<{ title: string; host_name: string | null }>("SELECT title, host_name FROM events WHERE id = ?", inv.event_id);
    const g = await db.get<{ name: string; title: string | null }>("SELECT name, title FROM guests WHERE id = ?", inv.guest_id);
    return ev ? { ...ev, guest: g ? [g.title, g.name].filter(Boolean).join(" ") : "" } : null;
  } catch { return null; }
}

export const dynamic = "force-dynamic";
/** بطاقة المعاينة في واتساب: اسم المناسبة ونص قصير — بلا اسم الضيف أو أي بيانات شخصية */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const ev = await previewInfo(token);
  // الرابط شخصي (يصل للمدعو وحده)، فيظهر اسمه في بطاقة المعاينة كما يظهر في الدعوة نفسها
  const title = ev ? (ev.guest ? `دعوة خاصة — ${ev.guest}` : ev.title) : "دعوتك";
  const description = ev ? `${ev.title}${ev.host_name ? ` · ${ev.host_name}` : ""} — اضغط لفتح الدعوة وتأكيد الحضور` : "دعوة خاصة عبر ليلتنا";
  return {
    title, description, robots: { index: false, follow: false },
    openGraph: { title, description, siteName: "ليلتنا | LAYLATNA", locale: "ar_SA", type: "website" },
  };
}

/** صفحة الضيف العامة: آمنة، بلا كشف بيانات آخرين (AC-07) */
export default async function GuestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ua = (await headers()).get("user-agent") ?? "";
  if (PREVIEW_BOTS.test(ua)) {
    const ev = await previewInfo(token);
    return <main dir="rtl" className="p-8 text-center"><p>دعوة خاصة</p><h1>{ev?.guest || ev?.title || "دعوتك"}</h1><p>{ev?.title} — افتح الرابط لعرض التفاصيل وتأكيد الحضور.</p></main>;
  }
  try {
    const payload = (await getGuestPage((await getDb()), token));
    // صاحب الحساب فتح دعوته المرسلة لرقمه ← الرقم موثّق، فتظهر كل دعواته وفزعاته في حسابه
    const viewer = await getSessionUser().catch(() => null);
    if (viewer) await verifyByInvitationToken(await getDb(), viewer, hashToken(token)).catch(() => false);
    return <GuestClient payload={payload} token={token} />;
  } catch (e) {
    const message =
      e instanceof AppError
        ? e.code === "EXPIRED"
          ? "انتهت صلاحية هذه الدعوة أو أُلغيت. تواصل مع صاحب المناسبة إن كنت تعتقد أن هذا خطأ."
          : e.code === "EVENT_CLOSED"
            ? "المناسبة لم تعد متاحة عبر هذا الرابط."
            : "رابط الدعوة غير صالح. تأكد من نسخ الرابط كاملًا من الرسالة."
        : "تعذر فتح الدعوة حاليًا. حاول مجددًا بعد قليل.";
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4" dir="rtl">
        <div className="w-full max-w-sm rounded-card bg-navy-900 p-8 text-center text-ivory shadow-2xl">
          <Brand size={48} tone="gold" />
          <p className="mt-2 text-sm leading-7 text-ivory/70">{message}</p>
          <Link href="/" className="mt-6 inline-block text-xs text-lime-400 underline underline-offset-4">عن المنصة</Link>
        </div>
      </div>
    );
  }
}
