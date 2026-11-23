import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getSessionUser } from "@/server/context";
import { getHelperPage } from "@/server/services/helpers";
import { HelperClient } from "@/components/helper-cards";
import { Brand } from "@/components/brand";

export const dynamic = "force-dynamic";

/** زواحف معاينة الروابط لا تُوثّق رقمًا ولا تغيّر حالة */
const PREVIEW_BOTS = /WhatsApp|facebookexternalhit|Facebot|TelegramBot|Twitterbot|Slackbot|LinkedInBot|Discordbot|Googlebot/i;

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  try {
    const d = await getHelperPage(await getDb(), code);
    const title = d.thanks ? `بطاقة شكر — ${d.name}` : `طلب فزعة — ${d.name}`;
    const description = `«${d.event.title}»${d.task ? ` · مهمتك: ${d.task}` : ""}`;
    return { title, description, robots: { index: false, follow: false }, openGraph: { title, description, siteName: "ليلتنا | LAYLATNA", locale: "ar_SA" } };
  } catch {
    return { title: "طلب فزعة", robots: { index: false, follow: false } };
  }
}

export default async function HelperPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const ua = (await headers()).get("user-agent") ?? "";
  try {
    const viewer = PREVIEW_BOTS.test(ua) ? null : await getSessionUser().catch(() => null);
    const data = await getHelperPage(await getDb(), code, viewer);
    return <HelperClient code={code} data={JSON.parse(JSON.stringify(data))} />;
  } catch (e) {
    const message = e instanceof AppError && e.code === "EVENT_CLOSED" ? "المناسبة لم تعد متاحة." : "رابط الفزعة غير صالح. تأكد من نسخه كاملًا من الرسالة.";
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4" dir="rtl">
        <div className="w-full max-w-sm rounded-card bg-navy-900 p-8 text-center text-ivory shadow-2xl">
          <Brand size={48} tone="gold" />
          <p className="mt-2 text-sm leading-7 text-ivory/80">{message}</p>
          <Link href="/" className="mt-6 inline-block text-xs text-lime-400 underline underline-offset-4">عن المنصة</Link>
        </div>
      </div>
    );
  }
}
