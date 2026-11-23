import { route, ok, readJson, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { submitRsvp } from "@/server/services/rsvp";
import { rateLimit } from "@/lib/auth";

type P = { params: Promise<{ token: string }> };

export const POST = route(async (req: Request, { params }: P) => {
  const { token } = await params;
  rateLimit(`rsvp:${token}`, 20, 60e3);
  rateLimit(`rsvp-ip:${clientIp(req)}`, 40, 60e3);
  const body = await readJson(req, 64 * 1024);
  return ok(submitRsvp(getDb(), token, {
    answer: body.answer, persons: body.persons, message: body.message,
  }));
});
