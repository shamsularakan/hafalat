"use client";
/** «دعواتي»: كل الدعوات المرسلة إلى رقم صاحب الحساب — بعد إثبات ملكية الرقم */
import * as React from "react";
import Link from "next/link";
import { Mail, CalendarDays, MapPin, ExternalLink, Check, X, Clock } from "lucide-react";
import { VerifyNotice } from "@/components/verify-notice";
import { api } from "@/lib/client";
import { formatDateShort, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading, ErrorState, EmptyState } from "@/components/ui/feedback";

export default function MyInvitationsPage() {
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const load = React.useCallback(() => { api.get("/api/me/invitations").then(setData).catch((e) => setError(e.message)); }, []);
  React.useEffect(load, [load]);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loading />;
  const upcoming = data.invitations.filter((i: any) => i.upcoming);
  const past = data.invitations.filter((i: any) => !i.upcoming);
  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><Mail className="h-6 w-6 text-gold-500" /> دعواتي</h1>
        <p className="mt-1 text-sm text-muted">الدعوات التي وصلتك من أصحاب المناسبات على رقم جوالك.</p>
      </div>
      {!data.verified ? <VerifyNotice count={data.pending_count} what="الدعوات" hasPhone={data.has_phone} /> : data.invitations.length === 0 ? (
        <EmptyState title="لا دعوات بعد" hint="عندما يدعوك أحد على رقم جوالك تظهر دعوته هنا." />
      ) : (
        <>
          <Section title="القادمة" list={upcoming} />
          {past.length > 0 && <Section title="السابقة" list={past} muted />}
        </>
      )}
    </div>
  );
}

function Section({ title, list, muted }: { title: string; list: any[]; muted?: boolean }) {
  if (list.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold text-muted">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((i) => (
          <Card key={i.id} className={muted ? "opacity-80" : ""}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{i.event.title}</p>
                {i.event.host_name && <p className="text-sm text-muted">من {i.event.host_name}</p>}
              </div>
              {i.answer === "confirmed" ? <Badge tone="success"><Check className="h-3.5 w-3.5" /> مؤكد</Badge>
                : i.answer === "declined" ? <Badge tone="neutral"><X className="h-3.5 w-3.5" /> معتذر</Badge>
                : <Badge tone="warning"><Clock className="h-3.5 w-3.5" /> بانتظار ردك</Badge>}
            </div>
            <div className="mt-3 space-y-1 text-sm text-muted">
              {i.event.starts_at && <p className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {formatDateShort(i.event.starts_at, i.event.timezone)}</p>}
              {i.event.venue_name && <p className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {i.event.venue_name}</p>}
            </div>
            <a href={i.url} target="_blank" rel="noreferrer" className="mt-4 block">
              <Button className="w-full" variant={muted ? "outline" : "primary"}><ExternalLink className="h-4 w-4" /> فتح الدعوة</Button>
            </a>
          </Card>
        ))}
      </div>
    </section>
  );
}
