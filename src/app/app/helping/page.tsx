"use client";
/** «فزعاتي»: المناسبات التي طُلبت فيها فزعتك، وبطاقات الشكر بعد انتهائها */
import * as React from "react";
import { HandHeart, CalendarDays, MapPin, Phone, ExternalLink, Check, X, Clock } from "lucide-react";
import { api } from "@/lib/client";
import { formatDateShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading, ErrorState, EmptyState, useToast } from "@/components/ui/feedback";
import { ThanksCard } from "@/components/helper-cards";
import { VerifyNotice } from "@/components/verify-notice";

export default function MyHelpingPage() {
  const { show, node } = useToast();
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const load = React.useCallback(() => { api.get("/api/me/helping").then(setData).catch((e) => setError(e.message)); }, []);
  React.useEffect(load, [load]);
  async function respond(h: any, accept: boolean) {
    try { await api.post(`/api/f/${h.code}/respond`, { accept }); show(accept ? "أبشر — سجّلنا فزعتك" : "سجّلنا اعتذارك"); load(); }
    catch (e: any) { show(e.message, "error"); }
  }
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loading />;
  const thanked = data.helping.filter((h: any) => h.thanks);
  const active = data.helping.filter((h: any) => !h.thanks);
  return (
    <div className="space-y-5 animate-fade-up">
      {node}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><HandHeart className="h-6 w-6 text-gold-500" /> فزعاتي</h1>
        <p className="mt-1 text-sm text-muted">المناسبات التي طلب أصحابها فزعتك، وبطاقات الشكر بعد انتهائها.</p>
      </div>
      {!data.verified ? <VerifyNotice count={data.pending_count} what="الفزعات" hasPhone={data.has_phone} /> : data.helping.length === 0 ? (
        <EmptyState title="لا فزعات بعد" hint="عندما يضيفك أحد في فريق الفزعة لمناسبته على رقم جوالك تظهر هنا." />
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {active.map((h: any) => (
                <Card key={h.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{h.event.title}</p>
                      <p className="text-sm text-muted">{h.event.host_name || h.event.organizer} يطلب فزعتك</p>
                    </div>
                    {h.status === "accepted" ? <Badge tone="success"><Check className="h-3.5 w-3.5" /> قبلت</Badge>
                      : h.status === "declined" ? <Badge tone="neutral"><X className="h-3.5 w-3.5" /> اعتذرت</Badge>
                      : <Badge tone="warning"><Clock className="h-3.5 w-3.5" /> بانتظار ردك</Badge>}
                  </div>
                  {h.task && <p className="mt-3 rounded-xl bg-lime-100/60 p-2.5 text-sm">مهمتك: <b>{h.task}</b></p>}
                  <div className="mt-3 space-y-1 text-sm text-muted">
                    {h.event.starts_at && <p className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {formatDateShort(h.event.starts_at, h.event.timezone)}</p>}
                    {h.event.venue_name && <p className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {h.event.venue_name}</p>}
                    {h.event.organizer_phone && <p className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> <a href={`tel:${h.event.organizer_phone}`} dir="ltr" className="font-bold text-navy-950">{h.event.organizer_phone}</a></p>}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {h.status !== "accepted" && <Button size="sm" onClick={() => respond(h, true)}><Check className="h-4 w-4" /> أبشر، أنا حاضر</Button>}
                    {h.status !== "declined" && <Button size="sm" variant="outline" onClick={() => respond(h, false)}>أعتذر</Button>}
                    <a href={h.link} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><ExternalLink className="h-4 w-4" /> صفحة الفزعة</Button></a>
                  </div>
                </Card>
              ))}
            </div>
          )}
          {thanked.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold text-muted">بطاقات الشكر</h2>
              <div className="grid gap-5 md:grid-cols-2">
                {thanked.map((h: any) => <ThanksCard key={h.id} name={h.name} message={h.thanks.message} from={h.thanks.from} eventTitle={h.event.title} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
