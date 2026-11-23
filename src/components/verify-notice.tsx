"use client";
/** تنبيه إثبات ملكية الرقم قبل عرض الدعوات والفزعات المرتبطة به */
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";

export function VerifyNotice({ count, what, hasPhone }: { count: number; what: string; hasPhone: boolean }) {
  if (!hasPhone) {
    return (
      <EmptyState title="أضف رقم جوالك أولًا" hint={`${what} تظهر حسب رقم الجوال الذي أرسلها إليك أصحاب المناسبات. حسابك مسجّل بالبريد فقط.`}
        action={<Link href="/app/settings"><Button variant="outline">الإعدادات</Button></Link>} />
    );
  }
  return (
    <Card className="flex items-start gap-3 border-lime-400/60 bg-lime-100/50">
      <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-gold-500" />
      <div>
        <p className="font-bold">{count > 0 ? `لديك ${formatNumber(count)} على رقم جوالك` : `لا ${what} على رقم جوالك بعد`}</p>
        <p className="mt-1 text-sm leading-7 text-muted">
          لحمايتك، لا نعرضها حتى نتأكد أن الرقم رقمك: افتح أي رابط دعوة أو فزعة وصلك على واتساب وأنت مسجّل الدخول هنا،
          وستظهر كل {what} في حسابك تلقائيًا.
        </p>
      </div>
    </Card>
  );
}

