import { getDb } from "@/lib/db";
import { getGuestPage } from "@/server/services/rsvp";
import { AppError } from "@/lib/errors";
import { GuestClient } from "@/components/guest-client";
import { Brand } from "@/components/brand";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "دعوتك", robots: { index: false, follow: false } };

/** صفحة الضيف العامة: آمنة، بلا كشف بيانات آخرين (AC-07) */
export default async function GuestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const payload = (await getGuestPage((await getDb()), token));
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
