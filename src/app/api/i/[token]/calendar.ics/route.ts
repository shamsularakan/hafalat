import { route } from "@/lib/api";
import { getDb } from "@/lib/db";
import { findInvitationByToken } from "@/server/services/rsvp";
import { buildIcs } from "@/lib/dates";
import { invitationUrl } from "@/lib/tokens";

type P = { params: Promise<{ token: string }> };

export const GET = route(async (_req: Request, { params }: P) => {
  const { token } = await params;
  const db = (await getDb());
  const inv = (await findInvitationByToken(db, token));
  const event = (await db.get<any>("SELECT * FROM events WHERE id = ?", inv.event_id))!;
  if (!event.starts_at) {
    const { AppError } = await import("@/lib/errors");
    throw new AppError("NOT_FOUND", "لا يوجد موعد محدد");
  }
  const ics = buildIcs({
    title: event.title,
    description: event.description ?? undefined,
    location: [event.venue_name, event.venue_address].filter(Boolean).join(" — ") || undefined,
    start: event.starts_at,
    end: event.ends_at ?? undefined,
    url: invitationUrl(token),
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="event.ics"',
      "Cache-Control": "no-store",
    },
  });
});
